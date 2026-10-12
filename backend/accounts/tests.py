from datetime import timedelta
from unittest import mock

from django.conf import settings
from django.core import mail
from django.core.cache import caches
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import AccountStatus, EmailVerification, RegistrationNotification, User, UserRole
from .testing import RESEND_URL, VERIFY_URL, last_code, signup_and_verify

SIGNUP_URL = "/api/auth/farmer/signup/"
FARMER_LOGIN_URL = "/api/auth/farmer/login/"
LGU_LOGIN_URL = "/api/auth/lgu/login/"
ADMIN_LOGIN_URL = "/api/auth/admin/login/"
ME_URL = "/api/auth/me/"
REFRESH_URL = "/api/auth/refresh/"
ADMIN_USERS_URL = "/api/admin/users/"
ADMIN_LGU_CREATE_URL = "/api/admin/lgu-officers/"

VALID_SIGNUP = {
    "first_name": "Juan",
    "last_name": "Dela Cruz",
    "email": "juan@example.com",
    "password": "SecurePassword123!",
    "password_confirm": "SecurePassword123!",
}


def make_user(email, role, account_status, password="SecurePassword123!"):
    return User.objects.create_user(
        email=email,
        password=password,
        first_name="Test",
        last_name="User",
        role=role,
        account_status=account_status,
    )


class FarmerSignupTests(APITestCase):
    def test_signup_creates_an_approved_farmer_and_notification(self):
        response = signup_and_verify(self.client, VALID_SIGNUP)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        user = User.objects.get(email="juan@example.com")
        self.assertEqual(user.role, UserRole.FARMER)
        self.assertEqual(user.account_status, AccountStatus.APPROVED)
        # Admins no longer gate the account, but they still get the record.
        self.assertEqual(RegistrationNotification.objects.filter(user=user).count(), 1)

    def test_the_emailed_code_signs_the_farmer_in(self):
        """A new Farmer lands on their dashboard, not a waiting screen."""
        response = signup_and_verify(self.client, VALID_SIGNUP)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertEqual(response.data["user"]["email"], "juan@example.com")
        # Refresh token rides in the HttpOnly cookie, exactly as on login.
        self.assertIn(settings.REFRESH_COOKIE_NAME, response.cookies)

    def test_a_new_farmer_can_immediately_use_the_api(self):
        signup = signup_and_verify(self.client, VALID_SIGNUP)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {signup.data['access']}"
        )
        response = self.client.get("/api/farmer/plants/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_an_admin_can_still_shut_a_self_registered_account_down(self):
        """
        The gate moved, it did not disappear. Anyone can now sign themselves
        in, so the thing that has to keep working is an Admin's ability to
        shut an account down afterwards - including one holding a token
        issued seconds earlier.
        """
        signup = signup_and_verify(self.client, VALID_SIGNUP)
        access = signup.data["access"]

        farmer = User.objects.get(email="juan@example.com")
        farmer.account_status = AccountStatus.SUSPENDED
        farmer.save()

        # The token it was already given stops working.
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(
            self.client.get("/api/farmer/plants/").status_code,
            status.HTTP_403_FORBIDDEN,
        )

        # And it cannot sign back in for a fresh one.
        self.client.credentials()
        again = self.client.post(
            FARMER_LOGIN_URL,
            {"email": "juan@example.com", "password": VALID_SIGNUP["password"]},
            format="json",
        )
        self.assertEqual(again.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_signup_accepts_a_single_name(self):
        """A farmer who gives one name gets one name, not the same one twice."""
        response = signup_and_verify(
            self.client, {**VALID_SIGNUP, "first_name": "Nonong", "last_name": ""}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["full_name"], "Nonong")
        self.assertEqual(User.objects.get(email="juan@example.com").last_name, "")

    def test_signup_never_returns_password_or_hash(self):
        response = self.client.post(SIGNUP_URL, VALID_SIGNUP, format="json")
        body = response.content.decode()
        self.assertNotIn("password", body)
        self.assertNotIn("pbkdf2", body)

    def test_signup_stores_hashed_password(self):
        self.client.post(SIGNUP_URL, VALID_SIGNUP, format="json")
        user = User.objects.get(email="juan@example.com")
        self.assertNotEqual(user.password, VALID_SIGNUP["password"])
        self.assertTrue(user.check_password(VALID_SIGNUP["password"]))

    def test_signup_ignores_client_supplied_role_and_status(self):
        payload = {
            **VALID_SIGNUP,
            "role": "ADMIN",
            # REJECTED, not APPROVED: signups are approved by default now, so
            # sending APPROVED would pass whether or not the field is
            # honoured. A status the server would never pick is what actually
            # proves the client cannot set this.
            "account_status": "REJECTED",
            "is_superuser": True,
            "is_staff": True,
        }
        self.client.post(SIGNUP_URL, payload, format="json")
        user = User.objects.get(email="juan@example.com")
        self.assertEqual(user.role, UserRole.FARMER)
        self.assertEqual(user.account_status, AccountStatus.APPROVED)
        self.assertFalse(user.is_superuser)
        self.assertFalse(user.is_staff)

    def test_duplicate_email_rejected(self):
        signup_and_verify(self.client, VALID_SIGNUP)
        response = self.client.post(SIGNUP_URL, VALID_SIGNUP, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already exists", str(response.data))

    def test_password_mismatch_rejected(self):
        payload = {**VALID_SIGNUP, "password_confirm": "DifferentPassword123!"}
        response = self.client.post(SIGNUP_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class FarmerEmailVerificationTests(APITestCase):
    """Sign-up emails a one-time code; the account works only once it is typed back."""

    def signup(self, payload=VALID_SIGNUP):
        return self.client.post(SIGNUP_URL, payload, format="json")

    def verify(self, code, email="juan@example.com"):
        return self.client.post(VERIFY_URL, {"email": email, "code": code}, format="json")

    def login(self):
        return self.client.post(
            FARMER_LOGIN_URL,
            {"email": "juan@example.com", "password": VALID_SIGNUP["password"]},
            format="json",
        )

    def wrong(self, code):
        return "000000" if code != "000000" else "111111"

    def test_signup_emails_a_code_and_signs_nobody_in(self):
        response = self.signup()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["code"], "email_not_verified")
        self.assertNotIn("access", response.data)
        self.assertNotIn(settings.REFRESH_COOKIE_NAME, response.cookies)

        self.assertEqual(len(mail.outbox), 1)
        code = last_code("juan@example.com")
        self.assertRegex(code, r"^\d{6}$")
        self.assertIn(code, mail.outbox[0].body)
        self.assertFalse(User.objects.get(email="juan@example.com").email_verified)

    def test_the_code_is_never_stored_in_the_clear(self):
        self.signup()
        code = last_code("juan@example.com")
        row = EmailVerification.objects.get(user__email="juan@example.com")
        self.assertNotIn(code, row.code_hash)

    def test_nobody_is_announced_until_the_code_comes_back(self):
        self.signup()
        self.assertFalse(RegistrationNotification.objects.exists())

    def test_an_unverified_account_cannot_sign_in_and_is_sent_a_code(self):
        self.signup()
        mail.outbox.clear()
        EmailVerification.objects.update(sent_at=timezone.now() - timedelta(minutes=5))

        response = self.login()
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "email_not_verified")
        self.assertNotIn("access", response.data)
        # A fresh code went out, and it works.
        self.assertEqual(self.verify(last_code("juan@example.com")).status_code, 200)

    def test_a_wrong_password_never_reveals_the_code_step(self):
        self.signup()
        response = self.client.post(
            FARMER_LOGIN_URL,
            {"email": "juan@example.com", "password": "WrongPassword123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn("code", response.data)

    def test_after_verifying_the_farmer_signs_in_with_just_the_password(self):
        signup_and_verify(self.client, VALID_SIGNUP)
        response = self.login()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    def test_a_code_works_only_once(self):
        self.signup()
        code = last_code("juan@example.com")
        self.assertEqual(self.verify(code).status_code, 200)
        self.assertEqual(self.verify(code).status_code, 400)

    def test_a_wrong_code_is_refused(self):
        self.signup()
        response = self.verify(self.wrong(last_code("juan@example.com")))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not correct", response.data["detail"])
        self.assertFalse(User.objects.get(email="juan@example.com").email_verified)

    def test_five_wrong_codes_lock_it_even_against_the_right_one(self):
        self.signup()
        code = last_code("juan@example.com")
        for _ in range(5):
            self.verify(self.wrong(code))
        response = self.verify(code)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Too many", response.data["detail"])

    def test_an_expired_code_is_refused(self):
        self.signup()
        code = last_code("juan@example.com")
        EmailVerification.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        response = self.verify(code)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expired", response.data["detail"])

    def test_resend_waits_a_minute_then_replaces_the_old_code(self):
        self.signup()
        old = last_code("juan@example.com")

        too_soon = self.client.post(RESEND_URL, {"email": "juan@example.com"}, format="json")
        self.assertEqual(too_soon.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        EmailVerification.objects.update(sent_at=timezone.now() - timedelta(minutes=2))
        response = self.client.post(RESEND_URL, {"email": "juan@example.com"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        new = last_code("juan@example.com")
        if new != old:
            self.assertEqual(self.verify(old).status_code, 400)
        self.assertEqual(self.verify(new).status_code, 200)

    def test_resend_answers_the_same_for_an_unknown_address(self):
        response = self.client.post(RESEND_URL, {"email": "nobody@example.com"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)

    def test_an_unfinished_signup_does_not_hold_the_address(self):
        """Whoever can read the inbox may claim it, typo'd sign-up or not."""
        self.signup({**VALID_SIGNUP, "first_name": "Typo"})
        response = self.signup({**VALID_SIGNUP, "first_name": "Owner"})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.filter(email="juan@example.com").count(), 1)
        self.assertEqual(User.objects.get(email="juan@example.com").first_name, "Owner")

    def test_a_typo_of_a_common_provider_is_caught(self):
        response = self.signup({**VALID_SIGNUP, "email": "juan@gmial.com"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("juan@gmail.com", str(response.data["email"]))
        self.assertEqual(len(mail.outbox), 0)

    @override_settings(EMAIL_DOMAIN_CHECK=True)
    def test_a_domain_with_no_mail_server_is_refused(self):
        with mock.patch("accounts.email_check._domain_receives_mail", return_value=False):
            response = self.signup({**VALID_SIGNUP, "email": "juan@nowhere-farm.test"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("could not be found", str(response.data["email"]))
        self.assertFalse(User.objects.filter(email="juan@nowhere-farm.test").exists())

    @override_settings(EMAIL_DOMAIN_CHECK=True)
    def test_a_dns_outage_never_blocks_a_signup(self):
        with mock.patch("accounts.email_check._domain_receives_mail", return_value=None):
            response = self.signup()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_if_the_code_cannot_be_sent_nothing_is_kept(self):
        with mock.patch(
            "django.core.mail.EmailMultiAlternatives.send", side_effect=OSError("SMTP down")
        ):
            response = self.signup()
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("couldn't send", response.data["detail"])
        self.assertFalse(User.objects.filter(email="juan@example.com").exists())


class FarmerLoginStatusTests(APITestCase):
    def test_pending_farmer_cannot_log_in(self):
        make_user("pending@example.com", UserRole.FARMER, AccountStatus.PENDING)
        response = self.client.post(
            FARMER_LOGIN_URL,
            {"email": "pending@example.com", "password": "SecurePassword123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("waiting for administrator approval", response.data["detail"])

    def test_rejected_farmer_cannot_log_in(self):
        make_user("rejected@example.com", UserRole.FARMER, AccountStatus.REJECTED)
        response = self.client.post(
            FARMER_LOGIN_URL,
            {"email": "rejected@example.com", "password": "SecurePassword123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("was not approved", response.data["detail"])

    def test_suspended_farmer_cannot_log_in(self):
        make_user("suspended@example.com", UserRole.FARMER, AccountStatus.SUSPENDED)
        response = self.client.post(
            FARMER_LOGIN_URL,
            {"email": "suspended@example.com", "password": "SecurePassword123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("suspended", response.data["detail"])

    def test_approved_farmer_can_log_in(self):
        make_user("approved@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        response = self.client.post(
            FARMER_LOGIN_URL,
            {"email": "approved@example.com", "password": "SecurePassword123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertEqual(response.data["user"]["role"], "FARMER")
        self.assertNotIn("password", response.content.decode())

    def test_wrong_password_and_unknown_email_give_same_message(self):
        make_user("approved@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        wrong_pw = self.client.post(
            FARMER_LOGIN_URL,
            {"email": "approved@example.com", "password": "WrongPassword123!"},
            format="json",
        )
        unknown = self.client.post(
            FARMER_LOGIN_URL,
            {"email": "nobody@example.com", "password": "WrongPassword123!"},
            format="json",
        )
        self.assertEqual(wrong_pw.data["detail"], unknown.data["detail"])


class RoleSeparationTests(APITestCase):
    def test_lgu_officer_cannot_use_farmer_login(self):
        make_user("officer@example.com", UserRole.LGU_OFFICER, AccountStatus.APPROVED)
        response = self.client.post(
            FARMER_LOGIN_URL,
            {"email": "officer@example.com", "password": "SecurePassword123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_farmer_cannot_use_lgu_login(self):
        make_user("farmer@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        response = self.client.post(
            LGU_LOGIN_URL,
            {"email": "farmer@example.com", "password": "SecurePassword123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_farmer_cannot_use_admin_login(self):
        make_user("farmer@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        response = self.client.post(
            ADMIN_LOGIN_URL,
            {"email": "farmer@example.com", "password": "SecurePassword123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_approved_lgu_officer_can_use_lgu_login(self):
        make_user("officer@example.com", UserRole.LGU_OFFICER, AccountStatus.APPROVED)
        response = self.client.post(
            LGU_LOGIN_URL,
            {"email": "officer@example.com", "password": "SecurePassword123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["role"], "LGU_OFFICER")


class AdminEndpointPermissionTests(APITestCase):
    def setUp(self):
        self.farmer = make_user("farmer@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        self.officer = make_user("officer@example.com", UserRole.LGU_OFFICER, AccountStatus.APPROVED)
        self.admin = make_user("admin@example.com", UserRole.ADMIN, AccountStatus.APPROVED)

    def _login(self, url, email):
        response = self.client.post(
            url, {"email": email, "password": "SecurePassword123!"}, format="json"
        )
        return response.data["access"]

    def test_farmer_cannot_list_users(self):
        token = self._login(FARMER_LOGIN_URL, "farmer@example.com")
        response = self.client.get(ADMIN_USERS_URL, HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_lgu_officer_cannot_list_users(self):
        token = self._login(LGU_LOGIN_URL, "officer@example.com")
        response = self.client.get(ADMIN_USERS_URL, HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_farmer_cannot_approve_accounts(self):
        token = self._login(FARMER_LOGIN_URL, "farmer@example.com")
        target = make_user("pending@example.com", UserRole.FARMER, AccountStatus.PENDING)
        response = self.client.patch(
            f"/api/admin/farmers/{target.id}/approve/", HTTP_AUTHORIZATION=f"Bearer {token}"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        target.refresh_from_db()
        self.assertEqual(target.account_status, AccountStatus.PENDING)

    def test_farmer_cannot_create_lgu_officer(self):
        token = self._login(FARMER_LOGIN_URL, "farmer@example.com")
        response = self.client.post(
            ADMIN_LGU_CREATE_URL,
            {
                "first_name": "New",
                "last_name": "Officer",
                "email": "new.officer@example.com",
                "password": "SecurePassword123!",
            },
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(User.objects.filter(email="new.officer@example.com").exists())

    def test_unauthenticated_cannot_list_users(self):
        response = self.client.get(ADMIN_USERS_URL)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class AdminAccountManagementTests(APITestCase):
    def setUp(self):
        make_user("admin@example.com", UserRole.ADMIN, AccountStatus.APPROVED)
        response = self.client.post(
            ADMIN_LOGIN_URL,
            {"email": "admin@example.com", "password": "SecurePassword123!"},
            format="json",
        )
        self.token = response.data["access"]
        self.auth = {"HTTP_AUTHORIZATION": f"Bearer {self.token}"}

    def test_admin_approves_pending_farmer(self):
        farmer = make_user("pending@example.com", UserRole.FARMER, AccountStatus.PENDING)
        response = self.client.patch(f"/api/admin/farmers/{farmer.id}/approve/", **self.auth)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        farmer.refresh_from_db()
        self.assertEqual(farmer.account_status, AccountStatus.APPROVED)

    def test_admin_rejects_pending_farmer(self):
        farmer = make_user("pending@example.com", UserRole.FARMER, AccountStatus.PENDING)
        response = self.client.patch(f"/api/admin/farmers/{farmer.id}/reject/", **self.auth)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        farmer.refresh_from_db()
        self.assertEqual(farmer.account_status, AccountStatus.REJECTED)

    def test_admin_suspends_approved_farmer(self):
        farmer = make_user("approved@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        response = self.client.patch(f"/api/admin/farmers/{farmer.id}/suspend/", **self.auth)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        farmer.refresh_from_db()
        self.assertEqual(farmer.account_status, AccountStatus.SUSPENDED)

    def test_admin_reactivates_suspended_farmer(self):
        farmer = make_user("suspended@example.com", UserRole.FARMER, AccountStatus.SUSPENDED)
        response = self.client.patch(f"/api/admin/farmers/{farmer.id}/approve/", **self.auth)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        farmer.refresh_from_db()
        self.assertEqual(farmer.account_status, AccountStatus.APPROVED)

    def test_admin_can_approve_a_previously_rejected_farmer(self):
        """An Admin must be able to reverse a mistaken rejection."""
        farmer = make_user("rejected@example.com", UserRole.FARMER, AccountStatus.REJECTED)
        response = self.client.patch(f"/api/admin/farmers/{farmer.id}/approve/", **self.auth)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        farmer.refresh_from_db()
        self.assertEqual(farmer.account_status, AccountStatus.APPROVED)

    def test_cannot_re_approve_an_already_approved_farmer(self):
        farmer = make_user("approved@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        response = self.client.patch(f"/api/admin/farmers/{farmer.id}/approve/", **self.auth)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_suspend_a_pending_farmer(self):
        farmer = make_user("pending@example.com", UserRole.FARMER, AccountStatus.PENDING)
        response = self.client.patch(f"/api/admin/farmers/{farmer.id}/suspend/", **self.auth)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        farmer.refresh_from_db()
        self.assertEqual(farmer.account_status, AccountStatus.PENDING)

    def test_admin_creates_approved_lgu_officer(self):
        response = self.client.post(
            ADMIN_LGU_CREATE_URL,
            {
                "first_name": "New",
                "last_name": "Officer",
                "email": "new.officer@example.com",
                "password": "SecurePassword123!",
            },
            format="json",
            **self.auth,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        officer = User.objects.get(email="new.officer@example.com")
        self.assertEqual(officer.role, UserRole.LGU_OFFICER)
        self.assertEqual(officer.account_status, AccountStatus.APPROVED)
        self.assertTrue(officer.check_password("SecurePassword123!"))

    def test_a_normal_signup_creates_nothing_for_an_admin_to_action(self):
        """
        Signups are approved on creation, so there is nothing waiting. The
        endpoint still exists for accounts an Admin has put back to PENDING.
        """
        self.client.post(SIGNUP_URL, VALID_SIGNUP, format="json")
        response = self.client.get("/api/admin/registrations/", **self.auth)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_admin_still_sees_an_account_moved_back_to_pending(self):
        signup_and_verify(self.client, VALID_SIGNUP)
        farmer = User.objects.get(email="juan@example.com")
        farmer.account_status = AccountStatus.PENDING
        farmer.save()

        response = self.client.get("/api/admin/registrations/", **self.auth)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["user"]["email"], "juan@example.com")

    def test_notification_cleared_after_approval(self):
        signup_and_verify(self.client, VALID_SIGNUP)
        farmer = User.objects.get(email="juan@example.com")
        # Approval only means something for an account that is not already
        # approved, which now takes an Admin putting it back.
        farmer.account_status = AccountStatus.PENDING
        farmer.save()
        self.client.patch(f"/api/admin/farmers/{farmer.id}/approve/", **self.auth)
        response = self.client.get("/api/admin/registrations/", **self.auth)
        self.assertEqual(len(response.data), 0)

    def test_admin_can_filter_users_by_role_and_status(self):
        make_user("f1@example.com", UserRole.FARMER, AccountStatus.PENDING)
        make_user("f2@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        make_user("o1@example.com", UserRole.LGU_OFFICER, AccountStatus.APPROVED)

        pending = self.client.get(f"{ADMIN_USERS_URL}?role=FARMER&status=PENDING", **self.auth)
        self.assertEqual(len(pending.data), 1)
        self.assertEqual(pending.data[0]["email"], "f1@example.com")

        officers = self.client.get(f"{ADMIN_USERS_URL}?role=LGU_OFFICER", **self.auth)
        self.assertEqual(len(officers.data), 1)


class SuspensionRevokesAccessTests(APITestCase):
    """Scenario C — suspending an account invalidates live access immediately."""

    def test_suspended_user_access_token_is_rejected(self):
        farmer = make_user("approved@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        login = self.client.post(
            FARMER_LOGIN_URL,
            {"email": "approved@example.com", "password": "SecurePassword123!"},
            format="json",
        )
        token = login.data["access"]

        ok = self.client.get(ME_URL, HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(ok.status_code, status.HTTP_200_OK)

        farmer.account_status = AccountStatus.SUSPENDED
        farmer.save(update_fields=["account_status"])

        # Same still-unexpired token must now be refused.
        blocked = self.client.get(ME_URL, HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)

    def test_suspended_user_cannot_refresh_session(self):
        farmer = make_user("approved@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        self.client.post(
            FARMER_LOGIN_URL,
            {"email": "approved@example.com", "password": "SecurePassword123!"},
            format="json",
        )
        farmer.account_status = AccountStatus.SUSPENDED
        farmer.save(update_fields=["account_status"])

        response = self.client.post(REFRESH_URL)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class MeEndpointTests(APITestCase):
    def test_me_requires_authentication(self):
        response = self.client.get(ME_URL)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_authenticated_identity_without_secrets(self):
        make_user("approved@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        login = self.client.post(
            FARMER_LOGIN_URL,
            {"email": "approved@example.com", "password": "SecurePassword123!"},
            format="json",
        )
        response = self.client.get(ME_URL, HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "approved@example.com")
        self.assertNotIn("password", response.content.decode())

    def test_me_reflects_the_requesting_user_only(self):
        """A token belonging to Farmer A never returns Farmer B's identity."""
        make_user("a@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        make_user("b@example.com", UserRole.FARMER, AccountStatus.APPROVED)

        login_a = self.client.post(
            FARMER_LOGIN_URL,
            {"email": "a@example.com", "password": "SecurePassword123!"},
            format="json",
        )
        response = self.client.get(ME_URL, HTTP_AUTHORIZATION=f"Bearer {login_a.data['access']}")
        self.assertEqual(response.data["email"], "a@example.com")


class LogoutTests(APITestCase):
    def test_logout_blacklists_refresh_token(self):
        make_user("approved@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        self.client.post(
            FARMER_LOGIN_URL,
            {"email": "approved@example.com", "password": "SecurePassword123!"},
            format="json",
        )
        logout = self.client.post("/api/auth/logout/")
        self.assertEqual(logout.status_code, status.HTTP_200_OK)

        refresh = self.client.post(REFRESH_URL)
        self.assertEqual(refresh.status_code, status.HTTP_401_UNAUTHORIZED)


class NoPublicPrivilegedSignupTests(APITestCase):
    def test_there_is_no_public_lgu_signup_endpoint(self):
        response = self.client.post(
            "/api/auth/lgu/signup/",
            {"email": "x@example.com", "password": "SecurePassword123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_there_is_no_public_admin_signup_endpoint(self):
        response = self.client.post(
            "/api/auth/admin/signup/",
            {"email": "x@example.com", "password": "SecurePassword123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class RefreshCookieLifetimeTests(APITestCase):
    """
    The refresh cookie is a session cookie: closing the browser must sign the
    user out, so reopening it lands on the public site instead of back inside
    a Farmer, LGU or Admin account nobody logged out of.
    """

    def assert_session_cookie(self, response):
        cookie = response.cookies[settings.REFRESH_COOKIE_NAME]
        self.assertTrue(cookie.value)
        self.assertEqual(cookie["max-age"], "")
        self.assertEqual(cookie["expires"], "")

    def test_login_sets_a_session_cookie(self):
        make_user("approved@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        response = self.client.post(
            FARMER_LOGIN_URL,
            {"email": "approved@example.com", "password": "SecurePassword123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assert_session_cookie(response)

    def test_refresh_keeps_it_a_session_cookie(self):
        make_user("approved@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        self.client.post(
            FARMER_LOGIN_URL,
            {"email": "approved@example.com", "password": "SecurePassword123!"},
            format="json",
        )
        response = self.client.post(REFRESH_URL, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assert_session_cookie(response)


# The test settings make the "throttle" cache count nothing; these tests
# give it a real one.
@override_settings(
    CACHES={
        "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"},
        "throttle": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "login-rate-limit-tests",
        },
    }
)
class LoginRateLimitTests(APITestCase):
    def setUp(self):
        caches["throttle"].clear()
        make_user("admin@example.com", UserRole.ADMIN, AccountStatus.APPROVED)

    def test_wrong_passwords_for_one_account_are_cut_off(self):
        wrong = {"email": "admin@example.com", "password": "guess"}
        for _ in range(5):
            response = self.client.post(ADMIN_LOGIN_URL, wrong, format="json")
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        response = self.client.post(ADMIN_LOGIN_URL, wrong, format="json")
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(
            response.data["detail"],
            "Too many sign-in attempts. Please wait 1 minute and try again.",
        )
        self.assertIn("Retry-After", response)

        # Even the right password waits: the limit is on the account.
        right = {"email": "admin@example.com", "password": "SecurePassword123!"}
        response = self.client.post(ADMIN_LOGIN_URL, right, format="json")
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_the_account_limit_ignores_email_case(self):
        for i in range(5):
            email = "ADMIN@example.com" if i % 2 else "admin@example.com"
            self.client.post(ADMIN_LOGIN_URL, {"email": email, "password": "x"}, format="json")
        response = self.client.post(
            ADMIN_LOGIN_URL, {"email": "Admin@Example.com", "password": "x"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_other_accounts_can_still_sign_in(self):
        for _ in range(6):
            self.client.post(
                ADMIN_LOGIN_URL, {"email": "admin@example.com", "password": "x"}, format="json"
            )
        make_user("farmer@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        response = self.client.post(
            FARMER_LOGIN_URL,
            {"email": "farmer@example.com", "password": "SecurePassword123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

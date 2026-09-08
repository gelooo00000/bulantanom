from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import AccountStatus, RegistrationNotification, User, UserRole

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
    def test_signup_creates_pending_farmer_and_notification(self):
        response = self.client.post(SIGNUP_URL, VALID_SIGNUP, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(email="juan@example.com")
        self.assertEqual(user.role, UserRole.FARMER)
        self.assertEqual(user.account_status, AccountStatus.PENDING)
        self.assertEqual(RegistrationNotification.objects.filter(user=user).count(), 1)

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
            "account_status": "APPROVED",
            "is_superuser": True,
            "is_staff": True,
        }
        self.client.post(SIGNUP_URL, payload, format="json")
        user = User.objects.get(email="juan@example.com")
        self.assertEqual(user.role, UserRole.FARMER)
        self.assertEqual(user.account_status, AccountStatus.PENDING)
        self.assertFalse(user.is_superuser)
        self.assertFalse(user.is_staff)

    def test_duplicate_email_rejected(self):
        self.client.post(SIGNUP_URL, VALID_SIGNUP, format="json")
        response = self.client.post(SIGNUP_URL, VALID_SIGNUP, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already exists", str(response.data))

    def test_password_mismatch_rejected(self):
        payload = {**VALID_SIGNUP, "password_confirm": "DifferentPassword123!"}
        response = self.client.post(SIGNUP_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


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

    def test_admin_sees_pending_registration_notifications(self):
        self.client.post(SIGNUP_URL, VALID_SIGNUP, format="json")
        response = self.client.get("/api/admin/registrations/", **self.auth)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["user"]["email"], "juan@example.com")

    def test_notification_cleared_after_approval(self):
        self.client.post(SIGNUP_URL, VALID_SIGNUP, format="json")
        farmer = User.objects.get(email="juan@example.com")
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

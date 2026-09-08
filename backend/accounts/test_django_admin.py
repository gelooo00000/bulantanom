"""
Django Admin as the LGU Officer provisioning interface.

These drive the actual admin views over HTTP (not the model layer), so they
cover what an administrator really does in the browser: open the LGU Officers
screen, fill the add form, save, and have that account sign in to BulanTanom.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import AccountStatus, Farmer, LguOfficer, User, UserRole

PW = "SecurePassword123!"
LGU_ADD_URL = "/admin/accounts/lguofficer/add/"
LGU_LIST_URL = "/admin/accounts/lguofficer/"
FARMER_LIST_URL = "/admin/accounts/farmer/"
LGU_LOGIN_URL = "/api/auth/lgu/login/"
FARMER_LOGIN_URL = "/api/auth/farmer/login/"

NEW_OFFICER = {
    "email": "test.officer@layuan.gov.ph",
    "first_name": "Test",
    "last_name": "Officer",
    "password1": "OfficerPass123!",
    "password2": "OfficerPass123!",
}


def make_superuser(email="root@example.com"):
    return User.objects.create_superuser(email=email, password=PW, first_name="Root", last_name="Admin")


def make_user(email, role=UserRole.FARMER, account_status=AccountStatus.APPROVED, **extra):
    return User.objects.create_user(
        email=email, password=PW, first_name="Test", last_name="User",
        role=role, account_status=account_status, **extra,
    )


class AdminSiteAccessTests(TestCase):
    """Test 5 — a BulanTanom role is not a Django Admin role."""

    def test_lgu_officer_cannot_open_django_admin(self):
        make_user("officer@example.com", UserRole.LGU_OFFICER)
        self.assertTrue(self.client.login(username="officer@example.com", password=PW))

        response = self.client.get(LGU_LIST_URL)
        # Non-staff users are bounced to the admin login, never shown the app.
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertIn("/admin/login/", response.url)

    def test_farmer_cannot_open_django_admin(self):
        make_user("farmer@example.com", UserRole.FARMER)
        self.client.login(username="farmer@example.com", password=PW)
        response = self.client.get(FARMER_LIST_URL)
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertIn("/admin/login/", response.url)

    def test_anonymous_cannot_open_django_admin(self):
        response = self.client.get(LGU_ADD_URL)
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertIn("/admin/login/", response.url)

    def test_superuser_can_open_the_lgu_officer_screens(self):
        make_superuser()
        self.client.login(username="root@example.com", password=PW)
        self.assertEqual(self.client.get(LGU_LIST_URL).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(LGU_ADD_URL).status_code, status.HTTP_200_OK)


class LguOfficerCreationTests(TestCase):
    """Test 1 — creating an officer through the admin add form."""

    def setUp(self):
        super().setUp()
        self.admin = make_superuser()
        self.client.login(username="root@example.com", password=PW)

    def test_1_admin_creates_an_lgu_officer(self):
        response = self.client.post(LGU_ADD_URL, NEW_OFFICER, follow=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        officer = User.objects.get(email="test.officer@layuan.gov.ph")
        self.assertEqual(officer.role, UserRole.LGU_OFFICER)
        self.assertEqual(officer.account_status, AccountStatus.APPROVED)
        self.assertTrue(officer.is_active)
        self.assertTrue(officer.can_sign_in)

    def test_password_is_hashed_never_stored_in_plain_text(self):
        self.client.post(LGU_ADD_URL, NEW_OFFICER, follow=True)
        officer = User.objects.get(email="test.officer@layuan.gov.ph")

        self.assertNotEqual(officer.password, NEW_OFFICER["password1"])
        self.assertTrue(officer.password.startswith(("pbkdf2_", "argon2", "bcrypt")))
        self.assertTrue(officer.check_password(NEW_OFFICER["password1"]))

    def test_new_officer_gets_no_django_admin_access(self):
        """Section 9 — role = LGU Officer must not imply is_staff."""
        self.client.post(LGU_ADD_URL, NEW_OFFICER, follow=True)
        officer = User.objects.get(email="test.officer@layuan.gov.ph")
        self.assertFalse(officer.is_staff)
        self.assertFalse(officer.is_superuser)

    def test_mismatched_passwords_are_rejected(self):
        payload = {**NEW_OFFICER, "password2": "SomethingElse123!"}
        response = self.client.post(LGU_ADD_URL, payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)  # redisplayed form
        self.assertFalse(User.objects.filter(email=NEW_OFFICER["email"]).exists())

    def test_weak_passwords_are_rejected(self):
        payload = {**NEW_OFFICER, "password1": "12345678", "password2": "12345678"}
        self.client.post(LGU_ADD_URL, payload)
        self.assertFalse(User.objects.filter(email=NEW_OFFICER["email"]).exists())

    def test_duplicate_email_is_rejected(self):
        make_user("test.officer@layuan.gov.ph", UserRole.FARMER)
        self.client.post(LGU_ADD_URL, NEW_OFFICER)
        self.assertEqual(User.objects.filter(email__iexact=NEW_OFFICER["email"]).count(), 1)
        self.assertEqual(
            User.objects.get(email__iexact=NEW_OFFICER["email"]).role, UserRole.FARMER
        )

    def test_email_is_normalised_to_lowercase(self):
        self.client.post(LGU_ADD_URL, {**NEW_OFFICER, "email": "MiXeD@Layuan.Gov.PH"}, follow=True)
        self.assertTrue(User.objects.filter(email="mixed@layuan.gov.ph").exists())

    def test_role_cannot_be_overridden_through_the_form(self):
        """The screen sets the role; a posted `role` field must be ignored."""
        self.client.post(LGU_ADD_URL, {**NEW_OFFICER, "role": UserRole.ADMIN}, follow=True)
        officer = User.objects.get(email=NEW_OFFICER["email"])
        self.assertEqual(officer.role, UserRole.LGU_OFFICER)

    def test_farmer_screen_creates_pending_farmers(self):
        """Admin-created Farmers still go through the approval workflow."""
        self.client.post(
            "/admin/accounts/farmer/add/",
            {**NEW_OFFICER, "email": "new.farmer@example.com"},
            follow=True,
        )
        farmer = User.objects.get(email="new.farmer@example.com")
        self.assertEqual(farmer.role, UserRole.FARMER)
        self.assertEqual(farmer.account_status, AccountStatus.PENDING)
        self.assertFalse(farmer.is_staff)


class ProxyScopingTests(TestCase):
    """The role-scoped screens must not leak accounts across roles."""

    def setUp(self):
        super().setUp()
        make_superuser()
        self.client.login(username="root@example.com", password=PW)
        self.farmer = make_user("farmer@example.com", UserRole.FARMER)
        self.officer = make_user("officer@example.com", UserRole.LGU_OFFICER)

    def test_managers_filter_by_role(self):
        self.assertEqual(list(Farmer.objects.all()), [self.farmer])
        self.assertEqual(list(LguOfficer.objects.all()), [self.officer])

    def test_proxies_share_the_one_user_table(self):
        self.assertEqual(Farmer._meta.db_table, User._meta.db_table)
        self.assertEqual(LguOfficer._meta.db_table, User._meta.db_table)
        self.assertTrue(Farmer._meta.proxy and LguOfficer._meta.proxy)

    def test_lgu_screen_lists_only_officers(self):
        body = self.client.get(LGU_LIST_URL).content.decode()
        self.assertIn("officer@example.com", body)
        self.assertNotIn("farmer@example.com", body)

    def test_farmer_screen_lists_only_farmers(self):
        body = self.client.get(FARMER_LIST_URL).content.decode()
        self.assertIn("farmer@example.com", body)
        self.assertNotIn("officer@example.com", body)

    def test_editing_an_officer_keeps_the_role(self):
        url = f"/admin/accounts/lguofficer/{self.officer.pk}/change/"
        response = self.client.post(
            url,
            {
                "email": "officer@example.com",
                "first_name": "Renamed",
                "last_name": "Officer",
                "account_status": AccountStatus.APPROVED,
                "is_active": "on",
                "date_joined_0": "2026-01-01",
                "date_joined_1": "00:00:00",
            },
            follow=True,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.officer.refresh_from_db()
        self.assertEqual(self.officer.role, UserRole.LGU_OFFICER)


class AdminCreatedOfficerCanSignInTests(APITestCase):
    """Test 2 — the account works against the existing auth API, unchanged."""

    def setUp(self):
        super().setUp()
        make_superuser()
        self.client.login(username="root@example.com", password=PW)
        self.client.post(LGU_ADD_URL, NEW_OFFICER, follow=True)
        self.client.logout()

    def test_2_officer_logs_in_through_the_existing_lgu_endpoint(self):
        response = self.client.post(
            LGU_LOGIN_URL,
            {"email": NEW_OFFICER["email"], "password": NEW_OFFICER["password1"]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["role"], "LGU_OFFICER")
        self.assertIn("access", response.data)

    def test_officer_reaches_the_lgu_dashboard_api(self):
        token = self.client.post(
            LGU_LOGIN_URL,
            {"email": NEW_OFFICER["email"], "password": NEW_OFFICER["password1"]},
            format="json",
        ).data["access"]
        auth = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        self.assertEqual(
            self.client.get("/api/lgu/dashboard/", **auth).status_code, status.HTTP_200_OK
        )

    def test_4_officer_cannot_use_farmer_endpoints(self):
        token = self.client.post(
            LGU_LOGIN_URL,
            {"email": NEW_OFFICER["email"], "password": NEW_OFFICER["password1"]},
            format="json",
        ).data["access"]
        auth = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        self.assertEqual(
            self.client.get("/api/farmer/plants/", **auth).status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_10_officer_cannot_use_admin_endpoints(self):
        token = self.client.post(
            LGU_LOGIN_URL,
            {"email": NEW_OFFICER["email"], "password": NEW_OFFICER["password1"]},
            format="json",
        ).data["access"]
        auth = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        self.assertEqual(
            self.client.get("/api/admin/users/", **auth).status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_officer_cannot_sign_in_through_the_farmer_endpoint(self):
        response = self.client.post(
            FARMER_LOGIN_URL,
            {"email": NEW_OFFICER["email"], "password": NEW_OFFICER["password1"]},
            format="json",
        )
        # 401 rather than 403: the farmer endpoint declines without revealing
        # that this email exists under a different role.
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn("access", response.data)


class DeactivationTests(APITestCase):
    """Section 9 — deactivating in the admin must actually block sign-in."""

    def test_inactive_officer_cannot_sign_in(self):
        officer = make_user("officer@example.com", UserRole.LGU_OFFICER)
        officer.is_active = False
        officer.save(update_fields=["is_active"])

        response = self.client.post(
            LGU_LOGIN_URL,
            {"email": "officer@example.com", "password": PW},
            format="json",
        )
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_user_model_is_the_single_identity_model(self):
        """Section 11 — no second user table was introduced."""
        self.assertIs(get_user_model(), User)
        self.assertEqual(
            reverse("admin:accounts_lguofficer_changelist"), LGU_LIST_URL
        )

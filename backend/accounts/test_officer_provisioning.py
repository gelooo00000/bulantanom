"""
Admin-controlled provisioning of LGU Officer accounts.

LGU Officers have no public registration path, so the only way an account can
exist is an Admin creating one. These tests pin that: who may create, what is
rejected, and that the password never leaves Django in a readable form.
"""

from django.test import override_settings
from django.urls import get_resolver
from rest_framework import status
from rest_framework.test import APITestCase, APITransactionTestCase

from notifications.models import Notification

from .models import AccountStatus, User, UserRole

CREATE_URL = "/api/admin/lgu-officers/"
USERS_URL = "/api/admin/users/"
FARMER_LOGIN_URL = "/api/auth/farmer/login/"
LGU_LOGIN_URL = "/api/auth/lgu/login/"
ADMIN_LOGIN_URL = "/api/auth/admin/login/"
PW = "SecurePassword123!"

NEW_OFFICER = {
    "first_name": "Maria",
    "last_name": "Santos",
    "email": "maria.santos@example.com",
    "password": PW,
}


def make_user(email, role=UserRole.FARMER, status_=AccountStatus.APPROVED):
    return User.objects.create_user(
        email=email, password=PW, first_name="Test", last_name="User",
        role=role, account_status=status_,
    )


class OfficerSetupMixin:
    def setUp(self):
        self.admin = make_user("admin@example.com", UserRole.ADMIN)
        self.officer = make_user("officer@example.com", UserRole.LGU_OFFICER)
        self.farmer = make_user("farmer@example.com")

    def auth(self, email, url=ADMIN_LOGIN_URL):
        token = self.client.post(
            url, {"email": email, "password": PW}, format="json"
        ).data["access"]
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


class OfficerCreationTests(OfficerSetupMixin, APITestCase):
    def create(self, payload=None, as_email="admin@example.com", url=ADMIN_LOGIN_URL):
        return self.client.post(
            CREATE_URL, payload or NEW_OFFICER, format="json", **self.auth(as_email, url)
        )

    # --------------------------------------------------------- authorization

    def test_admin_can_create_an_officer(self):
        response = self.create()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = User.objects.get(email="maria.santos@example.com")
        self.assertEqual(created.role, UserRole.LGU_OFFICER)
        self.assertEqual(created.account_status, AccountStatus.APPROVED)

    def test_farmer_cannot_create_an_officer(self):
        response = self.create(as_email="farmer@example.com", url=FARMER_LOGIN_URL)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(User.objects.filter(email=NEW_OFFICER["email"]).exists())

    def test_officer_cannot_create_another_officer(self):
        response = self.create(as_email="officer@example.com", url=LGU_LOGIN_URL)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(User.objects.filter(email=NEW_OFFICER["email"]).exists())

    def test_unauthenticated_cannot_create_an_officer(self):
        response = self.client.post(CREATE_URL, NEW_OFFICER, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(User.objects.filter(email=NEW_OFFICER["email"]).exists())

    # ------------------------------------------------------------ validation

    def test_duplicate_email_is_rejected(self):
        self.create()
        response = self.create()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            User.objects.filter(email=NEW_OFFICER["email"]).count(), 1
        )

    def test_duplicate_email_is_rejected_case_insensitively(self):
        self.create()
        response = self.create(dict(NEW_OFFICER, email="MARIA.SANTOS@EXAMPLE.COM"))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_email_of_an_existing_farmer_is_rejected(self):
        response = self.create(dict(NEW_OFFICER, email="farmer@example.com"))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            User.objects.get(email="farmer@example.com").role, UserRole.FARMER
        )

    def test_weak_password_is_rejected(self):
        response = self.create(dict(NEW_OFFICER, password="password"))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email=NEW_OFFICER["email"]).exists())

    def test_client_cannot_choose_role_or_status(self):
        """Both are set server-side; extra keys are dropped by the serializer."""
        response = self.create(
            dict(NEW_OFFICER, role="ADMIN", account_status="PENDING")
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = User.objects.get(email=NEW_OFFICER["email"])
        self.assertEqual(created.role, UserRole.LGU_OFFICER)
        self.assertEqual(created.account_status, AccountStatus.APPROVED)

    # -------------------------------------------------------------- password

    # The suite runs under a deliberately cheap hasher for speed (see
    # config/test_runner.py). This test is about the real one, so it pins
    # PBKDF2 as *preferred*, which is what set_password will then use.
    # MD5 stays in the list because users built in setUp were hashed with
    # it, and dropping it would lock them out of their own login helper.
    @override_settings(
        PASSWORD_HASHERS=[
            "django.contrib.auth.hashers.PBKDF2PasswordHasher",
            "django.contrib.auth.hashers.MD5PasswordHasher",
        ]
    )
    def test_password_is_hashed_not_stored_in_plaintext(self):
        self.create()
        created = User.objects.get(email=NEW_OFFICER["email"])
        self.assertNotEqual(created.password, PW)
        self.assertTrue(created.password.startswith("pbkdf2_"))
        self.assertTrue(created.check_password(PW))

    def test_password_is_never_returned_by_the_api(self):
        response = self.create()
        body = response.content.decode()
        self.assertNotIn(PW, body)
        self.assertNotIn("password", body)
        self.assertNotIn("pbkdf2", body)

    # ------------------------------------------------------------- usability

    def test_created_officer_can_log_in(self):
        self.create()
        response = self.client.post(
            LGU_LOGIN_URL,
            {"email": NEW_OFFICER["email"], "password": PW},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertEqual(response.data["user"]["role"], "LGU_OFFICER")

    def test_created_officer_cannot_use_the_farmer_login(self):
        self.create()
        response = self.client.post(
            FARMER_LOGIN_URL,
            {"email": NEW_OFFICER["email"], "password": PW},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_created_officer_can_reach_the_lgu_dashboard(self):
        self.create()
        token = self.client.post(
            LGU_LOGIN_URL,
            {"email": NEW_OFFICER["email"], "password": PW},
            format="json",
        ).data["access"]
        response = self.client.get(
            "/api/lgu/dashboard/", HTTP_AUTHORIZATION=f"Bearer {token}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_suspended_officer_cannot_reach_protected_endpoints(self):
        self.create()
        created = User.objects.get(email=NEW_OFFICER["email"])
        token = self.client.post(
            LGU_LOGIN_URL,
            {"email": NEW_OFFICER["email"], "password": PW},
            format="json",
        ).data["access"]
        headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"}

        self.client.patch(
            f"/api/admin/officers/{created.id}/suspend/", **self.auth("admin@example.com")
        )
        # The permission layer re-reads account_status, so the existing token
        # stops working without any frontend involvement.
        self.assertEqual(
            self.client.get("/api/lgu/dashboard/", **headers).status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_reactivated_officer_can_log_in_again(self):
        self.create()
        created = User.objects.get(email=NEW_OFFICER["email"])
        admin_headers = self.auth("admin@example.com")
        self.client.patch(f"/api/admin/officers/{created.id}/suspend/", **admin_headers)
        self.assertEqual(
            self.client.post(
                LGU_LOGIN_URL,
                {"email": NEW_OFFICER["email"], "password": PW},
                format="json",
            ).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        self.client.patch(
            f"/api/admin/officers/{created.id}/reactivate/", **admin_headers
        )
        self.assertEqual(
            self.client.post(
                LGU_LOGIN_URL,
                {"email": NEW_OFFICER["email"], "password": PW},
                format="json",
            ).status_code,
            status.HTTP_200_OK,
        )

    # -------------------------------------------------------------- listing

    def test_admin_can_list_officers(self):
        self.create()
        response = self.client.get(
            f"{USERS_URL}?role=LGU_OFFICER", **self.auth("admin@example.com")
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        emails = {row["email"] for row in response.data}
        self.assertIn(NEW_OFFICER["email"], emails)

    def test_farmer_cannot_list_accounts(self):
        response = self.client.get(
            USERS_URL, **self.auth("farmer@example.com", FARMER_LOGIN_URL)
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_officer_cannot_list_accounts(self):
        response = self.client.get(
            USERS_URL, **self.auth("officer@example.com", LGU_LOGIN_URL)
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class NoPublicOfficerRegistrationTests(APITestCase):
    """
    There must be no unauthenticated route that can mint an Officer. Farmer
    signup is the only public account-creating endpoint in the project.
    """

    def test_farmer_signup_cannot_produce_an_officer(self):
        response = self.client.post(
            "/api/auth/farmer/signup/",
            {
                "first_name": "Sneaky", "last_name": "User",
                "email": "sneaky@example.com", "password": PW,
                "password_confirm": PW,
                "role": "LGU_OFFICER",
                "account_status": "APPROVED",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = User.objects.get(email="sneaky@example.com")
        self.assertEqual(created.role, UserRole.FARMER)
        self.assertEqual(created.account_status, AccountStatus.PENDING)

    def test_the_only_public_signup_route_is_farmer(self):
        """Guards against a public officer-registration route being added."""
        signup_routes = []

        def walk(resolver, prefix=""):
            for pattern in resolver.url_patterns:
                path = prefix + str(pattern.pattern)
                if hasattr(pattern, "url_patterns"):
                    walk(pattern, path)
                elif "signup" in path or "register" in path:
                    signup_routes.append(path)

        walk(get_resolver())
        self.assertEqual(signup_routes, ["api/auth/farmer/signup/"])


class OfficerCreationNotificationTests(OfficerSetupMixin, APITransactionTestCase):
    """Notifications need a real COMMIT — see notifications/tests.py."""

    def test_created_officer_is_notified_without_the_password(self):
        self.client.post(
            CREATE_URL, NEW_OFFICER, format="json", **self.auth("admin@example.com")
        )
        created = User.objects.get(email=NEW_OFFICER["email"])
        row = Notification.objects.filter(recipient=created).first()

        self.assertIsNotNone(row)
        self.assertIn("created by an administrator", row.message.lower())
        # The password must never travel through a notification.
        self.assertNotIn(PW, row.message)
        self.assertNotIn(PW, str(row.metadata))

    def test_admins_get_an_audit_copy(self):
        self.client.post(
            CREATE_URL, NEW_OFFICER, format="json", **self.auth("admin@example.com")
        )
        row = Notification.objects.filter(
            recipient=self.admin, title="LGU Officer Created"
        ).first()
        self.assertIsNotNone(row)
        self.assertIn("Maria Santos", row.message)

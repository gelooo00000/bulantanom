"""
Admin management and admin-facing notification tests.

Covers the parts that were previously unpinned: that only an Admin can reach
the admin surface, that account transitions are validated server-side rather
than trusted from the client, and that the people who need to know about a
status change are actually told — a rejected or suspended Farmer used to be
given no explanation at all.
"""

from rest_framework import status
from rest_framework.test import APITestCase, APITransactionTestCase

from notifications.models import Notification

from .models import AccountStatus, User, UserRole

DASHBOARD_URL = "/api/admin/dashboard/"
USERS_URL = "/api/admin/users/"
ADMIN_NOTIFICATIONS_URL = "/api/admin/notifications/"
ADMIN_UNREAD_URL = "/api/admin/notifications/unread-count/"
REGISTRATIONS_URL = "/api/admin/registrations/"
SIGNUP_URL = "/api/auth/farmer/signup/"
FARMER_LOGIN_URL = "/api/auth/farmer/login/"
LGU_LOGIN_URL = "/api/auth/lgu/login/"
ADMIN_LOGIN_URL = "/api/auth/admin/login/"
PW = "SecurePassword123!"


def make_user(email, role=UserRole.FARMER, status_=AccountStatus.APPROVED):
    return User.objects.create_user(
        email=email, password=PW, first_name="Test", last_name="User",
        role=role, account_status=status_,
    )


class AdminSetupMixin:
    def setUp(self):
        self.admin = make_user("admin@example.com", UserRole.ADMIN)
        self.officer = make_user("officer@example.com", UserRole.LGU_OFFICER)
        self.farmer = make_user("farmer@example.com")

    def auth(self, email, url=ADMIN_LOGIN_URL):
        token = self.client.post(
            url, {"email": email, "password": PW}, format="json"
        ).data["access"]
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


class AdminTestCase(AdminSetupMixin, APITestCase):
    """Non-notification tests — the fast, rolled-back base."""


class AdminNotificationTestCase(AdminSetupMixin, APITransactionTestCase):
    """
    Notification assertions need a real COMMIT, because every notifier is
    queued with `transaction.on_commit` so a rolled-back action notifies
    nobody. Matches the convention in notifications/tests.py.
    """


class AdminAuthorizationTests(AdminTestCase):
    """The admin surface is closed to every other role."""

    def test_admin_can_reach_the_dashboard(self):
        response = self.client.get(DASHBOARD_URL, **self.auth("admin@example.com"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unauthenticated_cannot_reach_admin_endpoints(self):
        for url in (DASHBOARD_URL, USERS_URL, ADMIN_NOTIFICATIONS_URL):
            self.assertEqual(
                self.client.get(url).status_code,
                status.HTTP_401_UNAUTHORIZED,
                url,
            )

    def test_farmer_cannot_reach_admin_endpoints(self):
        headers = self.auth("farmer@example.com", FARMER_LOGIN_URL)
        for url in (DASHBOARD_URL, USERS_URL, ADMIN_NOTIFICATIONS_URL, REGISTRATIONS_URL):
            self.assertEqual(
                self.client.get(url, **headers).status_code,
                status.HTTP_403_FORBIDDEN,
                url,
            )

    def test_officer_cannot_reach_admin_endpoints(self):
        headers = self.auth("officer@example.com", LGU_LOGIN_URL)
        for url in (DASHBOARD_URL, USERS_URL, ADMIN_NOTIFICATIONS_URL, REGISTRATIONS_URL):
            self.assertEqual(
                self.client.get(url, **headers).status_code,
                status.HTTP_403_FORBIDDEN,
                url,
            )

    def test_farmer_cannot_change_account_status(self):
        target = make_user("target@example.com", status_=AccountStatus.PENDING)
        response = self.client.patch(
            f"/api/admin/farmers/{target.id}/approve/",
            **self.auth("farmer@example.com", FARMER_LOGIN_URL),
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        target.refresh_from_db()
        self.assertEqual(target.account_status, AccountStatus.PENDING)


class AdminDashboardTests(AdminTestCase):
    """Every figure is counted in MySQL, never supplied by the client."""

    def test_counts_reflect_the_database(self):
        make_user("p1@example.com", status_=AccountStatus.PENDING)
        make_user("p2@example.com", status_=AccountStatus.PENDING)
        make_user("s1@example.com", status_=AccountStatus.SUSPENDED)

        data = self.client.get(DASHBOARD_URL, **self.auth("admin@example.com")).data
        self.assertEqual(data["farmers"]["total"], 4)
        self.assertEqual(data["farmers"]["pending"], 2)
        self.assertEqual(data["farmers"]["approved"], 1)
        self.assertEqual(data["farmers"]["suspended"], 1)
        self.assertEqual(data["lgu_officers"], 1)

    def test_unread_count_is_the_callers_own(self):
        """An Admin sees their unread total, not a global one."""
        Notification.objects.create(
            recipient=self.officer, notification_type="SYSTEM",
            title="Not yours", message="x", dedupe_key="other:1",
        )
        data = self.client.get(DASHBOARD_URL, **self.auth("admin@example.com")).data
        self.assertEqual(data["unread_notifications"], 0)


class AdminAccountTransitionTests(AdminTestCase):
    """Status changes are validated on the server, not trusted from the UI."""

    def setUp(self):
        super().setUp()
        self.pending = make_user("pending@example.com", status_=AccountStatus.PENDING)

    def approve(self, user):
        return self.client.patch(
            f"/api/admin/farmers/{user.id}/approve/", **self.auth("admin@example.com")
        )

    def suspend(self, user):
        return self.client.patch(
            f"/api/admin/farmers/{user.id}/suspend/", **self.auth("admin@example.com")
        )

    def reject(self, user):
        return self.client.patch(
            f"/api/admin/farmers/{user.id}/reject/", **self.auth("admin@example.com")
        )

    def test_approve_writes_to_the_database(self):
        response = self.approve(self.pending)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.pending.refresh_from_db()
        self.assertEqual(self.pending.account_status, AccountStatus.APPROVED)

    def test_suspend_writes_to_the_database(self):
        response = self.suspend(self.farmer)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.farmer.refresh_from_db()
        self.assertEqual(self.farmer.account_status, AccountStatus.SUSPENDED)

    def test_invalid_transition_is_refused(self):
        """Suspending a PENDING account is not a legal move."""
        response = self.suspend(self.pending)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.pending.refresh_from_db()
        self.assertEqual(self.pending.account_status, AccountStatus.PENDING)

    def test_suspended_farmer_loses_api_access_immediately(self):
        """
        The permission layer re-reads account_status per request, so a token
        issued before suspension stops working straight away.
        """
        headers = self.auth("farmer@example.com", FARMER_LOGIN_URL)
        self.assertEqual(
            self.client.get("/api/farmer/plants/", **headers).status_code,
            status.HTTP_200_OK,
        )
        self.suspend(self.farmer)
        self.assertEqual(
            self.client.get("/api/farmer/plants/", **headers).status_code,
            status.HTTP_403_FORBIDDEN,
        )


class AdminNotificationTests(AdminNotificationTestCase):
    """Admins are told about the events they are responsible for."""

    def admin_rows(self, **filters):
        return Notification.objects.filter(recipient=self.admin, **filters)

    def farmer_rows(self, user, **filters):
        return Notification.objects.filter(recipient=user, **filters)

    def test_registration_notifies_the_admin(self):
        self.client.post(
            SIGNUP_URL,
            {
                "first_name": "New", "last_name": "Farmer",
                "email": "new@example.com", "password": PW,
                "password_confirm": PW,
            },
            format="json",
        )
        rows = self.admin_rows(notification_type="ACCOUNT_CREATED")
        self.assertEqual(rows.count(), 1)
        self.assertIn("waiting for administrator approval", rows.first().message)

    def test_suspension_notifies_the_farmer_and_the_admin(self):
        self.client.patch(
            f"/api/admin/farmers/{self.farmer.id}/suspend/",
            **self.auth("admin@example.com"),
        )
        farmer_row = self.farmer_rows(
            self.farmer, notification_type="ACCOUNT_SUSPENDED"
        ).first()
        self.assertIsNotNone(farmer_row)
        self.assertIn("suspended", farmer_row.message.lower())
        self.assertEqual(
            self.admin_rows(notification_type="ACCOUNT_SUSPENDED").count(), 1
        )

    def test_rejection_notifies_the_farmer(self):
        pending = make_user("rej@example.com", status_=AccountStatus.PENDING)
        self.client.patch(
            f"/api/admin/farmers/{pending.id}/reject/", **self.auth("admin@example.com")
        )
        row = self.farmer_rows(pending, notification_type="ACCOUNT_REJECTED").first()
        self.assertIsNotNone(row)

    def test_approval_still_notifies_the_farmer(self):
        pending = make_user("app@example.com", status_=AccountStatus.PENDING)
        self.client.patch(
            f"/api/admin/farmers/{pending.id}/approve/", **self.auth("admin@example.com")
        )
        self.assertTrue(
            self.farmer_rows(pending, notification_type="ACCOUNT_APPROVED").exists()
        )

    def test_repeating_a_transition_does_not_duplicate(self):
        """The dedupe key makes a repeated suspension a no-op."""
        for _ in range(3):
            self.client.patch(
                f"/api/admin/farmers/{self.farmer.id}/suspend/",
                **self.auth("admin@example.com"),
            )
        self.assertEqual(
            self.farmer_rows(self.farmer, notification_type="ACCOUNT_SUSPENDED").count(),
            1,
        )

    def test_admin_reads_their_own_notifications_only(self):
        Notification.objects.create(
            recipient=self.officer, notification_type="SYSTEM",
            title="Officer only", message="x", dedupe_key="officer:1",
        )
        data = self.client.get(
            ADMIN_NOTIFICATIONS_URL, **self.auth("admin@example.com")
        ).data
        titles = [row["title"] for row in data["results"]]
        self.assertNotIn("Officer only", titles)

    def test_admin_unread_count_and_mark_all_read(self):
        make_user("x1@example.com", status_=AccountStatus.PENDING)
        self.client.post(
            SIGNUP_URL,
            {
                "first_name": "A", "last_name": "B", "email": "n2@example.com",
                "password": PW, "password_confirm": PW,
            },
            format="json",
        )
        headers = self.auth("admin@example.com")

        before = self.client.get(ADMIN_UNREAD_URL, **headers).data["unread"]
        self.assertGreater(before, 0)

        self.client.post("/api/admin/notifications/read-all/", **headers)
        after = self.client.get(ADMIN_UNREAD_URL, **headers).data["unread"]
        self.assertEqual(after, 0)

    def test_read_state_persists(self):
        """Marking read is a database write, not frontend state."""
        self.client.post(
            SIGNUP_URL,
            {
                "first_name": "A", "last_name": "B", "email": "n3@example.com",
                "password": PW, "password_confirm": PW,
            },
            format="json",
        )
        headers = self.auth("admin@example.com")
        row = self.admin_rows().first()
        self.client.post(f"/api/admin/notifications/{row.id}/read/", **headers)

        row.refresh_from_db()
        self.assertTrue(row.is_read)
        self.assertIsNotNone(row.read_at)

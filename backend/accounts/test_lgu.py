from rest_framework import status
from rest_framework.test import APITestCase

from .models import AccountStatus, User, UserRole

DASHBOARD_URL = "/api/lgu/dashboard/"
FARMERS_URL = "/api/lgu/farmers/"
FARM_URL = "/api/lgu/farm/"

FARMER_LOGIN_URL = "/api/auth/farmer/login/"
LGU_LOGIN_URL = "/api/auth/lgu/login/"
ADMIN_LOGIN_URL = "/api/auth/admin/login/"

PW = "SecurePassword123!"


def make_user(email, role, account_status, first="Test", last="User"):
    return User.objects.create_user(
        email=email,
        password=PW,
        first_name=first,
        last_name=last,
        role=role,
        account_status=account_status,
    )


class LguAuthorizationTests(APITestCase):
    """Section 18 — only authenticated LGU Officers may call LGU endpoints."""

    def setUp(self):
        make_user("officer@example.com", UserRole.LGU_OFFICER, AccountStatus.APPROVED)
        make_user("farmer@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        make_user("admin@example.com", UserRole.ADMIN, AccountStatus.APPROVED)

    def _token(self, url, email):
        return self.client.post(
            url, {"email": email, "password": PW}, format="json"
        ).data["access"]

    def test_unauthenticated_is_rejected(self):
        for url in (DASHBOARD_URL, FARMERS_URL, FARM_URL):
            self.assertEqual(
                self.client.get(url).status_code, status.HTTP_401_UNAUTHORIZED, url
            )

    def test_farmer_cannot_access_lgu_endpoints(self):
        token = self._token(FARMER_LOGIN_URL, "farmer@example.com")
        for url in (DASHBOARD_URL, FARMERS_URL, FARM_URL):
            response = self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {token}")
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, url)

    def test_admin_does_not_get_implicit_lgu_access(self):
        """Section 19 — Admin access stays intentional, not automatic."""
        token = self._token(ADMIN_LOGIN_URL, "admin@example.com")
        response = self.client.get(DASHBOARD_URL, HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_lgu_officer_can_access(self):
        token = self._token(LGU_LOGIN_URL, "officer@example.com")
        response = self.client.get(DASHBOARD_URL, HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_suspended_officer_loses_access(self):
        officer = User.objects.get(email="officer@example.com")
        token = self._token(LGU_LOGIN_URL, "officer@example.com")
        officer.account_status = AccountStatus.SUSPENDED
        officer.save(update_fields=["account_status"])
        response = self.client.get(DASHBOARD_URL, HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class LguDashboardDataTests(APITestCase):
    """The dashboard must mirror MySQL, including when the database is empty."""

    def setUp(self):
        make_user("officer@example.com", UserRole.LGU_OFFICER, AccountStatus.APPROVED)
        token = self.client.post(
            LGU_LOGIN_URL, {"email": "officer@example.com", "password": PW}, format="json"
        ).data["access"]
        self.auth = {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def dashboard(self):
        return self.client.get(DASHBOARD_URL, **self.auth).data

    def test_empty_database_reports_zero_not_fake_numbers(self):
        """Section 21 — an empty database must honestly report 0."""
        data = self.dashboard()
        self.assertEqual(data["farmers"]["active"], 0)
        self.assertEqual(data["farmers"]["total"], 0)

    def test_active_count_reflects_approved_farmers_only(self):
        """Section 4 — only role=FARMER + status=APPROVED counts as active."""
        make_user("a@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        make_user("b@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        make_user("c@example.com", UserRole.FARMER, AccountStatus.PENDING)
        make_user("d@example.com", UserRole.FARMER, AccountStatus.REJECTED)
        make_user("e@example.com", UserRole.FARMER, AccountStatus.SUSPENDED)
        # Non-Farmer roles must never inflate the Farmer count.
        make_user("o2@example.com", UserRole.LGU_OFFICER, AccountStatus.APPROVED)
        make_user("ad@example.com", UserRole.ADMIN, AccountStatus.APPROVED)

        farmers = self.dashboard()["farmers"]
        self.assertEqual(farmers["active"], 2)
        self.assertEqual(farmers["pending"], 1)
        self.assertEqual(farmers["rejected"], 1)
        self.assertEqual(farmers["suspended"], 1)
        self.assertEqual(farmers["total"], 5)

    def test_approving_a_pending_farmer_increases_active_count(self):
        """Section 22 / Tests 3-5 — the exact approval workflow."""
        farmer = make_user("c@example.com", UserRole.FARMER, AccountStatus.PENDING)
        self.assertEqual(self.dashboard()["farmers"]["active"], 0)

        farmer.account_status = AccountStatus.REJECTED
        farmer.save(update_fields=["account_status"])
        self.assertEqual(self.dashboard()["farmers"]["active"], 0)

        farmer.account_status = AccountStatus.APPROVED
        farmer.save(update_fields=["account_status"])
        self.assertEqual(self.dashboard()["farmers"]["active"], 1)

    def test_every_dashboard_metric_is_now_backed_by_a_query(self):
        """
        Sections 6 & 30 — never fabricate a metric that has no model.

        Harvest used to be reported as null with an "unavailable" notice,
        because no Harvest model existed. Upcoming harvest windows are in
        fact stored: `Plant.expected_harvest_start/end` is computed from the
        Crop table at planting time and already drives both the Harvest
        screen and `notify_harvest_windows`. Reporting it as unavailable
        contradicted a working feature, so it is now a real count.

        The unavailable-metric mechanism itself is deliberately kept, empty,
        so a future unbacked metric still cannot be shown as a plausible 0.
        """
        data = self.dashboard()
        self.assertIsInstance(data["harvest"], int)
        self.assertEqual(data["unavailable_metrics"], [])

    def test_zero_upcoming_harvests_is_a_real_queried_zero(self):
        """With no plants at all, 0 is truthful rather than a placeholder."""
        self.assertEqual(self.dashboard()["harvest"], 0)

    def test_upcoming_harvest_counts_only_windows_that_are_open_or_near(self):
        """
        A plant far from harvest must not be counted; one whose window opens
        within the week must be. This is what makes the figure meaningful
        rather than just "number of plants".
        """
        from datetime import timedelta

        from django.utils import timezone

        from plants.models import Crop, Plant

        # This class's setUp creates only an Officer, so the owning Farmer
        # is created here. It must be APPROVED — the count deliberately
        # ignores plants belonging to non-approved Farmers.
        farmer = make_user(
            "harvest.farmer@example.com", UserRole.FARMER, AccountStatus.APPROVED
        )
        crop = Crop.objects.first()
        today = timezone.localdate()

        # Far future — outside the 7-day approaching window.
        Plant.objects.create(
            farmer=farmer,
            crop=crop,
            planting_date=today,
            expected_harvest_start=today + timedelta(days=90),
            expected_harvest_end=today + timedelta(days=120),
        )
        self.assertEqual(self.dashboard()["harvest"], 0)

        # Window opens in three days — counted.
        Plant.objects.create(
            farmer=farmer,
            crop=crop,
            planting_date=today,
            expected_harvest_start=today + timedelta(days=3),
            expected_harvest_end=today + timedelta(days=30),
        )
        self.assertEqual(self.dashboard()["harvest"], 1)

        # Window already closed — not counted.
        Plant.objects.create(
            farmer=farmer,
            crop=crop,
            planting_date=today - timedelta(days=200),
            expected_harvest_start=today - timedelta(days=40),
            expected_harvest_end=today - timedelta(days=10),
        )
        self.assertEqual(self.dashboard()["harvest"], 1)

    def test_soil_recommendations_are_real_counts(self):
        """
        The SoilRecommendation model exists, so the dashboard must report
        queried figures rather than null — including a truthful zero.
        """
        data = self.dashboard()
        self.assertEqual(
            data["soil_recommendations"],
            {"total": 0, "generated": 0, "pending_analysis": 0},
        )

    def test_plants_risk_and_assessments_are_real_counts(self):
        data = self.dashboard()
        self.assertIsNotNone(data["plants"])
        self.assertEqual(data["plants"]["total"], 0)
        self.assertEqual(
            data["risk"], {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "unassessed": 0}
        )
        self.assertEqual(data["assessments"], 0)

    def test_officer_count_is_real(self):
        make_user("o2@example.com", UserRole.LGU_OFFICER, AccountStatus.APPROVED)
        self.assertEqual(self.dashboard()["lgu_officers"], 2)


class LguFarmerListTests(APITestCase):
    def setUp(self):
        make_user("officer@example.com", UserRole.LGU_OFFICER, AccountStatus.APPROVED)
        token = self.client.post(
            LGU_LOGIN_URL, {"email": "officer@example.com", "password": PW}, format="json"
        ).data["access"]
        self.auth = {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def test_defaults_to_approved_farmers_only(self):
        make_user("a@example.com", UserRole.FARMER, AccountStatus.APPROVED, "Juan", "Cruz")
        make_user("p@example.com", UserRole.FARMER, AccountStatus.PENDING)
        make_user("o2@example.com", UserRole.LGU_OFFICER, AccountStatus.APPROVED)

        data = self.client.get(FARMERS_URL, **self.auth).data
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["email"], "a@example.com")
        self.assertEqual(data[0]["full_name"], "Juan Cruz")

    def test_status_filter(self):
        make_user("a@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        make_user("p@example.com", UserRole.FARMER, AccountStatus.PENDING)

        pending = self.client.get(f"{FARMERS_URL}?status=PENDING", **self.auth).data
        self.assertEqual(len(pending), 1)
        self.assertEqual(pending[0]["email"], "p@example.com")

        every = self.client.get(f"{FARMERS_URL}?status=ALL", **self.auth).data
        self.assertEqual(len(every), 2)

    def test_never_exposes_password_material(self):
        make_user("a@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        response = self.client.get(FARMERS_URL, **self.auth)
        body = response.content.decode()
        self.assertNotIn("password", body)
        self.assertNotIn("pbkdf2", body)

    def test_empty_list_when_no_approved_farmers(self):
        self.assertEqual(self.client.get(FARMERS_URL, **self.auth).data, [])

    def test_farmer_detail_returns_safe_profile(self):
        farmer = make_user("a@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        data = self.client.get(f"{FARMERS_URL}{farmer.id}/", **self.auth).data
        self.assertEqual(data["farmer"]["email"], "a@example.com")
        # Real per-Farmer counts now that the Plant/Assessment models exist.
        self.assertEqual(data["plants"], 0)
        self.assertEqual(data["assessments"], 0)
        self.assertEqual(data["high_risk"], 0)
        # Real per-Farmer soil totals now that the model exists.
        self.assertEqual(
            data["soil_recommendations"],
            {"total": 0, "generated": 0, "pending_analysis": 0},
        )
        # Upcoming harvest is a real per-Farmer query over stored harvest
        # windows, so 0 here means "queried and found none" — this Farmer
        # has no plants at all.
        self.assertEqual(data["upcoming_harvest"], 0)
        self.assertNotIn("password", str(data))

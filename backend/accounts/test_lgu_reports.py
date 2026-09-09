"""
Tests for the LGU Detailed Reports API.

The point of most of these is that the numbers are real: a report is built by
querying MySQL, so each test writes known rows and then asserts the report
says exactly that. A report that quietly returned a plausible constant would
pass a smoke test and fail these.
"""

from datetime import timedelta

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import AccountStatus, User, UserRole

CATALOG_URL = "/api/lgu/reports/"
PW = "TestPass!2345"


def _summary_url(slug="agricultural-summary", **params):
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"/api/lgu/reports/{slug}/" + (f"?{query}" if query else "")


class LguReportsTestBase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        from plants.models import Assessment, Crop, Plant, RiskAssessment

        cls.officer = User.objects.create_user(
            email="officer@layuan.gov.ph",
            password=PW,
            first_name="Ofelia",
            last_name="Reyes",
            role=UserRole.LGU_OFFICER,
            account_status=AccountStatus.APPROVED,
        )
        cls.farmer = User.objects.create_user(
            email="farmer@example.com",
            password=PW,
            first_name="Juan",
            last_name="Dela Cruz",
            role=UserRole.FARMER,
            account_status=AccountStatus.APPROVED,
        )
        # Deliberately not approved: nothing belonging to this Farmer may
        # appear in any report.
        cls.pending_farmer = User.objects.create_user(
            email="pending@example.com",
            password=PW,
            first_name="Pending",
            last_name="Person",
            role=UserRole.FARMER,
            account_status=AccountStatus.PENDING,
        )

        cls.crop = Crop.objects.create(
            id="report-tomato",
            name="Report Tomato",
            category="vegetable",
            emoji="T",
            growing_duration_days=90,
            harvest_window_days=14,
        )

        today = timezone.localdate()
        cls.plant = Plant.objects.create(
            farmer=cls.farmer,
            crop=cls.crop,
            label="Plot A",
            planting_date=today - timedelta(days=30),
            expected_harvest_start=today + timedelta(days=60),
            expected_harvest_end=today + timedelta(days=74),
        )
        cls.hidden_plant = Plant.objects.create(
            farmer=cls.pending_farmer,
            crop=cls.crop,
            label="Hidden",
            planting_date=today - timedelta(days=10),
            expected_harvest_start=today + timedelta(days=80),
            expected_harvest_end=today + timedelta(days=94),
        )

        cls.assessment = Assessment.objects.create(
            plant=cls.plant,
            assessment_date=today,
            plant_age_days=30,
            growth_condition="on_track",
            health_condition="healthy",
            leaf_condition="normal",
            watering_frequency="daily",
            notes="Looking strong this week.",
        )
        RiskAssessment.objects.create(
            assessment=cls.assessment,
            risk_level="HIGH",
            status="completed",
            summary="Leaf spotting consistent with early blight.",
            risk_factors=[{"factor": "Leaf spotting", "severity": "high", "explanation": "x"}],
            recommended_actions=["Remove affected leaves"],
        )

    def auth(self, user=None):
        token = self.client.post(
            "/api/auth/lgu/login/",
            {"email": (user or self.officer).email, "password": PW},
            format="json",
        ).data["access"]
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


class ReportPermissionTests(LguReportsTestBase):
    def test_anonymous_cannot_list_reports(self):
        self.assertEqual(
            self.client.get(CATALOG_URL).status_code, status.HTTP_401_UNAUTHORIZED
        )

    def test_anonymous_cannot_read_a_report(self):
        self.assertEqual(
            self.client.get(_summary_url()).status_code, status.HTTP_401_UNAUTHORIZED
        )

    def test_anonymous_cannot_download_a_pdf(self):
        response = self.client.get("/api/lgu/reports/agricultural-summary/pdf/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_farmer_is_rejected(self):
        """RBAC is enforced server-side, not by the frontend route guard."""
        token = self.client.post(
            "/api/auth/farmer/login/",
            {"email": self.farmer.email, "password": PW},
            format="json",
        ).data["access"]
        auth = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        for url in (CATALOG_URL, _summary_url(), "/api/lgu/reports/agricultural-summary/pdf/"):
            self.assertEqual(
                self.client.get(url, **auth).status_code,
                status.HTTP_403_FORBIDDEN,
                msg=url,
            )

    def test_suspended_officer_is_rejected(self):
        auth = self.auth()
        self.officer.account_status = AccountStatus.SUSPENDED
        self.officer.save(update_fields=["account_status"])
        self.assertEqual(
            self.client.get(CATALOG_URL, **auth).status_code, status.HTTP_403_FORBIDDEN
        )

    def test_officer_can_list_reports(self):
        response = self.client.get(CATALOG_URL, **self.auth())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = {r["slug"] for r in response.data["reports"]}
        self.assertIn("agricultural-summary", slugs)
        self.assertIn("risk-assessment", slugs)
        self.assertEqual(len(slugs), 6)


class ReportDataAccuracyTests(LguReportsTestBase):
    def _stats(self, slug, **params):
        response = self.client.get(_summary_url(slug, **params), **self.auth())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return {s["label"]: s["value"] for s in response.data["stats"]}, response.data

    def test_summary_counts_match_the_database(self):
        stats, _ = self._stats("agricultural-summary", period="all_time")
        # Two Farmer rows exist; only one is approved.
        self.assertEqual(stats["Total Farmers"], 2)
        self.assertEqual(stats["Active Farmers"], 1)
        # The pending Farmer's plant must not be counted.
        self.assertEqual(stats["Active Plants"], 1)
        self.assertEqual(stats["High Risk"], 1)
        self.assertEqual(stats["Medium Risk"], 0)

    def test_report_excludes_non_approved_farmers(self):
        _, data = self._stats("plant-crop", period="all_time")
        farmers = {row["farmer"] for row in data["tables"][0]["rows"]}
        self.assertIn("Juan Dela Cruz", farmers)
        self.assertNotIn("Pending Person", farmers)

    def test_risk_rows_carry_real_ai_text(self):
        _, data = self._stats("risk-assessment", period="all_time")
        row = data["tables"][0]["rows"][0]
        self.assertEqual(row["level"], "High")
        self.assertEqual(row["summary"], "Leaf spotting consistent with early blight.")
        self.assertEqual(row["reason"], "Leaf spotting")

    def test_missing_ai_result_is_reported_not_invented(self):
        from plants.models import Assessment

        Assessment.objects.create(
            plant=self.plant,
            assessment_date=timezone.localdate() - timedelta(days=7),
            plant_age_days=23,
            growth_condition="on_track",
            health_condition="healthy",
            leaf_condition="normal",
            watering_frequency="daily",
        )
        _, data = self._stats("risk-assessment", period="all_time")
        rows = {r["date"]: r for r in data["tables"][0]["rows"]}
        unanalysed = rows[(timezone.localdate() - timedelta(days=7)).isoformat()]
        self.assertEqual(unanalysed["level"], "No reading")
        self.assertEqual(unanalysed["summary"], "AI recommendation not available")

    def test_missing_evidence_is_reported_not_invented(self):
        _, data = self._stats("risk-assessment", period="all_time")
        self.assertEqual(data["tables"][0]["rows"][0]["evidence"], "No evidence submitted")

    def test_empty_report_state(self):
        """A period with no rows returns zeroes and an empty table, not an error."""
        stats, data = self._stats(
            "risk-assessment", period="custom", date_from="2000-01-01", date_to="2000-01-31"
        )
        self.assertEqual(stats["Assessments"], 0)
        self.assertEqual(data["tables"][0]["rows"], [])


class ReportFilterTests(LguReportsTestBase):
    def _rows(self, slug, **params):
        response = self.client.get(_summary_url(slug, **params), **self.auth())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data["tables"][0]["rows"]

    def test_period_filter_excludes_older_records(self):
        self.assertEqual(len(self._rows("risk-assessment", period="this_week")), 1)
        self.assertEqual(
            len(self._rows("risk-assessment", period="custom", date_to="2001-01-01")), 0
        )

    def test_risk_level_filter(self):
        self.assertEqual(len(self._rows("risk-assessment", risk_level="HIGH")), 1)
        self.assertEqual(len(self._rows("risk-assessment", risk_level="LOW")), 0)

    def test_farmer_filter(self):
        self.assertEqual(len(self._rows("plant-crop", farmer=self.farmer.id)), 1)
        # Filtering to a Farmer outside the approved scope yields nothing
        # rather than leaking their rows.
        self.assertEqual(len(self._rows("plant-crop", farmer=self.pending_farmer.id)), 0)

    def test_crop_filter(self):
        self.assertEqual(len(self._rows("plant-crop", crop=self.crop.id)), 1)

    def test_invalid_inputs_are_rejected(self):
        auth = self.auth()
        for url in (
            _summary_url("agricultural-summary", period="last_century"),
            _summary_url("risk-assessment", risk_level="CATASTROPHIC"),
            _summary_url("plant-crop", farmer="not-a-number"),
            _summary_url(
                "agricultural-summary", period="custom", date_from="2026-05-01", date_to="2026-01-01"
            ),
        ):
            self.assertEqual(
                self.client.get(url, **auth).status_code,
                status.HTTP_400_BAD_REQUEST,
                msg=url,
            )

    def test_unknown_report_is_a_400(self):
        response = self.client.get(_summary_url("does-not-exist"), **self.auth())
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ReportPdfTests(LguReportsTestBase):
    def _pdf(self, slug):
        response = self.client.get(f"/api/lgu/reports/{slug}/pdf/", **self.auth())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response

    def test_every_report_renders_a_pdf(self):
        for slug in (
            "agricultural-summary",
            "risk-assessment",
            "soil-assessment",
            "plant-crop",
            "farm-monitoring",
            "farmer-registration",
        ):
            response = self._pdf(slug)
            self.assertEqual(response["Content-Type"], "application/pdf")
            body = b"".join(response.streaming_content) if response.streaming else response.content
            # A real PDF, not an HTML error page or a screenshot.
            self.assertTrue(body.startswith(b"%PDF-"), msg=slug)
            self.assertGreater(len(body), 1000, msg=slug)

    def test_pdf_is_sent_as_a_download(self):
        response = self._pdf("agricultural-summary")
        self.assertIn("attachment", response["Content-Disposition"])
        self.assertIn(".pdf", response["Content-Disposition"])

    def test_pdf_is_not_cached_by_shared_caches(self):
        self.assertIn("no-store", self._pdf("agricultural-summary")["Cache-Control"])

    def test_pdf_respects_filters(self):
        empty = self.client.get(
            "/api/lgu/reports/risk-assessment/pdf/?period=custom&date_to=2001-01-01",
            **self.auth(),
        )
        self.assertEqual(empty.status_code, status.HTTP_200_OK)
        self.assertTrue(empty.content.startswith(b"%PDF-"))

    def test_pdf_rejects_a_bad_filter(self):
        response = self.client.get(
            "/api/lgu/reports/risk-assessment/pdf/?period=nonsense", **self.auth()
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ReportScaleTests(LguReportsTestBase):
    def test_large_dataset_stays_bounded_and_queries_stay_flat(self):
        """
        A bigger table must not mean more queries. Without select_related the
        row loop would issue several per assessment, so this would climb with
        the row count instead of holding steady.
        """
        from plants.models import Assessment

        Assessment.objects.bulk_create(
            [
                Assessment(
                    plant=self.plant,
                    assessment_date=timezone.localdate() - timedelta(days=i + 1),
                    plant_age_days=30,
                    growth_condition="on_track",
                    health_condition="healthy",
                    leaf_condition="normal",
                    watering_frequency="daily",
                )
                for i in range(120)
            ]
        )
        auth = self.auth()

        def query_count():
            with CaptureQueriesContext(connection) as ctx:
                response = self.client.get(_summary_url("farm-monitoring"), **auth)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            return len(ctx.captured_queries), len(response.data["tables"][0]["rows"])

        before_queries, before_rows = query_count()

        Assessment.objects.bulk_create(
            [
                Assessment(
                    plant=self.plant,
                    assessment_date=timezone.localdate() - timedelta(days=i + 200),
                    plant_age_days=30,
                    growth_condition="on_track",
                    health_condition="healthy",
                    leaf_condition="normal",
                    watering_frequency="daily",
                )
                for i in range(120)
            ]
        )
        after_queries, after_rows = query_count()

        # The row count more than doubles; the query count must not move at
        # all. A missing select_related would show up here immediately.
        self.assertGreater(after_rows, before_rows)
        self.assertEqual(after_queries, before_queries)

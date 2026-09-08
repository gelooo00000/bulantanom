import io
import os
import shutil
import tempfile
from datetime import timedelta
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import AccountStatus, User, UserRole

from . import evidence_token
from .models import Assessment, Crop, Plant, RiskAssessment, RiskStatus

FARMER_LOGIN_URL = "/api/auth/farmer/login/"
LGU_LOGIN_URL = "/api/auth/lgu/login/"
PW = "SecurePassword123!"

VALID_PAYLOAD = {
    "growth_condition": "as_expected",
    "health_condition": "healthy",
    "leaf_condition": "healthy",
    "watering_frequency": "daily",
    "soil_moisture": "moist",
    "notes": "Looks fine this week.",
}

GEMINI_OK = {
    "risk_level": "MEDIUM",
    "summary": "Some signs of stress relative to expected development.",
    "reality_vs_expectation": {
        "expected": "Vegetative growth.",
        "observed": "Slower growth with some yellowing.",
        "assessment": "Somewhat below expectation.",
    },
    "visual_observations": ["Several leaves appear yellow."],
    "risk_factors": [
        {"factor": "Leaf yellowing", "severity": "medium", "explanation": "Can indicate stress."}
    ],
    "possible_causes": ["Water-related stress"],
    "recommended_actions": ["Monitor soil moisture."],
    "monitoring_advice": ["Check for increasing yellowing."],
    "limitations": ["Image-based observation is limited."],
    "next_assessment_days": 7,
    "image_analyzed": True,
}


def make_user(email, role=UserRole.FARMER, status_=AccountStatus.APPROVED):
    return User.objects.create_user(
        email=email, password=PW, first_name="Test", last_name="User",
        role=role, account_status=status_,
    )


EVIDENCE_MATCH = {
    "evidence_valid": True,
    "verdict": "match",
    "confidence": 0.93,
    "detected_subject": "guava plant",
    "expected_crop": "Guava",
    "reason": "The image appears to show a guava plant.",
    "message": "Plant evidence accepted.",
}

EVIDENCE_MISMATCH = {
    "evidence_valid": False,
    "verdict": "mismatch",
    "confidence": 0.9,
    "detected_subject": "tomato plant",
    "expected_crop": "Guava",
    "reason": "The uploaded image appears to show a tomato plant, not a guava plant.",
    "message": "Please upload a clear photo of your guava plant.",
}


def make_image(fmt="JPEG", size=(80, 80), name="plant.jpg", content_type="image/jpeg"):
    buffer = io.BytesIO()
    Image.new("RGB", size, (40, 120, 60)).save(buffer, format=fmt)
    buffer.seek(0)
    return SimpleUploadedFile(name, buffer.read(), content_type=content_type)


def payload_with_image(**overrides):
    """A submittable assessment. Evidence is mandatory, so always attach one."""
    return {**VALID_PAYLOAD, "evidence_image": make_image(), **overrides}


class RiskTestCase(APITestCase):
    """
    Shared harness for assessment tests.

    * Evidence uploads go to a throwaway MEDIA_ROOT — the test database is
      destroyed after a run but uploaded files are not, so without this the
      suite would leave real files in the project's media directory.
    * Evidence validation is stubbed to "match" by default so tests that are
      about something else do not depend on a live Gemini call. Tests that
      care about validation override it explicitly.
    """

    @classmethod
    def setUpClass(cls):
        cls._media_dir = tempfile.mkdtemp(prefix="bulantanom-test-media-")
        cls._media_override = override_settings(MEDIA_ROOT=cls._media_dir)
        cls._media_override.enable()
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        cls._media_override.disable()
        shutil.rmtree(cls._media_dir, ignore_errors=True)

    def setUp(self):
        super().setUp()
        patcher = patch(
            "plants.evidence_validation_service.validate_crop_evidence",
            return_value=EVIDENCE_MATCH,
        )
        self.mock_validate_evidence = patcher.start()
        self.addCleanup(patcher.stop)

    def login(self, email, url=FARMER_LOGIN_URL):
        token = self.client.post(url, {"email": email, "password": PW}, format="json").data["access"]
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def make_plant(self, farmer, crop_id="guava", days_ago=30):
        return Plant.objects.create(
            farmer=farmer,
            crop=Crop.objects.get(pk=crop_id),
            planting_date=timezone.localdate() - timedelta(days=days_ago),
        )


class AssessmentSubmissionTests(RiskTestCase):
    def setUp(self):
        super().setUp()
        self.farmer = make_user("farmer@example.com")
        self.auth = self.login("farmer@example.com")
        self.plant = self.make_plant(self.farmer)
        self.url = f"/api/farmer/plants/{self.plant.id}/assessments/"

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK)
    def test_submit_assessment_creates_risk(self, _mock):
        response = self.client.post(self.url, payload_with_image(), **self.auth)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["risk"]["risk_level"], "MEDIUM")
        self.assertEqual(response.data["risk"]["status"], "completed")

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK)
    def test_plant_age_is_calculated_server_side(self, _mock):
        """Section 9 — a client-supplied age must be ignored."""
        payload = payload_with_image(plant_age_days=9999)
        response = self.client.post(self.url, payload, **self.auth)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["plant_age_days"], 30)

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK)
    def test_duplicate_same_day_assessment_rejected(self, _mock):
        self.client.post(self.url, payload_with_image(), **self.auth)
        second = self.client.post(self.url, payload_with_image(), **self.auth)
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(Assessment.objects.filter(plant=self.plant).count(), 1)

    def test_evidence_image_is_required(self):
        response = self.client.post(self.url, VALID_PAYLOAD, **self.auth)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(response.data["evidence_required"])
        self.assertEqual(Assessment.objects.count(), 0)

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK)
    def test_history_is_additive_not_overwritten(self, _mock):
        """Section 39 — each week is a new row with its own evidence."""
        a1 = Assessment.objects.create(
            plant=self.plant, assessment_date=timezone.localdate() - timedelta(days=7),
            plant_age_days=23, growth_condition="as_expected", health_condition="healthy",
            leaf_condition="healthy", watering_frequency="daily",
        )
        self.client.post(self.url, payload_with_image(), **self.auth)
        self.assertEqual(Assessment.objects.filter(plant=self.plant).count(), 2)
        self.assertTrue(Assessment.objects.filter(pk=a1.pk).exists())

    def test_missing_required_fields_rejected(self):
        response = self.client.post(self.url, {"notes": "hi"}, **self.auth)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class GeminiFailureTests(RiskTestCase):
    """Section 21/22/45 — never lose the assessment, never fabricate a level."""

    def setUp(self):
        super().setUp()
        self.farmer = make_user("farmer@example.com")
        self.auth = self.login("farmer@example.com")
        self.plant = self.make_plant(self.farmer)
        self.url = f"/api/farmer/plants/{self.plant.id}/assessments/"

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=None)
    def test_assessment_saved_and_risk_marked_failed(self, _mock):
        response = self.client.post(self.url, payload_with_image(), **self.auth)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Assessment.objects.count(), 1)

        risk = RiskAssessment.objects.get()
        self.assertEqual(risk.status, RiskStatus.FAILED)
        self.assertIsNone(risk.risk_level)  # no fabricated level
        self.assertTrue(risk.failure_reason)

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=None)
    def test_evidence_image_still_saved_when_gemini_fails(self, _mock):
        response = self.client.post(
            self.url, {**VALID_PAYLOAD, "evidence_image": make_image()}, **self.auth
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNotNone(response.data["evidence_image_url"])

    def test_reanalyze_recovers_a_failed_assessment(self):
        with patch(
            "plants.risk_evaluation_service.evaluate_assessment", return_value=None
        ):
            created = self.client.post(self.url, payload_with_image(), **self.auth)
        assessment_id = created.data["id"]
        self.assertEqual(created.data["risk"]["status"], "failed")
        self.assertIsNone(created.data["risk"]["risk_level"])

        with patch(
            "plants.risk_evaluation_service.evaluate_assessment",
            return_value={**GEMINI_OK, "image_analyzed": False},
        ):
            response = self.client.post(
                f"/api/farmer/assessments/{assessment_id}/reanalyze/", **self.auth
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["risk"]["status"], "completed")
        self.assertEqual(response.data["risk"]["risk_level"], GEMINI_OK["risk_level"])
        # Exactly one risk row — the failed one was replaced, not duplicated.
        self.assertEqual(RiskAssessment.objects.count(), 1)

    def test_reanalyze_leaves_a_completed_assessment_untouched(self):
        with patch(
            "plants.risk_evaluation_service.evaluate_assessment",
            return_value={**GEMINI_OK, "image_analyzed": False},
        ):
            created = self.client.post(self.url, payload_with_image(), **self.auth)
        assessment_id = created.data["id"]

        # Would return a different level if it actually re-ran.
        with patch(
            "plants.risk_evaluation_service.evaluate_assessment",
            return_value={**GEMINI_OK, "risk_level": "HIGH", "image_analyzed": False},
        ):
            response = self.client.post(
                f"/api/farmer/assessments/{assessment_id}/reanalyze/", **self.auth
            )
        self.assertEqual(response.data["risk"]["risk_level"], GEMINI_OK["risk_level"])

    def test_deleting_an_assessment_removes_its_evidence_file(self):
        with patch(
            "plants.risk_evaluation_service.evaluate_assessment", return_value=None
        ):
            self.client.post(
                self.url, {**VALID_PAYLOAD, "evidence_image": make_image()}, **self.auth
            )
        assessment = Assessment.objects.get()
        path = assessment.evidence_image.path
        self.assertTrue(os.path.exists(path))

        assessment.delete()
        self.assertFalse(os.path.exists(path))

    def test_reanalyze_rejects_another_farmers_assessment(self):
        with patch(
            "plants.risk_evaluation_service.evaluate_assessment", return_value=None
        ):
            created = self.client.post(self.url, payload_with_image(), **self.auth)

        make_user("intruder@example.com")
        intruder = self.login("intruder@example.com")
        response = self.client.post(
            f"/api/farmer/assessments/{created.data['id']}/reanalyze/", **intruder
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class RiskLevelValidationTests(APITestCase):
    def test_invalid_risk_level_is_rejected_not_coerced(self):
        from .risk_evaluation_service import _validate

        self.assertIsNone(_validate({**GEMINI_OK, "risk_level": "CRITICAL"}))
        self.assertIsNone(_validate({**GEMINI_OK, "risk_level": "low"}))
        self.assertIsNone(_validate({**GEMINI_OK, "risk_level": None}))

    def test_missing_summary_rejected(self):
        self.assertIsNone(__import__(
            "plants.risk_evaluation_service", fromlist=["_validate"]
        )._validate({**GEMINI_OK, "summary": "  "}))

    def test_valid_levels_accepted(self):
        from .risk_evaluation_service import _validate

        for level in ("LOW", "MEDIUM", "HIGH"):
            result = _validate({**GEMINI_OK, "risk_level": level})
            self.assertIsNotNone(result)
            self.assertEqual(result["risk_level"], level)

    def test_service_returns_none_without_api_key(self):
        from .risk_evaluation_service import evaluate_assessment

        with patch("django.conf.settings.GEMINI_API_KEY", ""):
            self.assertIsNone(evaluate_assessment(None))


class ImageValidationTests(RiskTestCase):
    def setUp(self):
        super().setUp()
        self.farmer = make_user("farmer@example.com")
        self.auth = self.login("farmer@example.com")
        self.plant = self.make_plant(self.farmer)
        self.url = f"/api/farmer/plants/{self.plant.id}/assessments/"

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK)
    def test_valid_jpeg_accepted(self, _mock):
        response = self.client.post(
            self.url, {**VALID_PAYLOAD, "evidence_image": make_image("JPEG")}, **self.auth
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["evidence_image_url"].startswith("http"))

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK)
    def test_valid_png_accepted(self, _mock):
        response = self.client.post(
            self.url,
            {**VALID_PAYLOAD, "evidence_image": make_image("PNG", name="p.png", content_type="image/png")},
            **self.auth,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_non_image_file_rejected(self):
        bogus = SimpleUploadedFile("evil.jpg", b"#!/bin/sh\nrm -rf /", content_type="image/jpeg")
        response = self.client.post(
            self.url, {**VALID_PAYLOAD, "evidence_image": bogus}, **self.auth
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_svg_rejected(self):
        svg = SimpleUploadedFile(
            "x.svg", b"<svg xmlns='http://www.w3.org/2000/svg'></svg>", content_type="image/svg+xml"
        )
        response = self.client.post(
            self.url, {**VALID_PAYLOAD, "evidence_image": svg}, **self.auth
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_gif_renamed_as_jpg_rejected(self):
        """Extension and declared content-type are never trusted alone."""
        buffer = io.BytesIO()
        Image.new("RGB", (10, 10)).save(buffer, format="GIF")
        buffer.seek(0)
        disguised = SimpleUploadedFile("x.jpg", buffer.read(), content_type="image/jpeg")
        response = self.client.post(
            self.url, {**VALID_PAYLOAD, "evidence_image": disguised}, **self.auth
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_oversized_image_rejected(self):
        """A genuinely valid but too-large photo must hit the size limit."""
        import os

        # Random noise compresses poorly, so this exceeds the 5MB cap.
        buffer = io.BytesIO()
        Image.frombytes("RGB", (1600, 1600), os.urandom(1600 * 1600 * 3)).save(
            buffer, format="PNG"
        )
        buffer.seek(0)
        raw = buffer.read()
        self.assertGreater(len(raw), 5 * 1024 * 1024, "test fixture must exceed the cap")

        big = SimpleUploadedFile("big.png", raw, content_type="image/png")
        response = self.client.post(
            self.url, {**VALID_PAYLOAD, "evidence_image": big}, **self.auth
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("too large", str(response.data).lower())

    def test_garbage_file_with_image_extension_rejected(self):
        garbage = SimpleUploadedFile(
            "big.jpg", b"x" * (6 * 1024 * 1024), content_type="image/jpeg"
        )
        response = self.client.post(
            self.url, {**VALID_PAYLOAD, "evidence_image": garbage}, **self.auth
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class AssessmentOwnershipTests(RiskTestCase):
    """Section 29/47 — strict per-Farmer isolation."""

    def setUp(self):
        super().setUp()
        self.a = make_user("a@example.com")
        self.b = make_user("b@example.com")
        self.plant_a = self.make_plant(self.a)
        self.assessment_a = Assessment.objects.create(
            plant=self.plant_a, plant_age_days=30, growth_condition="as_expected",
            health_condition="healthy", leaf_condition="healthy", watering_frequency="daily",
        )
        RiskAssessment.objects.create(
            assessment=self.assessment_a, status=RiskStatus.COMPLETED, risk_level="HIGH",
            summary="test",
        )

    def test_farmer_b_cannot_list_farmer_a_plant_assessments(self):
        auth_b = self.login("b@example.com")
        response = self.client.get(
            f"/api/farmer/plants/{self.plant_a.id}/assessments/", **auth_b
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_farmer_b_cannot_retrieve_farmer_a_assessment(self):
        auth_b = self.login("b@example.com")
        response = self.client.get(f"/api/farmer/assessments/{self.assessment_a.id}/", **auth_b)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_farmer_b_cannot_post_assessment_to_farmer_a_plant(self):
        auth_b = self.login("b@example.com")
        response = self.client.post(
            f"/api/farmer/plants/{self.plant_a.id}/assessments/", payload_with_image(), **auth_b
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_farmer_b_risk_overview_excludes_farmer_a(self):
        auth_b = self.login("b@example.com")
        data = self.client.get("/api/farmer/risk/", **auth_b).data
        self.assertEqual(data["counts"]["HIGH"], 0)
        self.assertEqual(len(data["plants"]), 0)

    def test_farmer_b_history_excludes_farmer_a(self):
        auth_b = self.login("b@example.com")
        self.assertEqual(len(self.client.get("/api/farmer/risk/history/", **auth_b).data), 0)

    def test_farmer_a_sees_own_risk(self):
        auth_a = self.login("a@example.com")
        data = self.client.get("/api/farmer/risk/", **auth_a).data
        self.assertEqual(data["counts"]["HIGH"], 1)


class LguRiskAggregationTests(RiskTestCase):
    """Section 48 — LGU figures must be computed, never hardcoded."""

    def setUp(self):
        super().setUp()
        make_user("officer@example.com", UserRole.LGU_OFFICER)
        self.auth = self.login("officer@example.com", LGU_LOGIN_URL)

        for email, crop, level in [
            ("fa@example.com", "guava", "LOW"),
            ("fb@example.com", "tomato", "HIGH"),
            ("fc@example.com", "papaya", "MEDIUM"),
        ]:
            farmer = make_user(email)
            plant = self.make_plant(farmer, crop_id=crop)
            assessment = Assessment.objects.create(
                plant=plant, plant_age_days=30, growth_condition="as_expected",
                health_condition="healthy", leaf_condition="healthy",
                watering_frequency="daily",
            )
            RiskAssessment.objects.create(
                assessment=assessment, status=RiskStatus.COMPLETED,
                risk_level=level, summary=f"{level} case",
            )

    def test_dashboard_risk_counts_are_real(self):
        data = self.client.get("/api/lgu/dashboard/", **self.auth).data
        self.assertEqual(data["farmers"]["active"], 3)
        self.assertEqual(data["plants"]["total"], 3)
        self.assertEqual(data["risk"], {"LOW": 1, "MEDIUM": 1, "HIGH": 1, "unassessed": 0})
        self.assertEqual(data["assessments"], 3)

    def test_plants_without_any_assessment_count_as_unassessed(self):
        """
        Regression: counts previously iterated assessments, so a plant that
        had never been assessed vanished from the LGU totals entirely.
        """
        farmer = User.objects.get(email="fa@example.com")
        self.make_plant(farmer, crop_id="corn")
        self.make_plant(farmer, crop_id="lettuce-cabbage")

        data = self.client.get("/api/lgu/dashboard/", **self.auth).data
        self.assertEqual(data["plants"]["total"], 5)
        counts = data["risk"]
        self.assertEqual(counts, {"LOW": 1, "MEDIUM": 1, "HIGH": 1, "unassessed": 2})
        self.assertEqual(sum(counts.values()), data["plants"]["total"])

    def test_high_risk_endpoint_returns_high_and_medium(self):
        data = self.client.get("/api/lgu/risk/high-risk/", **self.auth).data
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]["risk"]["risk_level"], "HIGH")  # severity ordered
        self.assertIn("farmer", data[0])

    def test_risk_overview_includes_farmer_attribution(self):
        data = self.client.get("/api/lgu/risk/overview/", **self.auth).data
        self.assertEqual(data["counts"]["HIGH"], 1)
        self.assertEqual(len(data["cases"]), 3)
        self.assertIn("full_name", data["cases"][0]["farmer"])

    def test_assessment_history_visible_to_lgu(self):
        data = self.client.get("/api/lgu/assessments/history/", **self.auth).data
        self.assertEqual(len(data), 3)

    def test_farmer_detail_counts_only_that_farmers_records(self):
        """Per-Farmer figures must not leak another Farmer's assessments."""
        high_risk_farmer = User.objects.get(email="fb@example.com")
        low_risk_farmer = User.objects.get(email="fa@example.com")

        data = self.client.get(
            f"/api/lgu/farmers/{high_risk_farmer.id}/", **self.auth
        ).data
        self.assertEqual(data["plants"], 1)
        self.assertEqual(data["assessments"], 1)
        self.assertEqual(data["high_risk"], 1)

        data = self.client.get(
            f"/api/lgu/farmers/{low_risk_farmer.id}/", **self.auth
        ).data
        self.assertEqual(data["assessments"], 1)
        self.assertEqual(data["high_risk"], 0)

    def test_farmer_cannot_access_lgu_risk_endpoints(self):
        farmer_auth = self.login("fa@example.com")
        for url in (
            "/api/lgu/risk/overview/",
            "/api/lgu/risk/high-risk/",
            "/api/lgu/assessments/history/",
        ):
            self.assertEqual(
                self.client.get(url, **farmer_auth).status_code,
                status.HTTP_403_FORBIDDEN,
                url,
            )


class RiskContextTests(RiskTestCase):
    """Expected-vs-actual context must be built from real DB values."""

    def test_context_contains_expected_and_actual(self):
        from .risk_evaluation_service import build_context

        farmer = make_user("f@example.com")
        plant = self.make_plant(farmer, days_ago=45)
        assessment = Assessment.objects.create(
            plant=plant, plant_age_days=45, growth_condition="slower_than_expected",
            health_condition="slightly_unhealthy", leaf_condition="yellowing",
            watering_frequency="daily", notes="Leaves turning yellow.",
        )
        ctx = build_context(assessment)

        self.assertEqual(ctx["crop"]["name"], "Guava")
        self.assertIn("expected_growth_stage", ctx["crop"])
        self.assertEqual(ctx["plant"]["age_days"], 45)
        self.assertEqual(ctx["farmer_assessment"]["leaf_condition"], "Noticeable yellowing")
        self.assertFalse(ctx["image_evidence"])


class WeeklyAssessmentLockTests(RiskTestCase):
    """
    Tests 1-4 — the 7-day weekly lock, enforced server-side.

    Eligibility is derived from stored assessment_date rows, so these also
    demonstrate that a client cannot unlock an assessment early: nothing in
    the request influences the decision.
    """

    def setUp(self):
        super().setUp()
        self.farmer = make_user("farmer@example.com")
        self.auth = self.login("farmer@example.com")
        self.plant = self.make_plant(self.farmer, days_ago=40)
        self.url = f"/api/farmer/plants/{self.plant.id}/assessments/"
        self.eligibility_url = f"{self.url}eligibility/"

    def _record(self, days_ago):
        return Assessment.objects.create(
            plant=self.plant,
            assessment_date=timezone.localdate() - timedelta(days=days_ago),
            plant_age_days=40 - days_ago,
            growth_condition="as_expected",
            health_condition="healthy",
            leaf_condition="healthy",
            watering_frequency="daily",
        )

    def test_1_first_assessment_is_allowed(self):
        data = self.client.get(self.eligibility_url, **self.auth).data
        self.assertTrue(data["can_assess"])
        self.assertIsNone(data["last_assessment_date"])
        self.assertIsNone(data["next_assessment_date"])
        self.assertEqual(data["days_remaining"], 0)

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK)
    def test_2_completing_an_assessment_locks_for_seven_days(self, _mock):
        created = self.client.post(self.url, payload_with_image(), **self.auth)
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)

        data = self.client.get(self.eligibility_url, **self.auth).data
        self.assertFalse(data["can_assess"])
        self.assertEqual(data["days_remaining"], 7)
        self.assertEqual(
            data["next_assessment_date"],
            (timezone.localdate() + timedelta(days=7)).isoformat(),
        )
        self.assertEqual(data["interval_days"], 7)

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK)
    def test_3_second_attempt_within_the_week_is_rejected(self, _mock):
        self._record(days_ago=3)
        response = self.client.post(self.url, payload_with_image(), **self.auth)

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        next_date = (timezone.localdate() + timedelta(days=4)).isoformat()
        # The message must tell the farmer when they can next assess.
        self.assertIn(next_date, response.data["detail"])
        self.assertEqual(
            response.data["assessment_eligibility"]["next_assessment_date"], next_date
        )
        self.assertEqual(response.data["assessment_eligibility"]["days_remaining"], 4)
        # Nothing was written, and no Gemini work was attempted.
        self.assertEqual(Assessment.objects.count(), 1)
        self.mock_validate_evidence.assert_not_called()

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK)
    def test_4_seven_days_elapsed_unlocks_again(self, _mock):
        self._record(days_ago=7)

        data = self.client.get(self.eligibility_url, **self.auth).data
        self.assertTrue(data["can_assess"])
        self.assertEqual(data["days_remaining"], 0)

        response = self.client.post(self.url, payload_with_image(), **self.auth)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Assessment.objects.count(), 2)

    def test_lock_is_per_plant_not_per_farmer(self):
        """Assessing one plant must not lock the farmer's other plants."""
        self._record(days_ago=1)
        other = self.make_plant(self.farmer, crop_id="tomato")

        locked = self.client.get(self.eligibility_url, **self.auth).data
        unlocked = self.client.get(
            f"/api/farmer/plants/{other.id}/assessments/eligibility/", **self.auth
        ).data
        self.assertFalse(locked["can_assess"])
        self.assertTrue(unlocked["can_assess"])

    def test_eligibility_is_exposed_on_the_plant_record(self):
        self._record(days_ago=2)
        plant = self.client.get(f"/api/farmer/plants/{self.plant.id}/", **self.auth).data
        schedule = plant["assessment_eligibility"]
        self.assertFalse(schedule["can_assess"])
        self.assertEqual(schedule["days_remaining"], 5)

    def test_eligibility_of_another_farmers_plant_is_not_visible(self):
        """Test 10 — ownership, including for the schedule endpoint."""
        make_user("intruder@example.com")
        intruder = self.login("intruder@example.com")
        response = self.client.get(self.eligibility_url, **intruder)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class EvidenceValidationServiceTests(APITestCase):
    """Tests 5-8 & 13 — the validator's own decision rules."""

    def setUp(self):
        super().setUp()
        self.crop = Crop.objects.get(pk="papaya")

    def _validate(self, payload):
        from .evidence_validation_service import _validate

        return _validate(payload, self.crop)

    def test_5_correct_crop_is_accepted(self):
        result = self._validate(
            {
                "verdict": "match",
                "confidence": 0.93,
                "detected_subject": "papaya plant",
                "reason": "The image appears to show a papaya plant.",
            }
        )
        self.assertTrue(result["evidence_valid"])
        self.assertEqual(result["expected_crop"], "Papaya")
        self.assertEqual(result["detected_subject"], "papaya plant")
        self.assertEqual(result["message"], "Plant evidence accepted.")

    def test_6_wrong_crop_is_rejected(self):
        result = self._validate(
            {
                "verdict": "mismatch",
                "confidence": 0.91,
                "detected_subject": "tomato plant",
                "reason": "This looks like a tomato plant.",
            }
        )
        self.assertFalse(result["evidence_valid"])
        self.assertEqual(result["verdict"], "mismatch")
        self.assertIn("papaya", result["message"].lower())

    def test_7_unrelated_image_is_rejected(self):
        result = self._validate(
            {
                "verdict": "no_plant",
                "confidence": 0.98,
                "detected_subject": "pile of rocks",
                "reason": "The image shows rocks, not a plant.",
            }
        )
        self.assertFalse(result["evidence_valid"])
        self.assertEqual(result["verdict"], "no_plant")

    def test_8_poor_quality_is_its_own_verdict_not_a_mismatch(self):
        result = self._validate(
            {
                "verdict": "unclear",
                "confidence": 0.4,
                "detected_subject": "blurry green foliage",
                "reason": "The photo is too blurry to identify the crop.",
            }
        )
        self.assertFalse(result["evidence_valid"])
        self.assertEqual(result["verdict"], "unclear")
        self.assertIn("clearer", result["message"].lower())

    def test_13_low_confidence_match_is_downgraded_not_accepted(self):
        """A weakly-held match must never pass as verified evidence."""
        result = self._validate(
            {
                "verdict": "match",
                "confidence": 0.3,
                "detected_subject": "small green seedling",
                "reason": "This might be a papaya seedling.",
            }
        )
        self.assertFalse(result["evidence_valid"])
        self.assertEqual(result["verdict"], "unclear")

    def test_malformed_responses_are_rejected(self):
        for payload in (
            None,
            "not a dict",
            {"verdict": "definitely_papaya", "confidence": 0.9, "detected_subject": "x", "reason": "y"},
            {"verdict": "match", "confidence": "high", "detected_subject": "x", "reason": "y"},
            {"verdict": "match", "confidence": 0.9, "detected_subject": "x", "reason": "  "},
            {"verdict": "match", "confidence": True, "detected_subject": "x", "reason": "y"},
        ):
            self.assertIsNone(self._validate(payload), payload)

    def test_confidence_is_clamped_to_a_sane_range(self):
        result = self._validate(
            {
                "verdict": "match",
                "confidence": 4.2,
                "detected_subject": "papaya plant",
                "reason": "Clearly papaya.",
            }
        )
        self.assertEqual(result["confidence"], 1.0)

    def test_context_contains_no_farmer_information(self):
        """Section 17 — only crop metadata is sent to Gemini."""
        from .evidence_validation_service import build_context

        context = build_context(self.crop)
        blob = str(context).lower()
        for forbidden in ("email", "password", "token", "farmer", "@"):
            self.assertNotIn(forbidden, blob)


class EvidenceValidationEndpointTests(RiskTestCase):
    """The pre-submission validation endpoint and its enforcement at submit."""

    def setUp(self):
        super().setUp()
        self.farmer = make_user("farmer@example.com")
        self.auth = self.login("farmer@example.com")
        self.plant = self.make_plant(self.farmer)
        self.validate_url = f"/api/farmer/plants/{self.plant.id}/evidence/validate/"
        self.submit_url = f"/api/farmer/plants/{self.plant.id}/assessments/"

    def test_valid_evidence_returns_a_reusable_token(self):
        response = self.client.post(
            self.validate_url, {"evidence_image": make_image()}, **self.auth
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["evidence_valid"])
        self.assertTrue(response.data["evidence_token"])

    def test_rejected_evidence_gets_no_token_and_saves_nothing(self):
        self.mock_validate_evidence.return_value = EVIDENCE_MISMATCH
        response = self.client.post(
            self.validate_url, {"evidence_image": make_image()}, **self.auth
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["evidence_valid"])
        self.assertNotIn("evidence_token", response.data)
        # Section 15 — nothing is persisted by a validation attempt.
        self.assertEqual(Assessment.objects.count(), 0)

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK)
    def test_submission_with_mismatched_evidence_is_blocked(self, mock_risk):
        self.mock_validate_evidence.return_value = EVIDENCE_MISMATCH
        response = self.client.post(self.submit_url, payload_with_image(), **self.auth)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["evidence_validation"]["evidence_valid"])
        self.assertEqual(Assessment.objects.count(), 0)
        # Section 14 — risk evaluation must not run on invalid evidence.
        mock_risk.assert_not_called()

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK)
    def test_9_validation_outage_blocks_submission_without_accepting(self, mock_risk):
        """Section 19 — an unavailable check is never treated as a pass."""
        self.mock_validate_evidence.return_value = None
        response = self.client.post(self.submit_url, payload_with_image(), **self.auth)

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertTrue(response.data["evidence_validation_unavailable"])
        self.assertEqual(Assessment.objects.count(), 0)
        mock_risk.assert_not_called()

        # The farmer can retry, and it succeeds once the service recovers.
        self.mock_validate_evidence.return_value = EVIDENCE_MATCH
        retry = self.client.post(self.submit_url, payload_with_image(), **self.auth)
        self.assertEqual(retry.status_code, status.HTTP_201_CREATED)

    def test_validation_outage_on_the_endpoint_returns_503(self):
        self.mock_validate_evidence.return_value = None
        response = self.client.post(
            self.validate_url, {"evidence_image": make_image()}, **self.auth
        )
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertNotIn("evidence_valid", response.data)

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK)
    def test_accepted_evidence_is_recorded_on_the_assessment(self, _mock):
        response = self.client.post(self.submit_url, payload_with_image(), **self.auth)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["evidence_validated"])
        self.assertEqual(
            response.data["evidence_validation"]["detected_subject"], "guava plant"
        )

    def test_10_cannot_validate_evidence_for_another_farmers_plant(self):
        make_user("intruder@example.com")
        intruder = self.login("intruder@example.com")
        response = self.client.post(
            self.validate_url, {"evidence_image": make_image()}, **intruder
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.mock_validate_evidence.assert_not_called()

    def test_endpoint_rejects_non_images_before_calling_gemini(self):
        svg = SimpleUploadedFile(
            "plant.jpg", b"<svg xmlns='http://www.w3.org/2000/svg'></svg>", "image/jpeg"
        )
        response = self.client.post(
            self.validate_url, {"evidence_image": svg}, **self.auth
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.mock_validate_evidence.assert_not_called()

    def test_missing_file_is_rejected(self):
        response = self.client.post(self.validate_url, {}, **self.auth)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class EvidenceTokenTests(RiskTestCase):
    """
    The token that lets a validated image skip a second Gemini call. It must
    be unforgeable and bound to the exact image, plant and farmer.
    """

    def setUp(self):
        super().setUp()
        self.farmer = make_user("farmer@example.com")
        self.auth = self.login("farmer@example.com")
        self.plant = self.make_plant(self.farmer)
        self.other_plant = self.make_plant(self.farmer, crop_id="tomato")
        self.image_bytes = make_image().read()

    def test_round_trip(self):
        token = evidence_token.issue(self.farmer.id, self.plant.id, self.image_bytes)
        self.assertTrue(
            evidence_token.verify(token, self.farmer.id, self.plant.id, self.image_bytes)
        )

    def test_rejects_a_different_image(self):
        token = evidence_token.issue(self.farmer.id, self.plant.id, self.image_bytes)
        other_bytes = make_image(size=(100, 100)).read()
        self.assertFalse(
            evidence_token.verify(token, self.farmer.id, self.plant.id, other_bytes)
        )

    def test_rejects_a_different_plant_or_farmer(self):
        token = evidence_token.issue(self.farmer.id, self.plant.id, self.image_bytes)
        self.assertFalse(
            evidence_token.verify(
                token, self.farmer.id, self.other_plant.id, self.image_bytes
            )
        )
        self.assertFalse(
            evidence_token.verify(
                token, self.farmer.id + 999, self.plant.id, self.image_bytes
            )
        )

    def test_rejects_forged_and_malformed_tokens(self):
        real = evidence_token.issue(self.farmer.id, self.plant.id, self.image_bytes)
        forged = real.rsplit(".", 1)[0] + ".deadbeef"
        for token in (forged, "", "a.b.c", "not-a-token", None):
            self.assertFalse(
                evidence_token.verify(
                    token, self.farmer.id, self.plant.id, self.image_bytes
                ),
                token,
            )

    def test_rejects_an_expired_token(self):
        with override_settings(EVIDENCE_TOKEN_TTL_SECONDS=-1):
            token = evidence_token.issue(self.farmer.id, self.plant.id, self.image_bytes)
        self.assertFalse(
            evidence_token.verify(token, self.farmer.id, self.plant.id, self.image_bytes)
        )

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK)
    def test_valid_token_skips_the_second_gemini_call(self, _mock):
        image = make_image()
        image_bytes = image.read()
        image.seek(0)
        token = evidence_token.issue(self.farmer.id, self.plant.id, image_bytes)

        response = self.client.post(
            f"/api/farmer/plants/{self.plant.id}/assessments/",
            {**VALID_PAYLOAD, "evidence_image": image, "evidence_token": token},
            **self.auth,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["evidence_validated"])
        self.mock_validate_evidence.assert_not_called()

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK)
    def test_a_forged_token_falls_back_to_real_validation(self, _mock):
        """A forged token must not bypass the check — it is simply ignored."""
        self.mock_validate_evidence.return_value = EVIDENCE_MISMATCH
        response = self.client.post(
            f"/api/farmer/plants/{self.plant.id}/assessments/",
            {
                **VALID_PAYLOAD,
                "evidence_image": make_image(),
                "evidence_token": "1.2.abc.9999999999.forged",
            },
            **self.auth,
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.mock_validate_evidence.assert_called_once()

"""
An assessment is only evaluated on a genuine, fresh photo that agrees with
the farmer's own answers.
"""

from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone
from rest_framework import status

from .evidence_validation_service import _validate as validate_evidence_payload
from .models import Assessment, Crop, RiskAssessment, RiskStatus
from .risk_evaluation_service import _validate as validate_risk_payload
from .test_risk import GEMINI_OK, RiskTestCase, make_user, payload_with_image

CONFLICT = {
    **GEMINI_OK,
    "answers_match_photo": False,
    "answer_conflicts": ["You answered 'Not fruiting', but the photo shows several fruits."],
}


class AnswersMustMatchPhotoTests(RiskTestCase):
    def setUp(self):
        super().setUp()
        self.farmer = make_user("farmer@example.com")
        self.auth = self.login("farmer@example.com")
        self.plant = self.make_plant(self.farmer)
        self.url = f"/api/farmer/plants/{self.plant.id}/assessments/"

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=CONFLICT)
    def test_contradicted_answers_are_refused_and_nothing_is_kept(self, _mock):
        response = self.client.post(self.url, payload_with_image(), **self.auth)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(response.data["answers_mismatch"])
        self.assertEqual(response.data["answer_conflicts"], CONFLICT["answer_conflicts"])
        self.assertEqual(Assessment.objects.count(), 0)
        self.assertEqual(RiskAssessment.objects.count(), 0)

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=CONFLICT)
    def test_refusal_leaves_the_week_open_for_a_corrected_submission(self, _mock):
        self.client.post(self.url, payload_with_image(), **self.auth)

        with patch(
            "plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK
        ):
            retry = self.client.post(self.url, payload_with_image(), **self.auth)
        self.assertEqual(retry.status_code, status.HTTP_201_CREATED)

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=CONFLICT)
    def test_reanalysis_never_issues_a_reading_on_contradicted_answers(self, _mock):
        assessment = Assessment.objects.create(
            plant=self.plant, assessment_date=timezone.localdate(), plant_age_days=30,
            growth_condition="as_expected", health_condition="healthy",
            leaf_condition="healthy", watering_frequency="daily",
        )
        RiskAssessment.objects.create(assessment=assessment, status=RiskStatus.FAILED)

        self.client.post(f"/api/farmer/assessments/{assessment.id}/reanalyze/", **self.auth)

        risk = RiskAssessment.objects.get(assessment=assessment)
        self.assertEqual(risk.status, RiskStatus.FAILED)
        self.assertIsNone(risk.risk_level)
        self.assertIn("photo shows several fruits", risk.failure_reason)


class ReusedPhotoTests(RiskTestCase):
    def setUp(self):
        super().setUp()
        self.farmer = make_user("farmer@example.com")
        self.auth = self.login("farmer@example.com")
        self.plant = self.make_plant(self.farmer, days_ago=40)
        self.url = f"/api/farmer/plants/{self.plant.id}/assessments/"

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK)
    def test_last_weeks_photo_cannot_be_sent_again(self, _mock):
        first = self.client.post(self.url, payload_with_image(), **self.auth)
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        # Open next week's slot.
        Assessment.objects.update(assessment_date=timezone.localdate() - timedelta(days=7))

        again = self.client.post(self.url, payload_with_image(), **self.auth)

        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(again.data["evidence_validation"]["verdict"], "not_genuine")
        self.assertEqual(Assessment.objects.count(), 1)

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK)
    def test_upload_check_also_refuses_a_used_photo(self, _mock):
        self.client.post(self.url, payload_with_image(), **self.auth)
        self.mock_validate_evidence.reset_mock()

        response = self.client.post(
            f"/api/farmer/plants/{self.plant.id}/evidence/validate/",
            {"evidence_image": payload_with_image()["evidence_image"]},
            **self.auth,
        )

        self.assertFalse(response.data["evidence_valid"])
        self.assertNotIn("evidence_token", response.data)
        # Refused before any Gemini call is spent on it.
        self.mock_validate_evidence.assert_not_called()


class ParsingTests(RiskTestCase):
    def test_not_genuine_photo_is_never_valid_evidence(self):
        result = validate_evidence_payload(
            {
                "verdict": "not_genuine",
                "confidence": 0.9,
                "detected_subject": "stock photo of a guava tree with a watermark",
                "reason": "The image carries a stock-photo watermark.",
            },
            Crop.objects.get(pk="guava"),
        )
        self.assertFalse(result["evidence_valid"])
        self.assertIn("internet", result["message"])

    def test_missing_consistency_flag_does_not_block_a_farmer(self):
        self.assertTrue(validate_risk_payload(GEMINI_OK)["answers_match_photo"])

    def test_false_flag_without_any_named_conflict_does_not_block(self):
        result = validate_risk_payload({**GEMINI_OK, "answers_match_photo": False})
        self.assertTrue(result["answers_match_photo"])

    def test_named_conflicts_block(self):
        result = validate_risk_payload(CONFLICT)
        self.assertFalse(result["answers_match_photo"])
        self.assertEqual(result["answer_conflicts"], CONFLICT["answer_conflicts"])


class NotApplicableAnswersTests(RiskTestCase):
    def test_leaf_and_flower_answers_are_not_claims_for_a_mushroom(self):
        from .risk_evaluation_service import NOT_APPLICABLE_TEXT, build_context

        farmer = make_user("farmer@example.com")
        assessment = Assessment(
            plant=self.make_plant(farmer, crop_id="mushroom"),
            assessment_date=timezone.localdate(), plant_age_days=30,
            growth_condition="as_expected", health_condition="healthy",
            leaf_condition="healthy", flowering_status="not_flowering",
            fruiting_status="ripening", watering_frequency="daily",
        )

        answers = build_context(assessment)["farmer_assessment"]

        self.assertEqual(answers["leaf_condition"], NOT_APPLICABLE_TEXT)
        self.assertEqual(answers["flowering_status"], NOT_APPLICABLE_TEXT)
        self.assertEqual(answers["fruiting_status"], "Fruit ripening")

    def test_root_crops_skip_fruiting_and_others_keep_every_question(self):
        from .assessment_questions import NOT_APPLICABLE, not_applicable

        for crop_id in ("purple-sweet-potato", "ginger", "radish-jicama"):
            self.assertEqual(not_applicable(crop_id), ("fruiting_status",))
        self.assertEqual(not_applicable("tomato"), ())
        # Every crop named in the rule is a real catalog crop.
        self.assertEqual(
            set(Crop.objects.filter(pk__in=NOT_APPLICABLE).values_list("pk", flat=True)),
            set(NOT_APPLICABLE),
        )

    def test_crop_api_lists_the_questions_to_hide(self):
        make_user("farmer@example.com")
        auth = self.login("farmer@example.com")
        crops = {c["id"]: c for c in self.client.get("/api/farmer/crops/", **auth).json()}
        self.assertEqual(
            crops["mushroom"]["not_applicable_questions"],
            ["plant_height_cm", "leaf_condition", "flowering_status"],
        )
        self.assertEqual(crops["tomato"]["not_applicable_questions"], [])

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK)
    def test_mushroom_submits_without_leaf_and_stores_skipped_answers_blank(self, _mock):
        farmer = make_user("farmer@example.com")
        auth = self.login("farmer@example.com")
        plant = self.make_plant(farmer, crop_id="mushroom")
        payload = payload_with_image(plant_height_cm="12", flowering_status="flowering")
        del payload["leaf_condition"]

        response = self.client.post(
            f"/api/farmer/plants/{plant.id}/assessments/", payload, **auth
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        saved = Assessment.objects.get()
        self.assertEqual(saved.leaf_condition, "")
        self.assertEqual(saved.flowering_status, "")
        self.assertIsNone(saved.plant_height_cm)

    def test_leaf_is_still_required_where_it_applies(self):
        farmer = make_user("farmer@example.com")
        auth = self.login("farmer@example.com")
        plant = self.make_plant(farmer, crop_id="tomato")
        payload = payload_with_image()
        del payload["leaf_condition"]

        response = self.client.post(
            f"/api/farmer/plants/{plant.id}/assessments/", payload, **auth
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("leaf_condition", response.data)

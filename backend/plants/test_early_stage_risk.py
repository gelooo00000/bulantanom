"""
A young plant gets an honest "too early to tell", not an invented risk level.

A panel review asked why the AI rated a plant that was zero days old. Two
things were wrong: the first assessment could be taken on planting day (fixed
in `assessment_schedule`), and LOW/MEDIUM/HIGH were the only answers the model
was allowed to give, so it had to rate a seed it could not see. It can now
answer INCONCLUSIVE, and a photo that contradicts the planting date is
reported as a record-keeping problem rather than as danger to the crop.
"""

from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone

from accounts.models import AccountStatus, User, UserRole

from .models import Assessment, Crop, Plant, RiskLevel
from .risk_evaluation_service import EARLY_STAGE_DAYS, build_context, evaluate_assessment
from .test_soil import _FakeResponse

BASE = {
    "risk_level": "LOW",
    "summary": "Developing as expected.",
    "reality_vs_expectation": {"expected": "a", "observed": "b", "assessment": "c"},
    "risk_factors": [],
    "recommended_actions": ["Keep watering."],
    "next_assessment_days": 7,
}


@override_settings(GEMINI_API_KEY="test-key", GEMINI_MODEL="primary-model")
class EarlyStageRiskTests(TestCase):
    def setUp(self):
        farmer = User.objects.create_user(
            email="farmer@example.com", password="SecurePassword123!",
            first_name="Test", last_name="Farmer",
            role=UserRole.FARMER, account_status=AccountStatus.APPROVED,
        )
        self.crop = Crop.objects.get(pk="guava")
        self.farmer = farmer

    def assessment_at(self, age_days):
        plant = Plant.objects.create(
            farmer=self.farmer,
            crop=self.crop,
            planting_date=timezone.localdate() - timedelta(days=age_days),
        )
        return Assessment.objects.create(
            plant=plant,
            plant_age_days=age_days,
            growth_condition="as_expected",
            health_condition="healthy",
            leaf_condition="healthy",
            watering_frequency="daily",
        )

    def evaluate(self, assessment, payload):
        with patch("google.genai.Client") as client_cls:
            client_cls.return_value.models.generate_content.return_value = _FakeResponse(payload)
            return evaluate_assessment(assessment)

    def test_the_model_is_told_when_a_plant_is_still_establishing(self):
        young = build_context(self.assessment_at(7))
        self.assertTrue(young["plant"]["early_establishment_stage"])
        grown = build_context(self.assessment_at(EARLY_STAGE_DAYS + 1))
        self.assertFalse(grown["plant"]["early_establishment_stage"])

    def test_inconclusive_is_accepted_as_an_answer(self):
        result = self.evaluate(
            self.assessment_at(7),
            {**BASE, "risk_level": "INCONCLUSIVE", "summary": "Only a week old."},
        )
        self.assertEqual(result["risk_level"], "INCONCLUSIVE")
        self.assertFalse(result["date_mismatch"])
        self.assertEqual(RiskLevel("INCONCLUSIVE").label, "Too early to tell")

    def test_a_photo_that_contradicts_the_date_is_not_reported_as_high_risk(self):
        # The live case: a crop recorded as planted today, photographed as a
        # mature harvest, came back HIGH. It is a wrong date, not a hazard.
        result = self.evaluate(
            self.assessment_at(0),
            {
                **BASE,
                "risk_level": "HIGH",
                "summary": "The photo shows mature mushrooms on a plant recorded as new.",
                "planting_date_mismatch": True,
            },
        )
        self.assertEqual(result["risk_level"], "INCONCLUSIVE")
        self.assertTrue(result["date_mismatch"])

    def test_a_real_problem_still_gets_a_real_level(self):
        result = self.evaluate(
            self.assessment_at(5),
            {**BASE, "risk_level": "HIGH", "summary": "Seedlings are being eaten."},
        )
        self.assertEqual(result["risk_level"], "HIGH")
        self.assertFalse(result["date_mismatch"])

    def test_an_unknown_level_is_still_rejected(self):
        self.assertIsNone(
            self.evaluate(self.assessment_at(5), {**BASE, "risk_level": "UNSURE"})
        )

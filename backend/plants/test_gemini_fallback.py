"""
The weekly assessment's risk evaluation and evidence check fall back to the
next Gemini model, the same way crop intelligence and soil recommendations do.

Seen live: gemini-3.6-flash answered 503 "high demand" and a Farmer's weekly
assessment showed "AI risk analysis is temporarily unavailable". The old loop
retried the same busy model three times — spending its daily quota and a
minute of the Farmer's time — and never tried the configured fallback.
"""

from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone

from accounts.models import AccountStatus, User, UserRole

from .evidence_validation_service import validate_crop_evidence
from .gemini_models import is_transient
from .models import Assessment, Crop, Plant
from .risk_evaluation_service import evaluate_assessment
from .test_soil import _FakeGeminiError, _FakeResponse

RISK_PAYLOAD = {
    "risk_level": "LOW",
    "summary": "Developing as expected for its age.",
    "reality_vs_expectation": {
        "expected": "Vegetative growth.",
        "observed": "Healthy growth.",
        "assessment": "On track.",
    },
    "risk_factors": [],
    "recommended_actions": ["Keep the current watering routine."],
    "next_assessment_days": 7,
}

EVIDENCE_PAYLOAD = {
    "verdict": "match",
    "confidence": 0.9,
    "detected_subject": "guava plant",
    "reason": "The photo shows a guava plant.",
}

BUSY = _FakeGeminiError(503, "UNAVAILABLE. This model is currently experiencing high demand.")


def run_with(side_effect, call):
    with patch("google.genai.Client") as client_cls:
        generate = client_cls.return_value.models.generate_content
        generate.side_effect = side_effect
        result = call()
    return result, [c.kwargs["model"] for c in generate.call_args_list]


@override_settings(
    GEMINI_API_KEY="test-key",
    GEMINI_MODEL="primary-model",
    GEMINI_FALLBACK_MODELS=["fallback-model"],
)
class RiskEvaluationFallbackTests(TestCase):
    def setUp(self):
        farmer = User.objects.create_user(
            email="farmer@example.com", password="SecurePassword123!",
            first_name="Test", last_name="Farmer",
            role=UserRole.FARMER, account_status=AccountStatus.APPROVED,
        )
        plant = Plant.objects.create(
            farmer=farmer,
            crop=Crop.objects.get(pk="guava"),
            planting_date=timezone.localdate() - timedelta(days=30),
        )
        self.assessment = Assessment.objects.create(
            plant=plant,
            plant_age_days=30,
            growth_condition="as_expected",
            health_condition="healthy",
            leaf_condition="healthy",
            watering_frequency="daily",
        )

    def evaluate(self, side_effect):
        return run_with(side_effect, lambda: evaluate_assessment(self.assessment))

    def test_overloaded_primary_falls_back_to_the_next_model(self):
        result, models = self.evaluate([BUSY, _FakeResponse(RISK_PAYLOAD)])
        self.assertEqual(models, ["primary-model", "fallback-model"])
        self.assertEqual(result["risk_level"], "LOW")
        self.assertEqual(result["model_name"], "fallback-model")

    def test_the_busy_model_is_not_retried(self):
        _, models = self.evaluate(BUSY)
        self.assertEqual(models, ["primary-model", "fallback-model"])

    def test_a_healthy_primary_is_used_alone(self):
        result, models = self.evaluate([_FakeResponse(RISK_PAYLOAD)])
        self.assertEqual(models, ["primary-model"])
        self.assertEqual(result["model_name"], "primary-model")

    def test_a_bad_request_does_not_try_another_model(self):
        result, models = self.evaluate([_FakeGeminiError(400, "INVALID_ARGUMENT")])
        self.assertEqual(models, ["primary-model"])
        self.assertIsNone(result)


@override_settings(
    GEMINI_API_KEY="test-key",
    GEMINI_MODEL="primary-model",
    GEMINI_FALLBACK_MODELS=["fallback-model"],
)
class EvidenceValidationFallbackTests(TestCase):
    def test_overloaded_primary_falls_back_to_the_next_model(self):
        crop = Crop.objects.get(pk="guava")
        result, models = run_with(
            [_FakeGeminiError(429, "RESOURCE_EXHAUSTED"), _FakeResponse(EVIDENCE_PAYLOAD)],
            lambda: validate_crop_evidence(crop, b"fake-image", "image/jpeg"),
        )
        self.assertEqual(models, ["primary-model", "fallback-model"])
        self.assertTrue(result["evidence_valid"])


class TransientErrorTests(TestCase):
    def test_busy_and_out_of_quota_are_worth_another_model(self):
        self.assertTrue(is_transient(_FakeGeminiError(503, "UNAVAILABLE")))
        self.assertTrue(is_transient(_FakeGeminiError(429, "RESOURCE_EXHAUSTED")))

    def test_a_deadline_is_not(self):
        # It already spent the whole timeout; another model would double the wait.
        self.assertFalse(is_transient(_FakeGeminiError(504, "DEADLINE_EXCEEDED")))
        self.assertFalse(is_transient(_FakeGeminiError(400, "INVALID_ARGUMENT")))

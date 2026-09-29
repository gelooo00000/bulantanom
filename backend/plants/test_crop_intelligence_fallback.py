"""
Crop intelligence falls back to the next Gemini model, the same way soil
recommendations do.

Seen live: gemini-3.6-flash answered 503 "This model is currently
experiencing high demand", and Add Plant showed "Crop intelligence is
temporarily unavailable" although the fallback model was configured and
idle. An overloaded or out-of-quota model is now skipped for the next one.
"""

from unittest.mock import patch

from django.test import TestCase, override_settings

from .crop_intelligence_service import (
    generate_crop_intelligence,
    get_or_create_crop_intelligence,
)
from .models import Crop, CropIntelligence
from .test_soil import _FakeGeminiError, _FakeResponse

PAYLOAD = {
    "crop_overview": "Guava grows well in Bulan's lowland heat.",
    "growing_notes": ["Full sun."],
    "care_guidance": ["Water weekly in the dry months."],
    "harvest_guidance": "Pick when the skin softens.",
    "important_factors": ["Typhoon season."],
}


@override_settings(
    GEMINI_API_KEY="test-key",
    GEMINI_MODEL="primary-model",
    GEMINI_FALLBACK_MODELS=["fallback-model"],
)
class CropIntelligenceFallbackTests(TestCase):
    def setUp(self):
        self.crop = Crop.objects.get(pk="guava")

    def run_with(self, side_effect):
        with patch("google.genai.Client") as client_cls:
            generate = client_cls.return_value.models.generate_content
            generate.side_effect = side_effect
            result = generate_crop_intelligence(self.crop)
        return result, [call.kwargs["model"] for call in generate.call_args_list]

    def test_overloaded_primary_falls_back_to_the_next_model(self):
        result, models = self.run_with([
            _FakeGeminiError(503, "UNAVAILABLE. This model is currently experiencing high demand."),
            _FakeResponse(PAYLOAD),
        ])
        self.assertEqual(models, ["primary-model", "fallback-model"])
        self.assertEqual(result["crop_overview"], PAYLOAD["crop_overview"])
        self.assertEqual(result["model_name"], "fallback-model")

    def test_exhausted_daily_quota_falls_back_too(self):
        result, models = self.run_with([
            _FakeGeminiError(429, "RESOURCE_EXHAUSTED"),
            _FakeResponse(PAYLOAD),
        ])
        self.assertEqual(models, ["primary-model", "fallback-model"])
        self.assertIsNotNone(result)

    def test_a_healthy_primary_is_used_alone(self):
        result, models = self.run_with([_FakeResponse(PAYLOAD)])
        self.assertEqual(models, ["primary-model"])
        self.assertEqual(result["model_name"], "primary-model")

    def test_a_non_transient_error_does_not_try_another_model(self):
        result, models = self.run_with([_FakeGeminiError(400, "INVALID_ARGUMENT")])
        self.assertEqual(models, ["primary-model"])
        self.assertIsNone(result)

    def test_every_model_overloaded_is_still_unavailable(self):
        result, models = self.run_with(_FakeGeminiError(503, "UNAVAILABLE"))
        self.assertEqual(models, ["primary-model", "fallback-model"])
        self.assertIsNone(result)

    def test_a_timed_out_primary_falls_back_within_the_budget(self):
        """
        Seen live: a busy primary timed out instead of refusing, and Add
        Plant said "unavailable" while the next model answered in 9s.
        """
        result, models = self.run_with([
            _FakeGeminiError(504, "DEADLINE_EXCEEDED"),
            _FakeResponse(PAYLOAD),
        ])
        self.assertEqual(models, ["primary-model", "fallback-model"])
        self.assertEqual(result["model_name"], "fallback-model")

    @override_settings(GEMINI_INTELLIGENCE_BUDGET_SECONDS=0)
    def test_a_timeout_past_the_budget_stops_there(self):
        result, models = self.run_with([_FakeGeminiError(504, "DEADLINE_EXCEEDED")])
        self.assertEqual(models, ["primary-model"])
        self.assertIsNone(result)

    def test_the_prompt_asks_about_the_variety_and_the_farm(self):
        from .crop_intelligence_service import _build_prompt
        from .models import CropVariant

        variant = CropVariant.objects.get(pk="rambutan-rongrien")
        prompt = _build_prompt(variant.crop, variant=variant)
        self.assertIn(f"Crop: {variant.name}", prompt)
        self.assertIn("Bulan, Sorsogon", prompt)

    def test_the_cache_records_the_model_that_actually_answered(self):
        with patch("google.genai.Client") as client_cls:
            client_cls.return_value.models.generate_content.side_effect = [
                _FakeGeminiError(503, "UNAVAILABLE"),
                _FakeResponse(PAYLOAD),
            ]
            intelligence, generated_now = get_or_create_crop_intelligence(self.crop)
        self.assertTrue(generated_now)
        self.assertEqual(intelligence.model_name, "fallback-model")
        self.assertEqual(CropIntelligence.objects.get(crop=self.crop).model_name, "fallback-model")

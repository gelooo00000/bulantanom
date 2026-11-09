"""
The AI's crop knowledge and the rules that keep a dying plant from being read
as "growing as expected".
"""

from types import SimpleNamespace

from django.test import TestCase

from . import evidence_validation_service as photo
from . import risk_evaluation_service as risk
from .crop_knowledge import CROPS, knowledge_for
from .models import Crop


def photo_payload(vitality, **observed):
    return {
        "verdict": "match",
        "confidence": 0.9,
        "detected_subject": "lettuce plants",
        "reason": "The photo shows lettuce.",
        "observed_stage": "vegetative",
        "vitality": vitality,
        "observed": {
            "growth_condition": "as_expected",
            "health_condition": "healthy",
            "leaf_condition": "healthy",
            "flowering_status": "unknown",
            "fruiting_status": "unknown",
            "mushroom_condition": "unknown",
            **observed,
        },
    }


class CropKnowledgeTests(TestCase):
    def test_every_crop_on_the_farm_has_a_reference(self):
        missing = [c.id for c in Crop.objects.filter(is_active=True) if c.id not in CROPS]
        self.assertEqual(missing, [])

    def test_each_reference_has_the_essentials(self):
        for crop_id, entry in CROPS.items():
            for key in ("healthy", "warning_signs", "pests", "diseases", "care"):
                self.assertTrue(entry.get(key), f"{crop_id} is missing {key}")

    def test_the_photo_check_and_risk_evaluation_are_given_it(self):
        lettuce = Crop.objects.get(pk="lettuce-cabbage")
        context = photo.build_context(lettuce, age_days=30, duration_days=70)
        self.assertIn("soft rot", str(context["crop_reference"]["this_crop"]))
        self.assertIn("vitality_scale", context["crop_reference"]["general"])
        self.assertEqual(knowledge_for(lettuce)["this_crop"], CROPS["lettuce-cabbage"])


class DyingPlantPhotoTests(TestCase):
    def setUp(self):
        self.lettuce = Crop.objects.get(pk="lettuce-cabbage")

    def validate(self, payload):
        return photo._validate(payload, self.lettuce, age_days=30, duration_days=70)

    def test_a_rotting_full_size_plant_is_never_suggested_as_expected(self):
        result = self.validate(photo_payload("dying_or_dead"))
        self.assertTrue(result["evidence_valid"])  # still the right crop
        self.assertEqual(result["vitality"], "dying_or_dead")
        self.assertEqual(result["suggested_answers"]["growth_condition"], "stunted")
        self.assertEqual(result["suggested_answers"]["health_condition"], "unhealthy")
        self.assertEqual(result["suggested_answers"]["leaf_condition"], "damaged")

    def test_severe_decline_is_treated_the_same(self):
        result = self.validate(photo_payload("severe_decline", growth_condition="faster_than_expected"))
        self.assertEqual(result["suggested_answers"]["growth_condition"], "stunted")

    def test_a_healthy_plant_keeps_its_answers(self):
        result = self.validate(photo_payload("normal"))
        self.assertEqual(result["suggested_answers"]["growth_condition"], "as_expected")
        self.assertEqual(result["suggested_answers"]["health_condition"], "healthy")

    def test_more_serious_leaf_answers_are_kept(self):
        result = self.validate(photo_payload("dying_or_dead", leaf_condition="wilting"))
        self.assertEqual(result["suggested_answers"]["leaf_condition"], "wilting")


class DyingPlantRiskTests(TestCase):
    def reading(self, level="MEDIUM", **extra):
        return {
            "risk_level": level,
            "date_mismatch": False,
            "answers_match_photo": True,
            "risk_factors": [],
            **extra,
        }

    def assessment(self, vitality):
        return SimpleNamespace(evidence_validation={"vitality": vitality})

    def test_a_dying_plant_is_high_risk(self):
        result = self.reading("LOW")
        risk._floor_for_dying_plant(result, self.assessment("dying_or_dead"))
        self.assertEqual(result["risk_level"], "HIGH")
        self.assertEqual(result["risk_factors"][0]["severity"], "high")
        self.assertIn("dying", result["risk_factors"][0]["factor"])

    def test_a_stressed_plant_keeps_the_model_level(self):
        result = self.reading("MEDIUM")
        risk._floor_for_dying_plant(result, self.assessment("stressed"))
        self.assertEqual(result["risk_level"], "MEDIUM")

    def test_contradicting_answers_are_left_for_the_farmer_to_fix(self):
        result = self.reading("LOW", answers_match_photo=False)
        risk._floor_for_dying_plant(result, self.assessment("dying_or_dead"))
        self.assertEqual(result["risk_level"], "LOW")

    def test_the_prompts_judge_condition_before_size(self):
        self.assertIn("CONDITION BEFORE SIZE", photo.SYSTEM_INSTRUCTION)
        self.assertIn('NEVER "as_expected"', photo.SYSTEM_INSTRUCTION)
        self.assertIn("one severe sign is enough for HIGH", risk.SYSTEM_INSTRUCTION)

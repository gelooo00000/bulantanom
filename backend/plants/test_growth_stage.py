"""
The photo check now knows the plant's age. These pin the rule that refused
nothing before: a photo far older than the planting date allows (fruit on a
Singkamas sown 11 days ago) is not accepted as this plant's evidence.
"""

from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework import status

from .growth_stage import expected_stage, growing_days, too_far_ahead
from .models import Crop, CropVariant, Plant
from .test_risk import RiskTestCase, make_image, make_user

MATCH = {
    "verdict": "match",
    "confidence": 0.9,
    "detected_subject": "jicama plant with pods",
    "reason": "A jicama plant.",
    "observed": {"health_condition": "healthy", "fruiting_status": "forming"},
}


class StageScaleTests(TestCase):
    def test_expected_stage_follows_the_share_of_growing_time(self):
        self.assertEqual(expected_stage(150, 11), "seedling")
        self.assertEqual(expected_stage(150, 40), "vegetative")
        self.assertEqual(expected_stage(150, 90), "flowering")
        self.assertEqual(expected_stage(150, 130), "fruiting")
        self.assertEqual(expected_stage(150, 160), "mature")
        self.assertIsNone(expected_stage(0, 10))

    def test_only_a_clearly_older_photo_is_too_far_ahead(self):
        self.assertTrue(too_far_ahead("seedling", "fruiting"))
        self.assertTrue(too_far_ahead("seedling", "flowering"))
        self.assertTrue(too_far_ahead("vegetative", "mature"))
        # One stage of slack, and younger-looking plants are never refused.
        self.assertFalse(too_far_ahead("seedling", "vegetative"))
        self.assertFalse(too_far_ahead("vegetative", "flowering"))
        self.assertFalse(too_far_ahead("fruiting", "seedling"))
        self.assertFalse(too_far_ahead("seedling", "unknown"))
        self.assertFalse(too_far_ahead(None, "fruiting"))

    def test_growing_days_follow_the_variety(self):
        farmer = make_user("grower@example.com")
        crop = Crop.objects.get(pk="radish-jicama")
        variant = CropVariant.objects.filter(crop=crop, name__icontains="singkamas").first()
        plant = Plant.objects.create(
            farmer=farmer, crop=crop, variant=variant, planting_date=timezone.localdate()
        )
        self.assertEqual(
            growing_days(plant), (plant.expected_harvest_start - plant.planting_date).days
        )
        self.assertGreater(growing_days(plant), crop.growing_duration_days)


class PhotoAgeRuleTests(TestCase):
    def _validate(self, payload, crop_id="radish-jicama", age=11, duration=150):
        from .evidence_validation_service import _validate

        return _validate(payload, Crop.objects.get(pk=crop_id), age, duration)

    def test_fruit_on_an_eleven_day_old_singkamas_is_refused(self):
        result = self._validate({**MATCH, "observed_stage": "fruiting"})
        self.assertFalse(result["evidence_valid"])
        self.assertEqual(result["verdict"], "wrong_stage")
        self.assertIn("11 days", result["reason"])
        self.assertIn("planting date", result["message"])
        self.assertEqual(result["suggested_answers"], {})

    def test_a_young_plant_that_fits_its_age_is_accepted(self):
        for stage in ("seedling", "vegetative", "unknown"):
            result = self._validate({**MATCH, "observed_stage": stage})
            self.assertTrue(result["evidence_valid"], stage)

    def test_the_models_own_wrong_stage_verdict_is_kept(self):
        result = self._validate(
            {**MATCH, "verdict": "wrong_stage", "observed_stage": "fruiting",
             "reason": "Pods are visible on a plant planted 11 days ago."}
        )
        self.assertFalse(result["evidence_valid"])
        self.assertEqual(result["reason"], "Pods are visible on a plant planted 11 days ago.")

    def test_long_lived_crops_and_mushrooms_are_not_judged_on_age(self):
        # A nursery sapling may flower early; mushrooms have no such stages.
        for crop_id, duration in (("avocado", 1460), ("mushroom", 18)):
            for verdict in ("match", "wrong_stage"):
                result = self._validate(
                    {**MATCH, "verdict": verdict, "observed_stage": "mature"},
                    crop_id=crop_id, age=11, duration=duration,
                )
                self.assertTrue(result["evidence_valid"], (crop_id, verdict))

    def test_the_ai_is_told_the_age_and_expected_stage(self):
        from .evidence_validation_service import build_context

        context = build_context(Crop.objects.get(pk="radish-jicama"), 11, 150)
        self.assertEqual(
            context["plant_age"],
            {"days_since_planting": 11, "readable": "11 days", "expected_stage": "seedling"},
        )


class PhotoCheckGetsThePlantsAgeTests(RiskTestCase):
    def test_the_endpoint_passes_age_and_variety_growing_time(self):
        farmer = make_user("farmer@example.com")
        auth = self.login("farmer@example.com")
        plant = self.make_plant(farmer, days_ago=11)
        self.client.post(
            f"/api/farmer/plants/{plant.id}/evidence/validate/",
            {"evidence_image": make_image()},
            **auth,
        )
        args = self.mock_validate_evidence.call_args.args
        self.assertEqual(args[4], 11)
        self.assertEqual(args[5], growing_days(plant))


class SamePlantRuleTests(TestCase):
    def test_an_annual_cannot_go_back_to_a_seedling_or_jump_two_stages(self):
        from .growth_stage import not_the_same_plant

        self.assertTrue(not_the_same_plant("fruiting", "seedling", 7))
        self.assertTrue(not_the_same_plant("flowering", "seedling", 30))
        self.assertTrue(not_the_same_plant("vegetative", "fruiting", 7))
        # Normal growth, slow growth, and a big change over a long gap.
        self.assertFalse(not_the_same_plant("vegetative", "flowering", 7))
        self.assertFalse(not_the_same_plant("fruiting", "vegetative", 7))
        self.assertFalse(not_the_same_plant("vegetative", "fruiting", 30))
        self.assertFalse(not_the_same_plant(None, "seedling", 7))
        self.assertFalse(not_the_same_plant("fruiting", "unknown", 7))


class PreviousPhotoTests(TestCase):
    def _validate(self, payload, previous, crop_id="tomato", age=60, duration=85):
        from .evidence_validation_service import _validate

        return _validate(payload, Crop.objects.get(pk=crop_id), age, duration, previous)

    def _previous(self, stage, days=7):
        from .evidence_validation_service import PreviousCheck

        return PreviousCheck(days_ago=days, observed_stage=stage)

    def test_a_tomato_that_was_fruiting_last_week_is_not_a_seedling_now(self):
        result = self._validate(
            {**MATCH, "observed_stage": "seedling"}, self._previous("fruiting"), age=60
        )
        self.assertFalse(result["evidence_valid"])
        self.assertEqual(result["verdict"], "different_plant")
        self.assertIn("7 days ago", result["reason"])
        self.assertIn("same plant", result["message"])

    def test_normal_growth_since_last_time_is_accepted(self):
        result = self._validate(
            {**MATCH, "observed_stage": "flowering"}, self._previous("vegetative"), age=40
        )
        self.assertTrue(result["evidence_valid"])

    def test_the_models_different_plant_needs_something_to_compare(self):
        payload = {**MATCH, "verdict": "different_plant", "observed_stage": "vegetative"}
        self.assertTrue(self._validate(payload, None, age=30)["evidence_valid"])
        self.assertEqual(
            self._validate(payload, self._previous("vegetative"), age=30)["verdict"],
            "different_plant",
        )

    def test_mushrooms_are_never_refused_as_a_different_plant(self):
        payload = {**MATCH, "verdict": "different_plant", "observed_stage": "seedling"}
        result = self._validate(
            payload, self._previous("mature"), crop_id="mushroom", age=11, duration=18
        )
        self.assertTrue(result["evidence_valid"])

    def test_the_ai_is_told_about_the_previous_check(self):
        from .evidence_validation_service import PreviousCheck, build_context

        context = build_context(
            Crop.objects.get(pk="tomato"), 60, 85,
            PreviousCheck(days_ago=7, observed_stage="flowering", image_bytes=b"jpeg"),
        )
        self.assertEqual(
            context["previous_check"],
            {"days_ago": 7, "stage_seen_then": "flowering", "previous_photo_attached": True},
        )


class PhotoCheckGetsThePreviousPhotoTests(RiskTestCase):
    def setUp(self):
        super().setUp()
        self.farmer = make_user("farmer@example.com")
        self.auth = self.login("farmer@example.com")
        self.plant = self.make_plant(self.farmer, days_ago=30)

    def _last_assessment(self, with_file=True):
        from django.core.files.base import ContentFile

        from .models import Assessment

        assessment = Assessment.objects.create(
            plant=self.plant,
            assessment_date=timezone.localdate() - timedelta(days=7),
            plant_age_days=23,
            growth_condition="as_expected",
            health_condition="healthy",
            watering_frequency="daily",
            evidence_validation={"observed_stage": "vegetative"},
        )
        if with_file:
            assessment.evidence_image.save("last.jpg", ContentFile(b"last-week-jpeg"))
        else:
            assessment.evidence_image.name = "evidence/gone-after-redeploy.jpg"
            assessment.save()
        return assessment

    def _check(self):
        self.client.post(
            f"/api/farmer/plants/{self.plant.id}/evidence/validate/",
            {"evidence_image": make_image()},
            **self.auth,
        )
        return self.mock_validate_evidence.call_args.args[6]

    def test_a_first_assessment_has_nothing_to_compare(self):
        self.assertIsNone(self._check())

    def test_the_last_photo_and_its_stage_are_passed(self):
        self._last_assessment()
        previous = self._check()
        self.assertEqual(previous.days_ago, 7)
        self.assertEqual(previous.observed_stage, "vegetative")
        self.assertEqual(previous.image_bytes, b"last-week-jpeg")

    def test_a_lost_photo_file_still_passes_the_recorded_stage(self):
        self._last_assessment(with_file=False)
        previous = self._check()
        self.assertEqual(previous.observed_stage, "vegetative")
        self.assertIsNone(previous.image_bytes)

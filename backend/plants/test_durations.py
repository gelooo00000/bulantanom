"""
Durations are put to Gemini the way a farmer says them.

A Cardinal avocado is stored as 1460 days. The cached crop information came
back quoting "around 1460 days", which is the system's own bookkeeping read
back to the Farmer rather than an answer. The prompts now carry the readable
form alongside the number.
"""

from django.test import TestCase

from .crop_intelligence_service import _build_prompt
from .durations import human_duration
from .models import Crop
from .risk_evaluation_service import build_context


class HumanDurationTests(TestCase):
    def test_tree_crops_are_years_not_day_counts(self):
        self.assertEqual(human_duration(1460), "about 4 years")
        self.assertEqual(human_duration(1825), "about 5 years")
        self.assertEqual(human_duration(365), "about 1 year")

    def test_shorter_crops_keep_their_own_scale(self):
        self.assertEqual(human_duration(90), "about 3 months")
        self.assertEqual(human_duration(21), "about 3 weeks")
        self.assertEqual(human_duration(5), "5 days")
        self.assertEqual(human_duration(1), "1 day")

    def test_a_month_or_so_over_a_year_does_not_become_clutter(self):
        # 1500 days is 4 years and a few weeks; nobody says "4 years 1 month".
        self.assertEqual(human_duration(1500), "about 4 years")

    def test_a_missing_duration_is_said_plainly(self):
        self.assertEqual(human_duration(None), "an unknown length of time")


class PromptWordingTests(TestCase):
    def test_crop_information_is_told_how_to_say_the_duration(self):
        prompt = _build_prompt(Crop.objects.get(pk="avocado"))
        self.assertIn("about 4 years", prompt)
        # The number stays too — it is the fact; the wording is how to say it.
        self.assertIn("1460 days", prompt)

    def test_the_risk_context_carries_readable_durations(self):
        crop = Crop.objects.get(pk="avocado")

        class _Plant:
            planting_date = __import__("datetime").date(2026, 9, 23)
            expected_harvest_start = __import__("datetime").date(2030, 9, 22)
            expected_harvest_end = __import__("datetime").date(2030, 12, 21)

        plant = _Plant()
        plant.crop = crop

        class _Assessment:
            plant_age_days = 400
            assessment_date = __import__("datetime").date(2027, 10, 28)
            plant_height_cm = None
            evidence_image = None
            evidence_validated = True
            evidence_validation = {}
            pest_observation = ""
            disease_observation = ""
            environmental_observations = ""
            notes = ""

            def get_growth_condition_display(self):
                return "About as expected"

            get_health_condition_display = get_growth_condition_display
            get_leaf_condition_display = get_growth_condition_display
            get_flowering_status_display = get_growth_condition_display
            get_fruiting_status_display = get_growth_condition_display
            get_watering_frequency_display = get_growth_condition_display
            get_soil_moisture_display = get_growth_condition_display

        assessment = _Assessment()
        assessment.plant = plant

        context = build_context(assessment)
        self.assertEqual(context["crop"]["growing_duration_readable"], "about 4 years")
        self.assertEqual(context["plant"]["age_readable"], "about 1 year")

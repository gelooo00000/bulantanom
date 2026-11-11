"""
Once a crop is ready to harvest, the weekly assessment is no longer asked for:
the plant is grown, and what is left is to harvest it.
"""

from datetime import timedelta

from django.utils import timezone

from .assessment_schedule import eligibility
from .test_risk import RiskTestCase, make_user


class ReadyToHarvestTests(RiskTestCase):
    def setUp(self):
        super().setUp()
        self.farmer = make_user("farmer@example.com")
        self.auth = self.login("farmer@example.com")

    def ripe(self, days_into_harvest=0):
        """A plant whose harvest period started `days_into_harvest` days ago."""
        plant = self.make_plant(self.farmer, days_ago=60)
        today = timezone.localdate()
        plant.expected_harvest_start = today - timedelta(days=days_into_harvest)
        plant.expected_harvest_end = today + timedelta(days=14)
        plant.save(update_fields=["expected_harvest_start", "expected_harvest_end"])
        return plant

    def test_no_weekly_check_from_the_first_day_of_harvest(self):
        for days in (0, 5):
            schedule = eligibility(self.ripe(days))
            self.assertFalse(schedule["can_assess"])
            self.assertTrue(schedule["ready_to_harvest"])
            self.assertIsNone(schedule["next_assessment_date"])
            self.assertEqual(schedule["days_remaining"], 0)

    def test_the_day_before_harvest_it_is_still_assessed(self):
        plant = self.ripe(-1)
        schedule = eligibility(plant)
        self.assertTrue(schedule["can_assess"])
        self.assertNotIn("ready_to_harvest", schedule)

    def test_the_server_refuses_a_weekly_check_and_says_why(self):
        plant = self.ripe()
        response = self.client.post(
            f"/api/farmer/plants/{plant.pk}/assessments/", {}, format="multipart", **self.auth
        )
        self.assertEqual(response.status_code, 409)
        self.assertIn("ready to harvest", response.data["detail"])
        self.assertTrue(response.data["assessment_eligibility"]["ready_to_harvest"])

    def test_the_plant_list_tells_the_farmer(self):
        plant = self.ripe()
        rows = self.client.get("/api/farmer/plants/", **self.auth).data
        rows = rows["results"] if isinstance(rows, dict) else rows
        row = next(r for r in rows if r["id"] == plant.pk)
        self.assertTrue(row["assessment_eligibility"]["ready_to_harvest"])
        self.assertFalse(row["assessment_eligibility"]["can_assess"])

    def test_a_ripe_plant_is_not_a_first_assessment_task(self):
        from .dashboard_service import alerts

        self.ripe()
        messages = [a["message"] for a in alerts(self.farmer)]
        self.assertFalse(any("first assessment" in m for m in messages), messages)

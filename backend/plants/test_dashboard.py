"""
Farmer dashboard payload tests.

The dashboard's whole value is that a farmer can trust it at a glance, so
what these pin is mostly the negative space: that a reading the farm never
took is reported as absent rather than as a zero, that an alert only fires
on a real count, and that a quiet day appears in the trend as a zero instead
of vanishing and flattering the farmer's assessment habit.

No AI is involved in this endpoint, so nothing here is mocked.
"""

from datetime import date, timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import AccountStatus, User, UserRole

from . import dashboard_service
from .models import Assessment, Crop, Plant, RiskAssessment, SoilRecommendation

URL = "/api/farmer/dashboard/"
LOGIN_URL = "/api/auth/farmer/login/"
PW = "SecurePassword123!"


def make_farmer(email="farmer@example.com"):
    return User.objects.create_user(
        email=email,
        password=PW,
        first_name="Test",
        last_name="Farmer",
        role=UserRole.FARMER,
        account_status=AccountStatus.APPROVED,
    )


class DashboardServiceTests(APITestCase):
    def setUp(self):
        self.farmer = make_farmer()
        self.today = timezone.localdate()
        self.crop = Crop.objects.get(id="eggplant")

    def _plant(self, planting_date=None, **kwargs):
        return Plant.objects.create(
            farmer=self.farmer,
            crop=self.crop,
            planting_date=planting_date or (self.today - timedelta(days=40)),
            **kwargs,
        )

    def _assessment(self, plant, on):
        return Assessment.objects.create(
            plant=plant,
            assessment_date=on,
            plant_age_days=30,
            growth_condition="healthy",
            health_condition="healthy",
            leaf_condition="green",
            watering_frequency="daily",
            soil_moisture=Decimal("65"),
        )

    # ---------------------------------------------------------------- trend
    def test_trend_includes_quiet_days_as_zero(self):
        plant = self._plant()
        self._assessment(plant, self.today)
        self._assessment(plant, self.today - timedelta(days=2))

        trend = dashboard_service.assessment_trend(self.farmer, self.today)

        self.assertEqual(len(trend["days"]), dashboard_service.TREND_DAYS)
        self.assertEqual(trend["total"], 2)
        by_date = {d["date"]: d["count"] for d in trend["days"]}
        self.assertEqual(by_date[self.today.isoformat()], 1)
        # The gap day is present and zero, not missing.
        gap = (self.today - timedelta(days=1)).isoformat()
        self.assertEqual(by_date[gap], 0)

    def test_trend_counts_several_assessments_on_one_day(self):
        a, b = self._plant(), self._plant()
        self._assessment(a, self.today)
        self._assessment(b, self.today)

        trend = dashboard_service.assessment_trend(self.farmer, self.today)
        by_date = {d["date"]: d["count"] for d in trend["days"]}
        self.assertEqual(by_date[self.today.isoformat()], 2)
        self.assertEqual(trend["busiest_count"], 2)

    def test_trend_excludes_another_farmers_assessments(self):
        other = make_farmer("other@example.com")
        other_plant = Plant.objects.create(
            farmer=other, crop=self.crop, planting_date=self.today - timedelta(days=30)
        )
        self._assessment(other_plant, self.today)

        trend = dashboard_service.assessment_trend(self.farmer, self.today)
        self.assertEqual(trend["total"], 0)

    # --------------------------------------------------- crop suggestions
    def _analysed_row(self, **over):
        defaults = dict(
            farmer=self.farmer,
            soil_ph=Decimal("6.40"),
            soil_temperature=Decimal("28.0"),
            soil_moisture=Decimal("65"),
            ai_generated=True,
            suitable_fruits=[
                {"id": "pineapple", "name": "Pineapple", "emoji": "🍍",
                 "reason": "Suits acidic soil."}
            ],
            suitable_vegetables=[
                {"id": "eggplant", "name": "Eggplant", "emoji": "🍆",
                 "reason": "Tolerates the moisture recorded."}
            ],
            suitable_crops=[],
        )
        defaults.update(over)
        return SoilRecommendation.objects.create(**defaults)

    def test_suggestions_are_empty_until_an_assessment_is_analysed(self):
        result = dashboard_service.crop_suggestions(self.farmer)
        self.assertFalse(result["has_any"])
        self.assertEqual(result["crops"], [])
        self.assertIsNone(result["recorded_on"])

    def test_a_saved_but_unanalysed_assessment_suggests_nothing(self):
        """There is no AI result on it, so there is nothing to show."""
        SoilRecommendation.objects.create(
            farmer=self.farmer,
            soil_ph=Decimal("6.40"),
            soil_temperature=Decimal("28.0"),
            ai_generated=False,
        )
        self.assertFalse(dashboard_service.crop_suggestions(self.farmer)["has_any"])

    def test_the_three_result_sections_become_one_list(self):
        """
        Fruit, vegetable and crop matter to the report. To a farmer choosing
        what to plant next they are one list of things worth planting.
        """
        self._analysed_row()
        result = dashboard_service.crop_suggestions(self.farmer)

        self.assertTrue(result["has_any"])
        self.assertEqual([c["name"] for c in result["crops"]], ["Pineapple", "Eggplant"])
        self.assertEqual(result["crops"][0]["id"], "pineapple")
        self.assertEqual(result["crops"][0]["reason"], "Suits acidic soil.")

    def test_only_the_newest_analysed_assessment_is_used(self):
        self._analysed_row()
        self._analysed_row(
            suitable_fruits=[
                {"id": "banana", "name": "Banana", "emoji": "🍌", "reason": "New soil."}
            ],
            suitable_vegetables=[],
        )
        result = dashboard_service.crop_suggestions(self.farmer)
        # Older advice describes soil the farmer has since re-measured.
        self.assertEqual([c["name"] for c in result["crops"]], ["Banana"])

    def test_a_long_list_is_capped_so_the_card_stays_scannable(self):
        many = [
            {"id": f"c{i}", "name": f"Crop {i}", "emoji": "", "reason": ""}
            for i in range(20)
        ]
        self._analysed_row(suitable_fruits=many, suitable_vegetables=[])
        result = dashboard_service.crop_suggestions(self.farmer)
        self.assertEqual(len(result["crops"]), dashboard_service.MAX_CROP_SUGGESTIONS)

    def test_a_nameless_entry_is_dropped_rather_than_rendered_blank(self):
        self._analysed_row(
            suitable_fruits=[{"id": "x", "name": "   ", "emoji": "", "reason": ""}],
            suitable_vegetables=[],
        )
        self.assertEqual(dashboard_service.crop_suggestions(self.farmer)["crops"], [])

    def test_suggestions_are_scoped_to_the_farmer(self):
        other = make_farmer("other@example.com")
        SoilRecommendation.objects.create(
            farmer=other,
            soil_ph=Decimal("6.40"),
            soil_temperature=Decimal("28.0"),
            ai_generated=True,
            suitable_fruits=[
                {"id": "banana", "name": "Banana", "emoji": "", "reason": ""}
            ],
        )
        self.assertFalse(dashboard_service.crop_suggestions(self.farmer)["has_any"])

    # ------------------------------------------------------------- harvests
    def test_upcoming_harvests_are_soonest_first_and_exclude_the_past(self):
        soon = self._plant(planting_date=self.today - timedelta(days=100))
        later = self._plant(planting_date=self.today - timedelta(days=10))
        done = self._plant(planting_date=self.today - timedelta(days=400))

        rows = dashboard_service.upcoming_harvests(self.farmer, self.today)
        ids = [r["plant_id"] for r in rows]

        self.assertIn(soon.id, ids)
        self.assertIn(later.id, ids)
        # Its whole window closed long ago, so it is not upcoming.
        self.assertNotIn(done.id, ids)
        self.assertEqual(ids, sorted(ids, key=lambda i: dict(
            (r["plant_id"], r["expected_harvest_start"]) for r in rows
        )[i]))

    def test_harvested_plants_drop_off_the_schedule(self):
        plant = self._plant(planting_date=self.today - timedelta(days=100))
        plant.status = "HARVESTED"
        plant.save()

        rows = dashboard_service.upcoming_harvests(self.farmer, self.today)
        self.assertEqual(rows, [])

    # --------------------------------------------------------------- alerts
    def test_no_plants_means_no_alerts_at_all(self):
        self.assertEqual(dashboard_service.alerts(self.farmer, self.today), [])

    def test_first_assessment_alert_counts_real_plants(self):
        self._plant()
        self._plant()

        messages = [a["message"] for a in dashboard_service.alerts(self.farmer, self.today)]
        self.assertTrue(
            any("2 plants still need a first assessment" in m for m in messages),
            messages,
        )

    def test_missing_soil_reading_is_reported_once_a_farm_exists(self):
        self._plant()
        messages = [a["message"] for a in dashboard_service.alerts(self.farmer, self.today)]
        self.assertIn("No soil reading recorded yet.", messages)

    def test_a_recent_soil_reading_raises_no_alert(self):
        self._plant()
        SoilRecommendation.objects.create(
            farmer=self.farmer, soil_temperature=Decimal("28.0"), soil_moisture=Decimal("65")
        )
        messages = [a["message"] for a in dashboard_service.alerts(self.farmer, self.today)]
        self.assertNotIn("No soil reading recorded yet.", messages)
        self.assertFalse(any("soil reading was" in m for m in messages))

    def test_high_risk_alert_only_fires_on_a_real_reading(self):
        plant = self._plant()
        assessment = self._assessment(plant, self.today)

        before = [a["message"] for a in dashboard_service.alerts(self.farmer, self.today)]
        self.assertFalse(any("high risk" in m for m in before))

        RiskAssessment.objects.create(
            assessment=assessment, risk_level="HIGH", status="completed"
        )
        after = [a["message"] for a in dashboard_service.alerts(self.farmer, self.today)]
        self.assertTrue(any("read high risk" in m for m in after), after)

    # ------------------------------------------------------------- overview
    def test_overview_on_an_empty_farm_invites_a_first_plant(self):
        summary = dashboard_service.overview(self.farmer, self.today)
        self.assertEqual(summary["plant_count"], 0)
        self.assertIn("Add your first plant", summary["detail"])

    def test_overview_counts_assessed_against_unassessed(self):
        assessed = self._plant()
        self._plant()
        self._plant()
        RiskAssessment.objects.create(
            assessment=self._assessment(assessed, self.today),
            risk_level="LOW",
            status="completed",
        )

        summary = dashboard_service.overview(self.farmer, self.today)
        self.assertEqual(summary["plant_count"], 3)
        self.assertIn("3 monitored crops", summary["headline"])
        self.assertIn("1 with a risk reading", summary["headline"])
        self.assertIn("2 crops still awaiting a first assessment", summary["detail"])


class DashboardApiTests(APITestCase):
    def setUp(self):
        self.farmer = make_farmer()
        res = self.client.post(
            LOGIN_URL, {"email": "farmer@example.com", "password": PW}, format="json"
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")

    def test_endpoint_returns_every_section(self):
        res = self.client.get(URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        for key in (
            "overview",
            "assessment_trend",
            "crop_suggestions",
            "upcoming_harvests",
            "alerts",
        ):
            self.assertIn(key, res.data)

    def test_endpoint_requires_a_farmer(self):
        self.client.credentials()
        self.assertEqual(
            self.client.get(URL).status_code, status.HTTP_401_UNAUTHORIZED
        )

    def test_one_farmer_never_sees_another_farms_dashboard(self):
        other = make_farmer("other@example.com")
        crop = Crop.objects.get(id="corn")
        Plant.objects.create(
            farmer=other, crop=crop, planting_date=date(2026, 1, 1)
        )

        res = self.client.get(URL)
        self.assertEqual(res.data["overview"]["plant_count"], 0)
        self.assertEqual(res.data["upcoming_harvests"], [])

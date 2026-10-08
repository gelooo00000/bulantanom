"""
Agricultural Analytics API tests.

Each test writes known rows and asserts the endpoint reports exactly them,
so an aggregation that returned a plausible constant would fail here.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import AccountStatus, User, UserRole

from .models import ReportLog

PW = "TestPass!2345"


def _aware(d: date):
    return timezone.make_aware(datetime(d.year, d.month, d.day, 9, 0))


class AnalyticsBase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        from plants.models import Assessment, Crop, Plant, PlantStatus, RiskAssessment, SoilRecommendation

        mk = User.objects.create_user
        cls.officer = mk(email="officer@lgu.ph", password=PW, first_name="Ofelia", last_name="Reyes",
                         role=UserRole.LGU_OFFICER, account_status=AccountStatus.APPROVED)
        cls.admin = mk(email="admin@lgu.ph", password=PW, first_name="Ada", last_name="Min",
                       role=UserRole.ADMIN, account_status=AccountStatus.APPROVED)
        cls.farmer = mk(email="juan@example.com", password=PW, first_name="Juan", last_name="Dela Cruz",
                        role=UserRole.FARMER, account_status=AccountStatus.APPROVED)
        cls.farmer2 = mk(email="maria@example.com", password=PW, first_name="Maria", last_name="Santos",
                         role=UserRole.FARMER, account_status=AccountStatus.APPROVED)
        # Not approved: nothing of theirs may appear anywhere.
        cls.suspended = mk(email="sus@example.com", password=PW, first_name="Sus", last_name="Pended",
                           role=UserRole.FARMER, account_status=AccountStatus.SUSPENDED)

        # The catalog is seeded by a migration; pin the durations the tests use.
        cls.corn, _ = Crop.objects.update_or_create(id="corn", defaults=dict(
            name="Corn", category="vegetable", emoji="🌽", growing_duration_days=90, harvest_window_days=14))
        cls.tomato, _ = Crop.objects.update_or_create(id="tomato", defaults=dict(
            name="Tomato", category="vegetable", emoji="🍅", growing_duration_days=70, harvest_window_days=21))

        # Wet season (July) and dry season (January) dates.
        cls.wet = date(2026, 7, 10)
        cls.dry = date(2026, 1, 15)

        def soil(farmer, day, crops, soil_type="unknown", ai=True, **kw):
            rec = SoilRecommendation.objects.create(
                farmer=farmer, legacy_soil_type=soil_type, ai_generated=ai,
                suitable_crops=[{"id": c.id, "name": c.name, "emoji": c.emoji, "reason": "Suits it."} for c in crops],
                **kw,
            )
            SoilRecommendation.objects.filter(pk=rec.pk).update(created_at=_aware(day))
            return rec

        cls.soil_wet = soil(cls.farmer, cls.wet, [cls.corn, cls.tomato], soil_type="clay",
                            soil_temperature=Decimal("27"), soil_moisture=Decimal("40"), soil_ph=Decimal("6.2"),
                            soil_conductivity=300, nitrogen=10, phosphorus=12, potassium=14, soil_fertility=100)
        cls.soil_dry = soil(cls.farmer2, cls.dry, [cls.corn], soil_type="sandy")
        cls.soil_failed = soil(cls.farmer2, cls.dry, [], ai=False, failure_reason="Gemini unavailable")
        soil(cls.suspended, cls.wet, [cls.tomato])

        # Juan planted corn after the wet-season recommendation (followed),
        # Maria planted tomato after a corn-only recommendation (not followed).
        cls.p_corn = Plant.objects.create(farmer=cls.farmer, crop=cls.corn, planting_date=cls.wet + timedelta(days=3))
        cls.p_tomato = Plant.objects.create(farmer=cls.farmer2, crop=cls.tomato, planting_date=cls.dry + timedelta(days=2))
        cls.p_harvested = Plant.objects.create(farmer=cls.farmer, crop=cls.corn, planting_date=date(2026, 3, 1))
        cls.p_harvested.status = PlantStatus.HARVESTED
        cls.p_harvested.save()
        Plant.objects.filter(pk=cls.p_harvested.pk).update(harvested_at=_aware(date(2026, 6, 5)))
        Plant.objects.create(farmer=cls.suspended, crop=cls.corn, planting_date=cls.wet)

        a = Assessment.objects.create(
            plant=cls.p_corn, assessment_date=cls.wet + timedelta(days=10), plant_age_days=10,
            growth_condition="as_expected", health_condition="healthy", watering_frequency="daily",
        )
        RiskAssessment.objects.create(assessment=a, status="completed", risk_level="HIGH", summary="Spots.")

    def auth(self, user=None):
        res = self.client.post("/api/auth/lgu/login/" if (user or self.officer).role == UserRole.LGU_OFFICER else "/api/auth/admin/login/",
                               {"email": (user or self.officer).email, "password": PW}, format="json")
        return {"HTTP_AUTHORIZATION": f"Bearer {res.data['access']}"}

    def get(self, path, user=None, **params):
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return self.client.get(path + (f"?{query}" if query else ""), **self.auth(user))


class AccessTests(AnalyticsBase):
    ENDPOINTS = [
        "/api/analytics/filters/", "/api/analytics/summary/", "/api/analytics/overview/",
        "/api/analytics/crop-recommendations/", "/api/analytics/recommended-vs-planted/",
        "/api/analytics/harvest-trends/", "/api/analytics/map/", "/api/analytics/insights/",
        "/api/analytics/audit/", "/api/soil-records/", "/api/reports/",
    ]

    def test_anonymous_is_refused(self):
        for url in self.ENDPOINTS:
            self.assertEqual(self.client.get(url).status_code, status.HTTP_401_UNAUTHORIZED, url)

    def test_farmer_is_refused(self):
        res = self.client.post("/api/auth/farmer/login/", {"email": self.farmer.email, "password": PW}, format="json")
        headers = {"HTTP_AUTHORIZATION": f"Bearer {res.data['access']}"}
        for url in self.ENDPOINTS:
            self.assertEqual(self.client.get(url, **headers).status_code, status.HTTP_403_FORBIDDEN, url)

    def test_officer_and_admin_are_allowed(self):
        for user in (self.officer, self.admin):
            for url in self.ENDPOINTS:
                self.assertEqual(self.get(url, user).status_code, status.HTTP_200_OK, url)

    def test_bad_filters_are_400(self):
        for params in ({"season": "monsoon"}, {"soil_type": "lava"}, {"farmer": "x"},
                       {"date_from": "2026-05-01", "date_to": "2026-01-01"}, {"date_from": "yesterday"}):
            self.assertEqual(self.get("/api/analytics/summary/", **params).status_code, 400, params)


class FigureTests(AnalyticsBase):
    def test_summary_counts_real_rows_for_approved_farmers_only(self):
        k = self.get("/api/analytics/summary/").data["kpis"]
        self.assertEqual(k["farmers"]["value"], 2)
        self.assertEqual(k["plants"]["value"], 3)
        self.assertEqual(k["soil_records"]["value"], 3)
        self.assertEqual(k["recommendations"]["value"], 2)
        self.assertEqual(k["harvests"]["value"], 1)
        self.assertEqual(k["most_recommended"]["value"]["id"], "corn")
        self.assertEqual(k["most_recommended"]["value"]["count"], 2)

    def test_season_soil_crop_and_farmer_filters(self):
        k = self.get("/api/analytics/summary/", season="wet").data["kpis"]
        self.assertEqual(k["soil_records"]["value"], 1)
        k = self.get("/api/analytics/summary/", soil_type="sandy").data["kpis"]
        self.assertEqual(k["soil_records"]["value"], 1)
        k = self.get("/api/analytics/summary/", soil_type="not_recorded").data["kpis"]
        self.assertEqual(k["soil_records"]["value"], 1)
        k = self.get("/api/analytics/summary/", crop="tomato").data["kpis"]
        self.assertEqual(k["plants"]["value"], 1)
        self.assertEqual(k["soil_records"]["value"], 1)
        k = self.get("/api/analytics/summary/", farmer=self.farmer2.id).data["kpis"]
        self.assertEqual(k["plants"]["value"], 1)

    def test_harvested_at_is_set_when_marked_harvested_and_cleared_when_undone(self):
        from plants.models import PlantStatus

        p = self.p_corn
        p.status = PlantStatus.HARVESTED
        p.save()
        p.refresh_from_db()
        self.assertIsNotNone(p.harvested_at)
        p.status = PlantStatus.GROWING
        p.save()
        p.refresh_from_db()
        self.assertIsNone(p.harvested_at)

    def test_recommendations_and_follow_rate(self):
        data = self.get("/api/analytics/crop-recommendations/").data
        self.assertEqual(data["analysed_records"], 2)
        corn = data["crops"][0]
        self.assertEqual((corn["id"], corn["count"], corn["rate"]), ("corn", 2, 100))
        self.assertEqual(corn["by_season"], {"wet": 1, "dry": 1})
        self.assertEqual(data["durations"][0]["growing_days"], 90)

        rvp = self.get("/api/analytics/recommended-vs-planted/").data
        self.assertEqual(rvp["plants_with_advice"], 2)
        self.assertEqual(rvp["followed"], 1)
        self.assertEqual(rvp["follow_rate"], 50)

    def test_harvest_trends_count_harvests_by_month(self):
        data = self.get("/api/analytics/harvest-trends/", date_from="2026-01-01", date_to="2026-12-31").data
        self.assertEqual(data["total_harvests"], 1)
        self.assertEqual(data["harvested"][data["months"].index("2026-06")], 1)
        corn = next(r for r in data["table"] if r["id"] == "corn")
        self.assertEqual((corn["planted"], corn["harvested"], corn["avg_days_to_harvest"]), (2, 1, 96))

    def test_overview_risk_uses_latest_reading(self):
        data = self.get("/api/analytics/overview/").data
        self.assertEqual(data["risk"]["HIGH"], 1)
        # The tomato and the harvested corn: every plant is counted, as on the
        # original dashboard, so the four figures add up to the plant total.
        self.assertEqual(data["risk"]["unassessed"], 2)

    def test_map_and_soil_records(self):
        data = self.get("/api/analytics/map/").data
        self.assertEqual(data["record_count"], 3)
        self.assertEqual(data["located_by"], "farm")
        labels = {t["label"] for t in data["soil_types"]}
        self.assertEqual(labels, {"Clay", "Sandy", "Not recorded"})
        rows = self.get("/api/soil-records/").data["rows"]
        clay = next(r for r in rows if r["soil_type"] == "Clay")
        self.assertEqual((clay["ph"], clay["moisture"]), (6.2, "40%"))

    def test_insights_come_from_data_and_vanish_without_it(self):
        texts = [i["text"] for i in self.get("/api/analytics/insights/").data["insights"]]
        self.assertTrue(any("Corn" in t and "harvests" in t for t in texts))
        self.assertTrue(any("1 of 2" in t for t in texts))
        self.assertLessEqual(len(texts), 5)
        empty = self.get("/api/analytics/insights/", date_from="2020-01-01", date_to="2020-01-31").data
        self.assertEqual(empty["insights"], [])

    def test_audit_lists_incomplete_inputs(self):
        data = self.get("/api/analytics/audit/").data
        groups = {g["key"]: g for g in data["incomplete"]}
        soil_issues = {r["id"]: r["issues"] for r in groups["soil"]["rows"]}
        self.assertIn(self.soil_failed.id, soil_issues)
        self.assertNotIn(self.soil_wet.id, soil_issues)
        self.assertEqual(groups["assessments"]["count"], 1)  # no evidence photo
        self.assertTrue(data["activity"])


class ReportTests(AnalyticsBase):
    def test_new_report_types_build_and_export(self):
        for slug in ("crop-recommendation", "harvest"):
            res = self.get(f"/api/lgu/reports/{slug}/", period="all_time")
            self.assertEqual(res.status_code, 200, slug)
            pdf = self.get(f"/api/lgu/reports/{slug}/pdf/", period="all_time")
            self.assertTrue(pdf.content.startswith(b"%PDF"))
        csv = self.get("/api/lgu/reports/harvest/csv/", period="all_time", crop="corn")
        self.assertEqual(csv["Content-Type"], "text/csv; charset=utf-8")
        self.assertIn("Productivity by crop", csv.content.decode("utf-8-sig"))

    def test_exports_are_logged_in_history(self):
        self.get("/api/lgu/reports/crop-recommendation/csv/", period="this_year", soil_type="clay")
        self.get("/api/lgu/reports/risk-assessment/pdf/", period="all_time", user=self.admin)
        history = self.get("/api/reports/").data["results"]
        self.assertEqual(len(history), 2)
        self.assertEqual(ReportLog.objects.count(), 2)
        csv_log = next(h for h in history if h["format"] == "csv")
        self.assertEqual(csv_log["params"]["soil_type"], "clay")
        self.assertEqual(csv_log["by"], "Ofelia Reyes")

    def test_report_parameters_are_validated(self):
        self.assertEqual(self.get("/api/lgu/reports/crop-recommendation/", soil_type="lava").status_code, 400)
        self.assertEqual(self.get("/api/lgu/reports/harvest/", area="mars").status_code, 400)

"""
Harvest reports: the final assessment when a plant is marked harvested, what
happens to the plant afterwards, and the outcomes LGU and Admin see.
"""

from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone

from accounts.models import UserRole

from .models import Assessment, HarvestReport, LossReport, Plant, RiskAssessment, RiskStatus
from .test_risk import LGU_LOGIN_URL, RiskTestCase, make_image, make_user

ANSWERS = {"quality": "GOOD", "final_health": "HEALTHY", "advice_helped": "YES"}


class HarvestReportTests(RiskTestCase):
    def setUp(self):
        super().setUp()
        self.farmer = make_user("farmer@example.com")
        self.auth = self.login("farmer@example.com")
        # Guava planted long enough ago to be in its harvest window or past it.
        self.plant = self.make_plant(self.farmer, days_ago=400)

    def harvest(self, plant=None, **data):
        plant = plant or self.plant
        return self.client.post(
            f"/api/farmer/plants/{plant.pk}/harvest/",
            {**ANSWERS, **data},
            format="multipart" if "photo" in data else "json",
            **self.auth,
        )

    def add_reading(self, level, days_ago):
        assessment = Assessment.objects.create(
            plant=self.plant,
            assessment_date=timezone.localdate() - timedelta(days=days_ago),
            plant_age_days=400 - days_ago,
            growth_condition="as_expected",
            health_condition="healthy",
            watering_frequency="daily",
        )
        RiskAssessment.objects.create(
            assessment=assessment, risk_level=level, status=RiskStatus.COMPLETED
        )

    def test_the_three_answers_are_required(self):
        response = self.client.post(
            f"/api/farmer/plants/{self.plant.pk}/harvest/", {}, format="json", **self.auth
        )
        self.assertEqual(response.status_code, 400)
        for field in ("quality", "final_health", "advice_helped"):
            self.assertIn(field, response.data)
        self.plant.refresh_from_db()
        self.assertEqual(self.plant.status, "GROWING")

    def test_harvest_files_the_report_and_the_system_facts(self):
        self.add_reading("HIGH", 30)
        self.add_reading("MEDIUM", 20)
        self.add_reading("LOW", 10)
        response = self.harvest(yield_amount="12.5", yield_unit="KG", notes="Sweet and big.")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["status"], "HARVESTED")

        report = HarvestReport.objects.get(plant=self.plant)
        self.assertEqual(report.quality, "GOOD")
        self.assertEqual(str(report.yield_amount), "12.50")
        self.assertEqual(report.assessments_count, 3)
        self.assertEqual(report.highest_risk, "HIGH")
        self.assertEqual(report.high_risk_count, 1)
        self.assertTrue(report.recovered_from_high)
        self.assertEqual(report.days_to_harvest, 400)
        # Guava first fruits after about two years, so 400 days is early.
        self.assertEqual(report.timing, "EARLY")
        self.assertEqual(response.data["harvest_report"]["quality_label"], "Good")

    def test_an_amount_needs_a_unit(self):
        response = self.harvest(yield_amount="3")
        self.assertEqual(response.status_code, 400)
        self.assertIn("yield_unit", response.data)

    def test_a_photo_is_optional_and_served_only_to_allowed_roles(self):
        response = self.harvest(photo=make_image())
        self.assertEqual(response.status_code, 201, response.data)
        url = response.data["harvest_report"]["photo_url"]
        self.assertIn("/api/farmer/harvest-reports/", url)
        path = url.split("testserver", 1)[-1]
        self.assertEqual(self.client.get(path, **self.auth).status_code, 200)

        make_user("other@example.com")
        other = self.login("other@example.com")
        self.assertEqual(self.client.get(path, **other).status_code, 404)

        make_user("officer@example.com", role=UserRole.LGU_OFFICER)
        officer = self.login("officer@example.com", LGU_LOGIN_URL)
        lgu_path = path.replace("/api/farmer/", "/api/lgu/")
        self.assertEqual(self.client.get(lgu_path, **officer).status_code, 200)

    def test_marking_harvested_without_a_report_is_refused(self):
        response = self.client.patch(
            f"/api/farmer/plants/{self.plant.pk}/",
            {"status": "HARVESTED"},
            format="json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("harvest report", str(response.data["status"]))

    def test_a_harvested_plant_leaves_risk_and_weekly_assessments(self):
        self.add_reading("LOW", 10)
        self.harvest()
        risk = self.client.get("/api/farmer/risk/", **self.auth).data
        self.assertEqual(risk["plants"], [])
        plant = self.client.get(f"/api/farmer/plants/{self.plant.pk}/", **self.auth).data
        self.assertFalse(plant["assessment_eligibility"]["can_assess"])
        self.assertTrue(plant["assessment_eligibility"]["harvested"])

    def test_undo_within_24_hours_removes_the_report(self):
        self.harvest()
        response = self.client.patch(
            f"/api/farmer/plants/{self.plant.pk}/", {"status": "GROWING"}, format="json", **self.auth
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["harvest_report"])
        self.assertFalse(HarvestReport.objects.filter(plant=self.plant).exists())
        # Harvesting again writes a fresh report.
        self.assertEqual(self.harvest(quality="FAIR").status_code, 201)

    def test_no_undo_after_24_hours(self):
        self.harvest()
        Plant.objects.filter(pk=self.plant.pk).update(
            harvested_at=timezone.now() - timedelta(hours=25)
        )
        response = self.client.patch(
            f"/api/farmer/plants/{self.plant.pk}/", {"status": "GROWING"}, format="json", **self.auth
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("24 hours", str(response.data["status"]))

    def test_old_harvests_without_a_report_can_still_be_restored(self):
        Plant.objects.filter(pk=self.plant.pk).update(
            status="HARVESTED", harvested_at=timezone.now() - timedelta(days=30)
        )
        response = self.client.patch(
            f"/api/farmer/plants/{self.plant.pk}/", {"status": "GROWING"}, format="json", **self.auth
        )
        self.assertEqual(response.status_code, 200)

    def test_cannot_harvest_twice(self):
        self.harvest()
        self.assertEqual(self.harvest().status_code, 409)

    def test_another_farmers_plant_is_not_found(self):
        make_user("other@example.com")
        other = self.login("other@example.com")
        response = self.client.post(
            f"/api/farmer/plants/{self.plant.pk}/harvest/", ANSWERS, format="json", **other
        )
        self.assertEqual(response.status_code, 404)


class HarvestOutcomesTests(RiskTestCase):
    def setUp(self):
        super().setUp()
        self.farmer = make_user("farmer@example.com")
        self.auth = self.login("farmer@example.com")

    def harvest(self, plant, **answers):
        return self.client.post(
            f"/api/farmer/plants/{plant.pk}/harvest/",
            {**ANSWERS, **answers},
            format="json",
            **self.auth,
        )

    def test_lgu_and_admin_see_the_outcomes(self):
        healthy = self.make_plant(self.farmer, days_ago=400)
        damaged = self.make_plant(self.farmer, crop_id="corn", days_ago=90)
        self.harvest(healthy, yield_amount="10", yield_unit="KG")
        self.harvest(damaged, quality="POOR", final_health="DAMAGED", advice_helped="NO")

        make_user("officer@example.com", role=UserRole.LGU_OFFICER)
        officer = self.login("officer@example.com", LGU_LOGIN_URL)
        data = self.client.get("/api/lgu/harvest-outcomes/", **officer).data
        self.assertEqual(data["total"], 2)
        self.assertEqual(data["healthy_rate"], 50)
        self.assertEqual(data["advice_helped_rate"], 50)
        self.assertEqual(len(data["by_crop"]), 2)
        guava = next(c for c in data["by_crop"] if c["crop"] == "Guava")
        self.assertEqual(guava["average_yield"][0]["average"], 10.0)
        self.assertEqual(data["recent"][0]["farmer_name"], "Test User")

        make_user("admin@example.com", role=UserRole.ADMIN)
        admin = self.login("admin@example.com", "/api/auth/admin/login/")
        self.assertEqual(self.client.get("/api/admin/harvest-outcomes/", **admin).data["total"], 2)

    def test_farmers_cannot_read_the_outcomes(self):
        self.assertEqual(self.client.get("/api/lgu/harvest-outcomes/", **self.auth).status_code, 403)

    def test_empty_outcomes(self):
        make_user("officer@example.com", role=UserRole.LGU_OFFICER)
        officer = self.login("officer@example.com", LGU_LOGIN_URL)
        data = self.client.get("/api/lgu/harvest-outcomes/", **officer).data
        self.assertEqual(data["total"], 0)
        self.assertIsNone(data["healthy_rate"])


class HarvestOutcomesReportTests(RiskTestCase):
    def test_the_report_downloads(self):
        farmer = make_user("farmer@example.com")
        auth = self.login("farmer@example.com")
        plant = self.make_plant(farmer, days_ago=400)
        self.client.post(
            f"/api/farmer/plants/{plant.pk}/harvest/",
            {**ANSWERS, "yield_amount": "4", "yield_unit": "SACKS"},
            format="json",
            **auth,
        )
        make_user("officer@example.com", role=UserRole.LGU_OFFICER)
        officer = self.login("officer@example.com", LGU_LOGIN_URL)
        detail = self.client.get("/api/lgu/reports/harvest-outcomes/", **officer)
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(detail.data["stats"][0]["value"], 1)
        csv = self.client.get("/api/lgu/reports/harvest-outcomes/csv/", **officer)
        self.assertEqual(csv.status_code, 200)
        self.assertIn(b"4 sacks", b"".join(csv.streaming_content) if csv.streaming else csv.content)
        pdf = self.client.get("/api/lgu/reports/harvest-outcomes/pdf/", **officer)
        self.assertEqual(pdf.status_code, 200)


LOSS = {"cause": "PEST", "noticed": "TODAY"}


class LossReportTests(RiskTestCase):
    def setUp(self):
        super().setUp()
        self.farmer = make_user("farmer@example.com")
        self.auth = self.login("farmer@example.com")
        self.plant = self.make_plant(self.farmer, days_ago=40)

    def reading(self, level, days_ago):
        assessment = Assessment.objects.create(
            plant=self.plant,
            assessment_date=timezone.localdate() - timedelta(days=days_ago),
            plant_age_days=40 - days_ago,
            growth_condition="as_expected",
            health_condition="healthy",
            watering_frequency="daily",
        )
        RiskAssessment.objects.create(
            assessment=assessment, risk_level=level, status=RiskStatus.COMPLETED
        )

    def lose(self, **data):
        return self.client.post(
            f"/api/farmer/plants/{self.plant.pk}/lost/",
            {**LOSS, **data},
            format="multipart" if "photo" in data else "json",
            **self.auth,
        )

    def test_cause_and_when_are_required(self):
        response = self.client.post(
            f"/api/farmer/plants/{self.plant.pk}/lost/", {}, format="json", **self.auth
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("cause", response.data)
        self.assertIn("noticed", response.data)

    def test_a_loss_keeps_the_plant_and_records_the_warning(self):
        self.reading("LOW", 21)
        self.reading("HIGH", 7)
        response = self.lose(notes="Worms everywhere.")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["status"], "LOST")
        loss = response.data["loss_report"]
        self.assertTrue(loss["warned_before"])
        self.assertEqual(loss["last_risk"], "HIGH")
        self.assertEqual(loss["assessments_count"], 2)
        self.assertEqual(loss["age_days"], 40)
        # Kept, with its history, but out of the risk page and assessments.
        self.assertTrue(Plant.objects.filter(pk=self.plant.pk).exists())
        self.assertEqual(Assessment.objects.filter(plant=self.plant).count(), 2)
        self.assertEqual(self.client.get("/api/farmer/risk/", **self.auth).data["plants"], [])
        plant = self.client.get(f"/api/farmer/plants/{self.plant.pk}/", **self.auth).data
        self.assertTrue(plant["assessment_eligibility"]["lost"])

    def test_no_warning_when_it_was_low_risk(self):
        self.reading("LOW", 7)
        self.assertFalse(self.lose().data["loss_report"]["warned_before"])

    def test_a_photo_is_optional(self):
        response = self.lose(photo=make_image())
        self.assertEqual(response.status_code, 201, response.data)
        path = response.data["loss_report"]["photo_url"].split("testserver", 1)[-1]
        self.assertEqual(self.client.get(path, **self.auth).status_code, 200)

    def test_patch_cannot_mark_lost(self):
        response = self.client.patch(
            f"/api/farmer/plants/{self.plant.pk}/", {"status": "LOST"}, format="json", **self.auth
        )
        self.assertEqual(response.status_code, 400)

    def test_undo_within_24_hours_only(self):
        self.lose()
        undo = self.client.patch(
            f"/api/farmer/plants/{self.plant.pk}/", {"status": "GROWING"}, format="json", **self.auth
        )
        self.assertEqual(undo.status_code, 200)
        self.assertIsNone(undo.data["loss_report"])

        self.lose()
        LossReport.objects.filter(plant=self.plant).update(
            lost_at=timezone.now() - timedelta(hours=25)
        )
        late = self.client.patch(
            f"/api/farmer/plants/{self.plant.pk}/", {"status": "GROWING"}, format="json", **self.auth
        )
        self.assertEqual(late.status_code, 400)

    def test_a_lost_plant_cannot_be_harvested(self):
        self.lose()
        response = self.client.post(
            f"/api/farmer/plants/{self.plant.pk}/harvest/", ANSWERS, format="json", **self.auth
        )
        self.assertEqual(response.status_code, 409)

    def test_outcomes_count_losses(self):
        self.reading("HIGH", 7)
        self.lose()
        healthy = self.make_plant(self.farmer, days_ago=400)
        self.client.post(
            f"/api/farmer/plants/{healthy.pk}/harvest/", ANSWERS, format="json", **self.auth
        )
        make_user("officer@example.com", role=UserRole.LGU_OFFICER)
        officer = self.login("officer@example.com", LGU_LOGIN_URL)
        data = self.client.get("/api/lgu/harvest-outcomes/", **officer).data
        self.assertEqual(data["lost_total"], 1)
        self.assertEqual(data["survival_rate"], 50)
        self.assertEqual(data["warned_before_loss"], 1)
        pest = next(c for c in data["causes"] if c["value"] == "PEST")
        self.assertEqual(pest["count"], 1)
        self.assertEqual(data["recent_losses"][0]["cause_label"], "Pests")
        report = self.client.get("/api/lgu/reports/harvest-outcomes/", **officer)
        self.assertEqual(report.status_code, 200)


class EarlyRecheckTests(RiskTestCase):
    def setUp(self):
        super().setUp()
        self.farmer = make_user("farmer@example.com")
        self.auth = self.login("farmer@example.com")
        self.plant = self.make_plant(self.farmer, days_ago=40)

    def reading(self, level, days_ago):
        assessment = Assessment.objects.create(
            plant=self.plant,
            assessment_date=timezone.localdate() - timedelta(days=days_ago),
            plant_age_days=40 - days_ago,
            growth_condition="as_expected",
            health_condition="healthy",
            watering_frequency="daily",
        )
        RiskAssessment.objects.create(
            assessment=assessment, risk_level=level, status=RiskStatus.COMPLETED
        )

    def eligibility(self):
        return self.client.get(
            f"/api/farmer/plants/{self.plant.pk}/assessments/eligibility/", **self.auth
        ).data

    def test_high_risk_can_be_rechecked_after_three_days(self):
        self.reading("HIGH", 3)
        data = self.eligibility()
        self.assertTrue(data["can_assess"])
        self.assertTrue(data["early_recheck"])

    def test_not_before_three_days(self):
        self.reading("HIGH", 2)
        data = self.eligibility()
        self.assertFalse(data["can_assess"])
        # Counts down to the early re-check, not to the full week.
        self.assertEqual(data["days_remaining"], 1)

    def test_a_fresh_high_reading_counts_down_three_days(self):
        self.reading("HIGH", 0)
        self.assertEqual(self.eligibility()["days_remaining"], 3)

    def test_low_risk_waits_the_full_week(self):
        self.reading("LOW", 4)
        self.assertFalse(self.eligibility()["can_assess"])

    def test_risk_page_shows_the_previous_reading(self):
        self.reading("LOW", 11)
        self.reading("HIGH", 4)
        data = self.client.get("/api/farmer/risk/", **self.auth).data
        entry = data["plants"][0]
        self.assertEqual(entry["latest_assessment"]["risk"]["risk_level"], "HIGH")
        self.assertEqual(entry["previous_risk_level"], "LOW")
        self.assertTrue(entry["plant"]["assessment_eligibility"]["early_recheck"])

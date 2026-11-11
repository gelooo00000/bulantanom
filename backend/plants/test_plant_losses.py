"""
The LGU Plant Loss page: plants that died before harvest, calamities apart,
High-risk plants that were not saved, and the alert officers get on a loss.
"""

from datetime import timedelta

from django.utils import timezone

from accounts.models import UserRole
from notifications.models import Notification

from .models import Assessment, RiskAssessment, RiskStatus
from .test_risk import LGU_LOGIN_URL, RiskTestCase, make_user

URL = "/api/lgu/plant-losses/"


class PlantLossTests(RiskTestCase):
    def setUp(self):
        super().setUp()
        self.farmer = make_user("farmer@example.com")
        self.farmer_auth = self.login("farmer@example.com")
        self.officer = make_user("officer@example.com", role=UserRole.LGU_OFFICER)
        self.officer_auth = self.login("officer@example.com", LGU_LOGIN_URL)

    def reading(self, plant, level, days_ago=7):
        assessment = Assessment.objects.create(
            plant=plant,
            assessment_date=timezone.localdate() - timedelta(days=days_ago),
            plant_age_days=40 - days_ago,
            growth_condition="as_expected",
            health_condition="healthy",
            watering_frequency="daily",
        )
        RiskAssessment.objects.create(
            assessment=assessment, risk_level=level, status=RiskStatus.COMPLETED
        )

    def lose(self, plant, cause):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                f"/api/farmer/plants/{plant.pk}/lost/",
                {"cause": cause, "noticed": "TODAY"},
                format="json",
                **self.farmer_auth,
            )
        self.assertEqual(response.status_code, 201, response.data)
        return response

    def test_farmers_cannot_read_it(self):
        self.assertEqual(self.client.get(URL, **self.farmer_auth).status_code, 403)
        self.assertEqual(self.client.get(URL).status_code, 401)

    def test_admins_read_it_for_agricultural_analytics(self):
        make_user("admin@example.com", role=UserRole.ADMIN)
        admin = self.login("admin@example.com", "/api/auth/admin/login/")
        self.assertEqual(self.client.get(URL, **admin).status_code, 200)

    def test_empty_when_nothing_died(self):
        data = self.client.get(URL, **self.officer_auth).data
        self.assertEqual(data["total"], 0)
        self.assertEqual(data["losses"], [])
        self.assertIsNone(data["survival_rate"])
        self.assertEqual(len(data["months"]), 6)

    def test_calamities_and_high_risk_plants_not_saved(self):
        typhoon = self.make_plant(self.farmer, days_ago=40)
        not_saved = self.make_plant(self.farmer, days_ago=40)
        self.reading(not_saved, "LOW", days_ago=14)
        self.reading(not_saved, "HIGH", days_ago=7)
        pests = self.make_plant(self.farmer, days_ago=40)
        self.reading(pests, "MEDIUM")

        self.lose(typhoon, "CALAMITY")
        self.lose(not_saved, "DISEASE")
        self.lose(pests, "PEST")

        data = self.client.get(URL, **self.officer_auth).data
        self.assertEqual(data["total"], 3)
        self.assertEqual(data["calamity"], 1)
        self.assertEqual(data["high_risk_not_saved"], 1)
        self.assertEqual(data["pest_disease"], 2)
        self.assertEqual(data["conditions"], 0)
        self.assertEqual(data["other"], 0)
        self.assertEqual(data["warned_before"], 2)
        self.assertEqual(data["survival_rate"], 0)
        causes = {row["value"]: row for row in data["causes"]}
        self.assertEqual(causes["CALAMITY"]["count"], 1)
        self.assertTrue(causes["CALAMITY"]["calamity"])
        self.assertFalse(causes["PEST"]["calamity"])
        self.assertEqual(data["crops"][0]["count"], 3)
        self.assertEqual(data["months"][-1]["count"], 3)

        by_plant = {row["plant_id"]: row for row in data["losses"]}
        self.assertTrue(by_plant[typhoon.pk]["calamity"])
        self.assertEqual(by_plant[typhoon.pk]["cause_group"], "calamity")
        self.assertFalse(by_plant[typhoon.pk]["high_risk_not_saved"])
        self.assertTrue(by_plant[not_saved.pk]["high_risk_not_saved"])
        self.assertEqual(by_plant[not_saved.pk]["highest_risk"], "HIGH")
        self.assertEqual(by_plant[pests.pk]["cause_group"], "pest_disease")
        self.assertEqual(by_plant[pests.pk]["farmer_id"], self.farmer.pk)

    def test_officers_are_alerted_and_sent_to_the_page(self):
        typhoon = self.make_plant(self.farmer, days_ago=40)
        self.lose(typhoon, "CALAMITY")
        alert = Notification.objects.get(recipient=self.officer, notification_type="PLANT_LOST")
        self.assertEqual(alert.severity, "critical")
        self.assertEqual(alert.title, "Plant Lost to a Calamity")

        bell = self.client.get("/api/lgu/notifications/", **self.officer_auth).data
        rows = bell["results"] if isinstance(bell, dict) else bell
        lost = [row for row in rows if row["notification_type"] == "PLANT_LOST"]
        self.assertEqual(lost[0]["route"], "/lgu/plant-loss")

    def test_an_ordinary_loss_is_a_warning(self):
        plant = self.make_plant(self.farmer, days_ago=40)
        self.lose(plant, "HUMAN_ERROR")
        alert = Notification.objects.get(recipient=self.officer, notification_type="PLANT_LOST")
        self.assertEqual(alert.severity, "warning")
        self.assertEqual(alert.title, "Plant Lost")

    def test_growing_conditions_and_farming_practice_are_groups_of_their_own(self):
        dry = self.make_plant(self.farmer, days_ago=40)
        burned = self.make_plant(self.farmer, days_ago=40)
        self.lose(dry, "WATER")
        self.lose(burned, "HUMAN_ERROR")

        data = self.client.get(URL, **self.officer_auth).data
        self.assertEqual(data["conditions"], 1)
        self.assertEqual(data["other"], 1)
        self.assertEqual(data["calamity"], 0)
        causes = {row["value"]: row for row in data["causes"]}
        self.assertEqual(causes["WATER"]["group"], "conditions")
        self.assertEqual(causes["HUMAN_ERROR"]["group"], "other")
        self.assertEqual(causes["CALAMITY"]["group"], "calamity")
        by_plant = {row["plant_id"]: row for row in data["losses"]}
        self.assertEqual(by_plant[dry.pk]["cause_group"], "conditions")
        self.assertEqual(by_plant[dry.pk]["cause_label"], "Lack of water")

    def test_every_cause_has_a_group(self):
        from .loss_report import _GROUP_OF
        from .models import LossReport

        self.assertEqual(set(_GROUP_OF), set(LossReport.Cause.values))

from datetime import date, timedelta
from unittest.mock import patch

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import AccountStatus, User, UserRole

from .models import Crop, CropIntelligence, Plant

PLANTS_URL = "/api/farmer/plants/"
CROPS_URL = "/api/farmer/crops/"
FARMER_LOGIN_URL = "/api/auth/farmer/login/"
LGU_LOGIN_URL = "/api/auth/lgu/login/"
PW = "SecurePassword123!"


def make_user(email, role=UserRole.FARMER, status_=AccountStatus.APPROVED):
    return User.objects.create_user(
        email=email, password=PW, first_name="Test", last_name="User",
        role=role, account_status=status_,
    )


class PlantApiTestCase(APITestCase):
    def login(self, email, url=FARMER_LOGIN_URL):
        token = self.client.post(
            url, {"email": email, "password": PW}, format="json"
        ).data["access"]
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


class CropCatalogTests(PlantApiTestCase):
    def test_catalog_seeded_from_migration(self):
        self.assertEqual(Crop.objects.count(), 30)
        self.assertEqual(Crop.objects.filter(category="fruit").count(), 19)
        self.assertEqual(Crop.objects.filter(category="vegetable").count(), 11)

    def test_every_crop_has_an_emoji(self):
        self.assertFalse(Crop.objects.filter(emoji="").exists())

    def test_farmer_can_list_crops(self):
        make_user("f@example.com")
        response = self.client.get(CROPS_URL, **self.login("f@example.com"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 30)
        self.assertIn("emoji", response.data[0])


class PlantCreationTests(PlantApiTestCase):
    def setUp(self):
        make_user("farmer@example.com")
        self.auth = self.login("farmer@example.com")

    def test_create_plant_assigns_authenticated_farmer(self):
        response = self.client.post(
            PLANTS_URL, {"crop_id": "guava", "planting_date": "2026-08-01"},
            format="json", **self.auth,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        plant = Plant.objects.get(pk=response.data["id"])
        self.assertEqual(plant.farmer.email, "farmer@example.com")

    def test_harvest_window_calculated_from_crop_metadata(self):
        crop = Crop.objects.get(pk="guava")
        response = self.client.post(
            PLANTS_URL, {"crop_id": "guava", "planting_date": "2026-08-01"},
            format="json", **self.auth,
        )
        planted = date(2026, 8, 1)
        expected_start = planted + timedelta(days=crop.growing_duration_days)
        expected_end = expected_start + timedelta(days=crop.harvest_window_days)
        self.assertEqual(response.data["expected_harvest_start"], expected_start.isoformat())
        self.assertEqual(response.data["expected_harvest_end"], expected_end.isoformat())

    def test_client_cannot_assign_plant_to_another_farmer(self):
        """A farmer id in the body must be ignored — ownership comes from the token."""
        victim = make_user("victim@example.com")
        response = self.client.post(
            PLANTS_URL,
            {"crop_id": "guava", "planting_date": "2026-08-01", "farmer": victim.id},
            format="json", **self.auth,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        plant = Plant.objects.get(pk=response.data["id"])
        self.assertEqual(plant.farmer.email, "farmer@example.com")
        self.assertEqual(victim.plants.count(), 0)

    def test_future_planting_date_rejected(self):
        future = (timezone.localdate() + timedelta(days=5)).isoformat()
        response = self.client.post(
            PLANTS_URL, {"crop_id": "guava", "planting_date": future},
            format="json", **self.auth,
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_impossible_calendar_date_rejected(self):
        response = self.client.post(
            PLANTS_URL, {"crop_id": "guava", "planting_date": "2026-02-31"},
            format="json", **self.auth,
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_empty_and_invalid_crop_rejected(self):
        for payload in (
            {"planting_date": "2026-08-01"},
            {"crop_id": "not-a-real-crop", "planting_date": "2026-08-01"},
        ):
            response = self.client.post(PLANTS_URL, payload, format="json", **self.auth)
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_planting_date_rejected(self):
        response = self.client.post(
            PLANTS_URL, {"crop_id": "guava"}, format="json", **self.auth
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class PlantOwnershipTests(PlantApiTestCase):
    """Farmer A must never reach Farmer B's plants."""

    def setUp(self):
        self.a = make_user("a@example.com")
        self.b = make_user("b@example.com")
        self.a_plant = Plant.objects.create(
            farmer=self.a, crop=Crop.objects.get(pk="guava"), planting_date=date(2026, 8, 1)
        )

    def test_list_only_returns_own_plants(self):
        auth_b = self.login("b@example.com")
        response = self.client.get(PLANTS_URL, **auth_b)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

        auth_a = self.login("a@example.com")
        self.assertEqual(len(self.client.get(PLANTS_URL, **auth_a).data), 1)

    def test_cannot_retrieve_another_farmers_plant(self):
        auth_b = self.login("b@example.com")
        response = self.client.get(f"{PLANTS_URL}{self.a_plant.id}/", **auth_b)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_update_another_farmers_plant(self):
        auth_b = self.login("b@example.com")
        response = self.client.patch(
            f"{PLANTS_URL}{self.a_plant.id}/", {"label": "hacked"},
            format="json", **auth_b,
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.a_plant.refresh_from_db()
        self.assertNotEqual(self.a_plant.label, "hacked")

    def test_cannot_delete_another_farmers_plant(self):
        auth_b = self.login("b@example.com")
        response = self.client.delete(f"{PLANTS_URL}{self.a_plant.id}/", **auth_b)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Plant.objects.filter(pk=self.a_plant.id).exists())

    def test_owner_can_retrieve_and_delete(self):
        auth_a = self.login("a@example.com")
        self.assertEqual(
            self.client.get(f"{PLANTS_URL}{self.a_plant.id}/", **auth_a).status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self.client.delete(f"{PLANTS_URL}{self.a_plant.id}/", **auth_a).status_code,
            status.HTTP_204_NO_CONTENT,
        )


class PlantPermissionTests(PlantApiTestCase):
    def test_unauthenticated_rejected(self):
        self.assertEqual(self.client.get(PLANTS_URL).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_lgu_officer_cannot_use_farmer_plant_api(self):
        make_user("officer@example.com", UserRole.LGU_OFFICER)
        auth = self.login("officer@example.com", LGU_LOGIN_URL)
        self.assertEqual(self.client.get(PLANTS_URL, **auth).status_code, status.HTTP_403_FORBIDDEN)

    def test_pending_farmer_cannot_use_plant_api(self):
        make_user("pending@example.com", status_=AccountStatus.PENDING)
        # A pending Farmer cannot even obtain a token, so the API is unreachable.
        login = self.client.post(
            FARMER_LOGIN_URL, {"email": "pending@example.com", "password": PW}, format="json"
        )
        self.assertEqual(login.status_code, status.HTTP_401_UNAUTHORIZED)


class CropIntelligenceEndpointTests(PlantApiTestCase):
    def setUp(self):
        make_user("farmer@example.com")
        self.auth = self.login("farmer@example.com")
        self.url = "/api/farmer/crops/guava/intelligence/"

    @patch("plants.crop_intelligence_service.generate_crop_intelligence", return_value=None)
    def test_gemini_failure_still_returns_200_with_harvest_window(self, _mock):
        """Gemini must never block the workflow (section 16)."""
        response = self.client.get(f"{self.url}?planting_date=2026-08-01", **self.auth)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["intelligence"])
        self.assertIsNotNone(response.data["unavailable_reason"])
        # The calculated window is still present — it comes from the DB, not AI.
        self.assertIsNotNone(response.data["harvest_window"])
        self.assertEqual(
            response.data["harvest_window"]["source"], "crop_database_calculation"
        )

    @patch("plants.crop_intelligence_service.generate_crop_intelligence", return_value=None)
    def test_plant_still_creatable_when_gemini_down(self, _mock):
        response = self.client.post(
            PLANTS_URL, {"crop_id": "guava", "planting_date": "2026-08-01"},
            format="json", **self.auth,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    @patch("plants.crop_intelligence_service.generate_crop_intelligence")
    def test_successful_generation_is_cached_per_crop(self, mock_generate):
        mock_generate.return_value = {
            "crop_overview": "Guava is a hardy tropical fruit tree.",
            "growing_notes": ["Tolerates many soils."],
            "care_guidance": ["Water regularly while establishing."],
            "harvest_guidance": "Timing varies with variety and climate.",
            "important_factors": ["Rainfall", "Variety"],
        }
        first = self.client.get(self.url, **self.auth)
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertTrue(first.data["intelligence_generated_now"])

        second = self.client.get(self.url, **self.auth)
        self.assertFalse(second.data["intelligence_generated_now"])
        # Cached, so Gemini was called only once for this crop.
        self.assertEqual(mock_generate.call_count, 1)
        self.assertEqual(CropIntelligence.objects.filter(crop_id="guava").count(), 1)

    def test_invalid_crop_returns_404(self):
        response = self.client.get("/api/farmer/crops/not-real/intelligence/", **self.auth)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_invalid_planting_date_returns_400(self):
        response = self.client.get(f"{self.url}?planting_date=bogus", **self.auth)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class CropIntelligenceServiceTests(APITestCase):
    """The service must swallow SDK failures rather than raising."""

    @patch("django.conf.settings.GEMINI_API_KEY", "")
    def test_returns_none_when_not_configured(self):
        from .crop_intelligence_service import generate_crop_intelligence

        self.assertIsNone(generate_crop_intelligence(Crop.objects.get(pk="guava")))

    def test_validation_rejects_payload_without_overview(self):
        from .crop_intelligence_service import _validate

        self.assertIsNone(_validate({"growing_notes": ["x"]}))
        self.assertIsNone(_validate("not a dict"))

    def test_validation_normalises_lists(self):
        from .crop_intelligence_service import _validate

        result = _validate(
            {
                "crop_overview": "  Overview.  ",
                "growing_notes": ["a", "", 5, "b"],
                "care_guidance": "not-a-list",
                "harvest_guidance": "Varies.",
                "important_factors": ["rain"],
            }
        )
        self.assertEqual(result["crop_overview"], "Overview.")
        self.assertEqual(result["growing_notes"], ["a", "b"])
        self.assertEqual(result["care_guidance"], [])


class LguPlantAggregationTests(PlantApiTestCase):
    """Section 28 — a new Farmer plant must show up in LGU totals."""

    def test_lgu_dashboard_counts_real_plants(self):
        farmer = make_user("farmer@example.com")
        make_user("officer@example.com", UserRole.LGU_OFFICER)
        auth = self.login("officer@example.com", LGU_LOGIN_URL)

        before = self.client.get("/api/lgu/dashboard/", **auth).data["plants"]["total"]
        self.assertEqual(before, 0)

        Plant.objects.create(
            farmer=farmer, crop=Crop.objects.get(pk="guava"), planting_date=date(2026, 8, 1)
        )
        after = self.client.get("/api/lgu/dashboard/", **auth).data["plants"]["total"]
        self.assertEqual(after, 1)

    def test_plants_of_unapproved_farmers_are_excluded(self):
        pending = make_user("pending@example.com", status_=AccountStatus.PENDING)
        make_user("officer@example.com", UserRole.LGU_OFFICER)
        Plant.objects.create(
            farmer=pending, crop=Crop.objects.get(pk="guava"), planting_date=date(2026, 8, 1)
        )
        auth = self.login("officer@example.com", LGU_LOGIN_URL)
        self.assertEqual(
            self.client.get("/api/lgu/dashboard/", **auth).data["plants"]["total"], 0
        )

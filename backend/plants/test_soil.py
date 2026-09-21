"""
Soil Recommendation tests.

The feature was the least-covered part of the backend: one assertion, in an
LGU dashboard test. These pin the behaviour that actually matters — that the
Farmer's soil information survives every Gemini failure mode, that the result
contains exactly the six agreed sections and nothing else, that no AI content
is ever invented, and that one Farmer cannot reach another's records.

Gemini is always mocked. No test here spends real API quota.
"""

from decimal import Decimal
from unittest.mock import patch

from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import AccountStatus, User, UserRole

from .models import Crop, SoilRecommendation

LIST_URL = "/api/farmer/soil-recommendations/"
SAVE_ONLY_URL = "/api/farmer/soil-recommendations/?analyze=0"
LATEST_URL = "/api/farmer/soil-recommendations/latest/"
LGU_URL = "/api/lgu/soil-recommendations/"
FARMER_LOGIN_URL = "/api/auth/farmer/login/"
LGU_LOGIN_URL = "/api/auth/lgu/login/"
PW = "SecurePassword123!"

# The six sections the Farmer UI renders — and nothing else.
RESULT_SECTIONS = {
    "suitable_fruits",
    "suitable_vegetables",
    "suitable_crops",
    "fertilizer_recommendations",
    "soil_improvement_watering",
    "important_warnings",
}

# Fields the old design carried that must never come back.
REMOVED_FIELDS = {
    "soil_summary",
    "soil_condition",
    "confidence",
    "planting_recommendations",
    "expected_suitability",
    "other_recommendations",
}

# One full set of soil-detector readings, all inside the device's ranges.
VALID_SOIL = {
    "soil_temperature": 28.5,
    "soil_moisture": 65,
    "soil_conductivity": 850,
    "soil_ph": 6.5,
    "nitrogen": 120,
    "phosphorus": 80,
    "potassium": 150,
    "soil_fertility": 600,
    "notes": "The soil dries quickly after two sunny days.",
}


def make_user(email, role=UserRole.FARMER, status_=AccountStatus.APPROVED):
    return User.objects.create_user(
        email=email, password=PW, first_name="Test", last_name="User",
        role=role, account_status=status_,
    )


def gemini_payload(crop_name):
    """A well-formed Gemini response using a real catalog crop name."""
    return {
        "suitable_fruits": [{"name": crop_name, "reason": "Suits the reported soil."}],
        "suitable_vegetables": [],
        "suitable_crops": [],
        "fertilizer_recommendations": [{"recommendation": "Add organic compost."}],
        "soil_improvement_watering": [{"recommendation": "Use mulch."}],
        "important_warnings": [{"recommendation": "No major warnings."}],
    }


class SoilTestCase(APITestCase):
    def setUp(self):
        self.farmer = make_user("farmer@example.com")
        self.other = make_user("other@example.com")
        self.officer = make_user("officer@example.com", UserRole.LGU_OFFICER)
        self.fruit = Crop.objects.filter(category="fruit").first()

    def auth(self, email, url=FARMER_LOGIN_URL):
        token = self.client.post(
            url, {"email": email, "password": PW}, format="json"
        ).data["access"]
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


class SoilSubmissionTests(SoilTestCase):
    """Saving soil information, with and without a working Gemini."""

    def test_valid_assessment_is_saved_with_ai_result(self):
        with patch(
            "plants.views.generate_soil_recommendation"
        ) as gen:
            gen.return_value = {
                "suitable_fruits": [
                    {
                        "id": self.fruit.id,
                        "name": self.fruit.name,
                        "emoji": self.fruit.emoji,
                        "reason": "Suits the reported soil.",
                    }
                ],
                "suitable_vegetables": [],
                "suitable_crops": [],
                "fertilizer_recommendations": [{"recommendation": "Add compost."}],
                "soil_improvement_watering": [{"recommendation": "Use mulch."}],
                "important_warnings": [{"recommendation": "No major warnings."}],
            }
            response = self.client.post(
                LIST_URL, VALID_SOIL, format="json", **self.auth("farmer@example.com")
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["ai_generated"])
        row = SoilRecommendation.objects.get(pk=response.data["id"])
        self.assertEqual(row.farmer, self.farmer)
        # Stored as numbers, not the strings they arrived as.
        self.assertEqual(row.soil_ph, Decimal("6.50"))
        self.assertEqual(row.soil_temperature, Decimal("28.5"))
        self.assertEqual(row.nitrogen, 120)
        self.assertIsInstance(row.nitrogen, int)

    def test_result_contains_only_the_six_sections(self):
        with patch(
            "plants.views.generate_soil_recommendation"
        ) as gen:
            gen.return_value = {key: [] for key in RESULT_SECTIONS}
            gen.return_value["suitable_fruits"] = [
                {"id": self.fruit.id, "name": self.fruit.name,
                 "emoji": self.fruit.emoji, "reason": "ok"}
            ]
            response = self.client.post(
                LIST_URL, VALID_SOIL, format="json", **self.auth("farmer@example.com")
            )

        for section in RESULT_SECTIONS:
            self.assertIn(section, response.data)
        for removed in REMOVED_FIELDS:
            self.assertNotIn(removed, response.data)

    def test_crop_entries_keep_their_emoji_for_the_frontend(self):
        with patch(
            "plants.views.generate_soil_recommendation"
        ) as gen:
            gen.return_value = {key: [] for key in RESULT_SECTIONS}
            gen.return_value["suitable_fruits"] = [
                {"id": self.fruit.id, "name": self.fruit.name,
                 "emoji": self.fruit.emoji, "reason": "ok"}
            ]
            response = self.client.post(
                LIST_URL, VALID_SOIL, format="json", **self.auth("farmer@example.com")
            )
        entry = response.data["suitable_fruits"][0]
        self.assertEqual(entry["emoji"], self.fruit.emoji)
        self.assertTrue(entry["emoji"])

    def test_every_reading_is_required(self):
        """
        The old form let a Farmer answer "unknown" to everything, because it
        asked for lab measurements they might not have. The soil detector
        supplies all eight readings, so a submission without them is now
        incomplete rather than honest, and is refused.
        """
        response = self.client.post(
            LIST_URL, {"notes": "I do not know my soil."},
            format="json", **self.auth("farmer@example.com"),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(SoilRecommendation.objects.count(), 0)
        # Named per field, so the form can mark the offending input rather
        # than making the Farmer hunt through eight numbers.
        for field in ("soil_temperature", "soil_moisture", "soil_ph", "nitrogen"):
            self.assertIn(field, response.data)

    def test_a_partial_submission_names_only_the_missing_readings(self):
        payload = {k: v for k, v in VALID_SOIL.items() if k != "soil_conductivity"}
        response = self.client.post(
            LIST_URL, payload, format="json", **self.auth("farmer@example.com")
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("soil_conductivity", response.data)
        self.assertNotIn("soil_ph", response.data)

    def test_ph_outside_the_scale_is_rejected(self):
        payload = dict(VALID_SOIL, soil_ph=15)
        response = self.client.post(
            LIST_URL, payload, format="json", **self.auth("farmer@example.com")
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(SoilRecommendation.objects.count(), 0)

    def test_ai_fields_cannot_be_injected_by_the_client(self):
        """Every AI field is read-only — a client cannot fabricate advice."""
        payload = dict(
            VALID_SOIL,
            ai_generated=True,
            suitable_fruits=[{"name": "Fake", "emoji": "X", "reason": "injected"}],
        )
        with patch(
            "plants.views.generate_soil_recommendation",
            return_value=None,
        ):
            response = self.client.post(
                LIST_URL, payload, format="json", **self.auth("farmer@example.com")
            )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        row = SoilRecommendation.objects.get(pk=response.data["id"])
        self.assertFalse(row.ai_generated)
        self.assertEqual(row.suitable_fruits, [])


class SoilGeminiFailureTests(SoilTestCase):
    """Every failure mode keeps the Farmer's soil information."""

    def _post_with_gemini_raising(self, exc):
        with patch(
            "plants.views.generate_soil_recommendation",
            side_effect=exc,
        ):
            return self.client.post(
                LIST_URL, VALID_SOIL, format="json", **self.auth("farmer@example.com")
            )

    def test_gemini_returning_none_still_saves_the_assessment(self):
        with patch(
            "plants.views.generate_soil_recommendation",
            return_value=None,
        ):
            response = self.client.post(
                LIST_URL, VALID_SOIL, format="json", **self.auth("farmer@example.com")
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data["ai_generated"])
        row = SoilRecommendation.objects.get(pk=response.data["id"])
        self.assertEqual(row.soil_ph, Decimal("6.50"))
        self.assertEqual(row.notes, VALID_SOIL["notes"])
        self.assertTrue(row.failure_reason)

    def test_no_ai_content_is_fabricated_on_failure(self):
        with patch(
            "plants.views.generate_soil_recommendation",
            return_value=None,
        ):
            response = self.client.post(
                LIST_URL, VALID_SOIL, format="json", **self.auth("farmer@example.com")
            )
        for section in RESULT_SECTIONS:
            self.assertEqual(response.data[section], [], section)

    def test_missing_api_key_is_handled(self):
        from django.test import override_settings
        from plants import soil_recommendation_service as svc

        with override_settings(GEMINI_API_KEY=""):
            self.assertFalse(svc.is_configured())
            row = SoilRecommendation(farmer=self.farmer, **{
                k: v for k, v in VALID_SOIL.items() if k != "soil_ph"
            })
            self.assertIsNone(svc.generate_soil_recommendation(row))

    def test_malformed_gemini_responses_are_rejected(self):
        """Anything that is not the agreed shape must not reach the database."""
        from plants import soil_recommendation_service as svc

        catalog = {self.fruit.name.casefold(): self.fruit}
        for bad in (
            None,
            "not a dict",
            {},
            {"suitable_fruits": "wrong type"},
            {"suitable_fruits": [{"name": "NotARealCrop", "reason": "x"}]},
            {"suitable_fruits": [{"reason": "no name"}]},
        ):
            self.assertIsNone(svc._validate(bad, catalog), bad)

    def test_hallucinated_crops_are_dropped(self):
        """A crop the catalog does not contain must never be shown."""
        from plants import soil_recommendation_service as svc

        catalog = {self.fruit.name.casefold(): self.fruit}
        payload = gemini_payload(self.fruit.name)
        payload["suitable_vegetables"] = [
            {"name": "Dragonfruit Supreme", "reason": "invented"}
        ]
        result = svc._validate(payload, catalog)
        self.assertEqual(result["suitable_vegetables"], [])
        self.assertEqual(len(result["suitable_fruits"]), 1)

    def test_a_crop_is_not_repeated_across_sections(self):
        from plants import soil_recommendation_service as svc

        catalog = {self.fruit.name.casefold(): self.fruit}
        payload = gemini_payload(self.fruit.name)
        payload["suitable_crops"] = [{"name": self.fruit.name, "reason": "dupe"}]
        result = svc._validate(payload, catalog)
        total = sum(
            len(result[k])
            for k in ("suitable_fruits", "suitable_vegetables", "suitable_crops")
        )
        self.assertEqual(total, 1)


class SoilSaveOnlyTests(SoilTestCase):
    """`?analyze=0` — the Back button path: persist, never call Gemini."""

    def test_save_only_persists_without_calling_gemini(self):
        with patch(
            "plants.views.generate_soil_recommendation"
        ) as gen:
            response = self.client.post(
                SAVE_ONLY_URL, VALID_SOIL, format="json",
                **self.auth("farmer@example.com"),
            )
            gen.assert_not_called()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data["ai_generated"])
        self.assertEqual(SoilRecommendation.objects.count(), 1)

    def test_repeated_identical_save_does_not_duplicate(self):
        """A double-clicked Back button must not stack identical rows."""
        headers = self.auth("farmer@example.com")
        first = self.client.post(SAVE_ONLY_URL, VALID_SOIL, format="json", **headers)
        second = self.client.post(SAVE_ONLY_URL, VALID_SOIL, format="json", **headers)

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data["id"], second.data["id"])
        self.assertEqual(SoilRecommendation.objects.count(), 1)

    def test_a_different_assessment_still_creates_a_new_row(self):
        headers = self.auth("farmer@example.com")
        self.client.post(SAVE_ONLY_URL, VALID_SOIL, format="json", **headers)
        self.client.post(
            SAVE_ONLY_URL, dict(VALID_SOIL, soil_ph=7.1), format="json", **headers
        )
        self.assertEqual(SoilRecommendation.objects.count(), 2)


class SoilOwnershipTests(SoilTestCase):
    """One Farmer must never reach another's soil records."""

    def setUp(self):
        super().setUp()
        self.row = SoilRecommendation.objects.create(
            farmer=self.farmer, soil_ph=Decimal("6.5"), soil_temperature=Decimal("28.5")
        )

    def detail_url(self, pk=None):
        return f"/api/farmer/soil-recommendations/{pk or self.row.pk}/"

    def test_unauthenticated_access_is_rejected(self):
        self.assertEqual(
            self.client.get(LIST_URL).status_code, status.HTTP_401_UNAUTHORIZED
        )

    def test_owner_sees_their_own_record(self):
        response = self.client.get(
            self.detail_url(), **self.auth("farmer@example.com")
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_other_farmer_cannot_read_it(self):
        response = self.client.get(self.detail_url(), **self.auth("other@example.com"))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_is_scoped_to_the_caller(self):
        response = self.client.get(LIST_URL, **self.auth("other@example.com"))
        self.assertEqual(response.data, [])

    def test_latest_is_scoped_to_the_caller(self):
        response = self.client.get(LATEST_URL, **self.auth("other@example.com"))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_farmer_cannot_use_the_lgu_endpoint(self):
        response = self.client.get(LGU_URL, **self.auth("farmer@example.com"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class SoilLguAccessTests(SoilTestCase):
    """Officers monitor approved Farmers' soil records; Farmers cannot."""

    def setUp(self):
        super().setUp()
        SoilRecommendation.objects.create(
            farmer=self.farmer, soil_ph=Decimal("7.2"), soil_temperature=Decimal("29.0"),
            ai_generated=True
        )

    def test_officer_sees_records_with_the_farmer_identified(self):
        response = self.client.get(
            LGU_URL, **self.auth("officer@example.com", LGU_LOGIN_URL)
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["farmer_email"], "farmer@example.com")
        self.assertEqual(str(response.data[0]["soil_ph"]), "7.20")

    def test_officer_does_not_see_unapproved_farmers(self):
        self.farmer.account_status = AccountStatus.SUSPENDED
        self.farmer.save(update_fields=["account_status"])
        response = self.client.get(
            LGU_URL, **self.auth("officer@example.com", LGU_LOGIN_URL)
        )
        self.assertEqual(response.data, [])

    def test_officer_view_is_read_only(self):
        response = self.client.post(
            LGU_URL, VALID_SOIL, format="json",
            **self.auth("officer@example.com", LGU_LOGIN_URL),
        )
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


class _FakeGeminiError(Exception):
    """Stands in for google.genai's ServerError, which carries `.code`."""

    def __init__(self, code, message):
        super().__init__(f"{code} {message}")
        self.code = code


class _FakeResponse:
    def __init__(self, parsed):
        self.parsed = parsed
        self.text = ""


class SoilGeminiFallbackTests(SoilTestCase):
    """
    Gemini's free tier allows 20 requests per model per day and a refused 503
    still counts, so an overloaded model is never retried - the next model,
    with its own quota, is tried instead. A 504 deadline is not passed on:
    the soil deadline is 120s, so another attempt would keep the Farmer
    waiting minutes.
    """

    def _post(self, side_effect, fallbacks=("fallback-model",)):
        with override_settings(
            GEMINI_MODEL="primary-model", GEMINI_FALLBACK_MODELS=list(fallbacks)
        ), patch("google.genai.Client") as client_cls:
            generate = client_cls.return_value.models.generate_content
            generate.side_effect = side_effect
            response = self.client.post(
                LIST_URL, VALID_SOIL, format="json", **self.auth("farmer@example.com")
            )
        return response, [call.kwargs["model"] for call in generate.call_args_list]

    def test_overloaded_primary_falls_back_to_the_next_model(self):
        response, models = self._post([
            _FakeGeminiError(503, "UNAVAILABLE. This model is currently experiencing high demand."),
            _FakeResponse(gemini_payload(self.fruit.name)),
        ])

        self.assertEqual(models, ["primary-model", "fallback-model"])
        self.assertTrue(response.data["ai_generated"])
        self.assertEqual(response.data["suitable_fruits"][0]["name"], self.fruit.name)
        row = SoilRecommendation.objects.get(pk=response.data["id"])
        self.assertEqual(row.model_name, "fallback-model")

    def test_exhausted_daily_quota_falls_back_to_the_next_model(self):
        response, models = self._post([
            _FakeGeminiError(429, "RESOURCE_EXHAUSTED"),
            _FakeResponse(gemini_payload(self.fruit.name)),
        ])

        self.assertEqual(models, ["primary-model", "fallback-model"])
        self.assertTrue(response.data["ai_generated"])

    def test_an_overloaded_model_is_never_retried(self):
        response, models = self._post(_FakeGeminiError(503, "UNAVAILABLE"), fallbacks=())

        self.assertEqual(models, ["primary-model"])
        self.assertFalse(response.data["ai_generated"])

    def test_deadline_exceeded_504_does_not_try_another_model(self):
        response, models = self._post(_FakeGeminiError(504, "DEADLINE_EXCEEDED"))

        self.assertEqual(models, ["primary-model"])
        self.assertFalse(response.data["ai_generated"])

    def test_every_model_overloaded_still_saves_the_assessment(self):
        response, models = self._post(_FakeGeminiError(503, "UNAVAILABLE"))

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(models, ["primary-model", "fallback-model"])
        self.assertFalse(response.data["ai_generated"])
        row = SoilRecommendation.objects.get(pk=response.data["id"])
        self.assertEqual(row.soil_ph, Decimal("6.50"))
        self.assertTrue(row.failure_reason)

    def test_primary_answer_records_the_primary_model(self):
        response, models = self._post([_FakeResponse(gemini_payload(self.fruit.name))])

        self.assertEqual(models, ["primary-model"])
        row = SoilRecommendation.objects.get(pk=response.data["id"])
        self.assertEqual(row.model_name, "primary-model")


REANALYZE_URL = "/api/farmer/soil-recommendations/{}/reanalyze/"


class SoilReanalyzeTests(SoilTestCase):
    """"Try Again" re-runs Gemini on a saved assessment without re-entering it."""

    def _create_failed(self, headers):
        with patch("plants.views.generate_soil_recommendation", return_value=None):
            response = self.client.post(LIST_URL, VALID_SOIL, format="json", **headers)
        self.assertFalse(response.data["ai_generated"])
        return response.data["id"]

    def _reanalyze(self, soil_id, headers, result):
        with patch(
            "plants.views.generate_soil_recommendation", return_value=result
        ) as gen:
            response = self.client.post(
                REANALYZE_URL.format(soil_id), format="json", **headers
            )
        return response, gen

    def test_retry_recovers_a_failed_assessment(self):
        headers = self.auth("farmer@example.com")
        soil_id = self._create_failed(headers)

        response, _ = self._reanalyze(soil_id, headers, gemini_payload(self.fruit.name))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["ai_generated"])
        self.assertEqual(response.data["failure_reason"], "")
        self.assertEqual(response.data["suitable_fruits"][0]["name"], self.fruit.name)
        # The same row was completed - nothing new was stacked beside it.
        self.assertEqual(SoilRecommendation.objects.count(), 1)
        self.assertEqual(
            SoilRecommendation.objects.get(pk=soil_id).notes, VALID_SOIL["notes"]
        )

    def test_retry_that_fails_again_keeps_the_assessment(self):
        headers = self.auth("farmer@example.com")
        soil_id = self._create_failed(headers)

        response, _ = self._reanalyze(soil_id, headers, None)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["ai_generated"])
        self.assertTrue(response.data["failure_reason"])
        self.assertEqual(SoilRecommendation.objects.count(), 1)

    def test_already_analysed_assessment_does_not_call_gemini(self):
        headers = self.auth("farmer@example.com")
        with patch(
            "plants.views.generate_soil_recommendation",
            return_value=gemini_payload(self.fruit.name),
        ):
            soil_id = self.client.post(
                LIST_URL, VALID_SOIL, format="json", **headers
            ).data["id"]

        response, gen = self._reanalyze(soil_id, headers, None)

        gen.assert_not_called()
        self.assertTrue(response.data["ai_generated"])

    def test_other_farmer_cannot_retry_it(self):
        soil_id = self._create_failed(self.auth("farmer@example.com"))

        response, gen = self._reanalyze(
            soil_id, self.auth("other@example.com"), gemini_payload(self.fruit.name)
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        gen.assert_not_called()

    def test_unauthenticated_retry_is_rejected(self):
        soil_id = self._create_failed(self.auth("farmer@example.com"))
        response = self.client.post(REANALYZE_URL.format(soil_id), format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_success_after_failure_still_notifies_the_farmer(self):
        from notifications.models import Notification, NotificationType

        headers = self.auth("farmer@example.com")
        with self.captureOnCommitCallbacks(execute=True):
            soil_id = self._create_failed(headers)
        with self.captureOnCommitCallbacks(execute=True):
            self._reanalyze(soil_id, headers, gemini_payload(self.fruit.name))

        ready = Notification.objects.filter(
            recipient=self.farmer,
            notification_type=NotificationType.SOIL_RECOMMENDATION_READY,
        )
        self.assertEqual(ready.count(), 1)

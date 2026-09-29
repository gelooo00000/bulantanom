"""
Every Gemini result a farmer reads comes back in their app language.

Seen live: with the app in Bikol, crop guidance, risk findings and soil
advice were all English. The frontend now sends `?lang=en|fil|bik`, and
each feature asks Gemini to write its free text in that language while the
fixed values the app reads (LOW / MEDIUM / HIGH, catalog crop names) stay
English.
"""

from unittest.mock import patch

from django.test import override_settings
from rest_framework import status

from .ai_language import language_code, write_in
from .models import SoilRecommendation
from .test_risk import GEMINI_OK, RiskTestCase, make_user, payload_with_image
from .test_soil import VALID_SOIL, SoilTestCase, _FakeResponse, gemini_payload


class WriteInTests(RiskTestCase):
    def test_english_needs_no_instruction(self):
        self.assertEqual(write_in("en"), "")

    def test_filipino_and_bikol_are_named(self):
        self.assertIn("Filipino (Tagalog)", write_in("fil"))
        self.assertIn("Bulan, Sorsogon", write_in("bik"))
        # The values the app parses must stay as given.
        self.assertIn("LOW, MEDIUM, HIGH", write_in("bik"))

    def test_an_unknown_language_is_english(self):
        self.assertEqual(language_code("xx"), "en")
        self.assertEqual(language_code(None), "en")


class RiskLanguageTests(RiskTestCase):
    def setUp(self):
        super().setUp()
        self.farmer = make_user("farmer@example.com")
        self.auth = self.login("farmer@example.com")
        self.plant = self.make_plant(self.farmer)
        self.url = f"/api/farmer/plants/{self.plant.id}/assessments/"

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK)
    def test_the_risk_evaluation_and_photo_check_get_the_farmers_language(self, evaluate):
        response = self.client.post(f"{self.url}?lang=bik", payload_with_image(), **self.auth)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(evaluate.call_args.args[1], "bik")
        self.assertEqual(self.mock_validate_evidence.call_args.args[3], "bik")
        self.assertEqual(self.plant.assessments.get().risk.language, "bik")

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK)
    def test_the_app_header_carries_the_language_too(self, evaluate):
        """What the app actually sends: Accept-Language on every request."""
        self.client.post(
            self.url, payload_with_image(), HTTP_ACCEPT_LANGUAGE="fil", **self.auth
        )
        self.assertEqual(evaluate.call_args.args[1], "fil")

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK)
    def test_a_browsers_own_language_header_means_english(self, evaluate):
        self.client.post(
            self.url, payload_with_image(), HTTP_ACCEPT_LANGUAGE="fil-PH,en;q=0.9", **self.auth
        )
        self.assertEqual(evaluate.call_args.args[1], "en")

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK)
    def test_no_language_means_english(self, evaluate):
        self.client.post(self.url, payload_with_image(), **self.auth)
        self.assertEqual(evaluate.call_args.args[1], "en")

    @override_settings(GEMINI_API_KEY="test-key", GEMINI_MODEL="primary-model")
    def test_the_prompt_sent_to_gemini_asks_for_that_language(self):
        from .risk_evaluation_service import evaluate_assessment

        # Stored without calling Gemini; the call under test is made below.
        with patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK):
            self.client.post(self.url, payload_with_image(), **self.auth)
        assessment = self.plant.assessments.get()
        with patch("google.genai.Client") as client_cls:
            generate = client_cls.return_value.models.generate_content
            generate.side_effect = Exception("stop after the request is built")
            evaluate_assessment(assessment, "fil")
        contents = generate.call_args.kwargs["contents"]
        self.assertTrue(any("Filipino (Tagalog)" in str(part) for part in contents))


class SoilLanguageTests(SoilTestCase):
    URL = "/api/farmer/soil-recommendations/"

    def test_the_soil_advice_is_asked_for_and_stored_in_the_farmers_language(self):
        with patch("plants.views.generate_soil_recommendation") as generate:
            generate.return_value = None
            self.client.post(
                f"{self.URL}?lang=fil", VALID_SOIL, format="json", **self.auth("farmer@example.com")
            )
        self.assertEqual(generate.call_args.args[1], "fil")

    @override_settings(
        GEMINI_API_KEY="test-key", GEMINI_MODEL="primary-model", GEMINI_FALLBACK_MODELS=[]
    )
    def test_the_prompt_asks_for_bikol_and_the_row_records_it(self):
        with patch("google.genai.Client") as client_cls:
            generate = client_cls.return_value.models.generate_content
            generate.return_value = _FakeResponse(gemini_payload(self.fruit.name))
            response = self.client.post(
                f"{self.URL}?lang=bik", VALID_SOIL, format="json", **self.auth("farmer@example.com")
            )

        self.assertIn("Bulan, Sorsogon", generate.call_args.kwargs["contents"])
        row = SoilRecommendation.objects.get(pk=response.data["id"])
        self.assertTrue(row.ai_generated)
        self.assertEqual(row.language, "bik")

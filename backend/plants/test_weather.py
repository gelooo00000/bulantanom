"""
Header weather tests. Open-Meteo is always mocked: these never reach the
network, and they pin the behaviour that matters — a real reading when there
is one, no invented reading when there is not, and one upstream call per
cache window.
"""

from unittest.mock import MagicMock, patch

import requests
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import AccountStatus, User, UserRole

from .weather_service import condition_for, current_weather

URL = "/api/weather/"
PW = "SecurePassword123!"


def upstream(current):
    response = MagicMock()
    response.raise_for_status.return_value = None
    response.json.return_value = {"current": current}
    return response


GOOD = {"time": "2026-09-24T11:15", "temperature_2m": 30.7, "weather_code": 61, "is_day": 1}


@override_settings(
    FARM_LATITUDE=12.67,
    FARM_LONGITUDE=123.88,
    WEATHER_CACHE_SECONDS=1800,
    WEATHER_FAILURE_CACHE_SECONDS=300,
    WEATHER_TIMEOUT_SECONDS=5,
)
class WeatherServiceTests(TestCase):
    def setUp(self):
        cache.clear()

    @patch("plants.weather_service.requests.get")
    def test_returns_the_live_reading(self, get):
        get.return_value = upstream(GOOD)
        self.assertEqual(
            current_weather(),
            {
                "available": True,
                "temperature_c": 31,
                "condition": "light_rain",
                "is_day": True,
                "observed_at": "2026-09-24T11:15",
            },
        )

    @patch("plants.weather_service.requests.get")
    def test_sends_only_the_farm_coordinates(self, get):
        get.return_value = upstream(GOOD)
        current_weather()
        params = get.call_args.kwargs["params"]
        self.assertEqual(params["latitude"], 12.67)
        self.assertEqual(params["longitude"], 123.88)
        self.assertEqual(set(params), {"latitude", "longitude", "current", "timezone"})
        self.assertEqual(get.call_args.kwargs["timeout"], 5)

    @patch("plants.weather_service.requests.get")
    def test_one_upstream_call_serves_every_request_in_the_window(self, get):
        get.return_value = upstream(GOOD)
        for _ in range(5):
            current_weather()
        self.assertEqual(get.call_count, 1)

    @patch("plants.weather_service.requests.get")
    def test_an_outage_reports_unavailable_rather_than_a_made_up_reading(self, get):
        get.side_effect = requests.ConnectionError("no route to host")
        self.assertEqual(current_weather(), {"available": False})

    @patch("plants.weather_service.requests.get")
    def test_an_outage_is_not_retried_on_every_page(self, get):
        get.side_effect = requests.Timeout("slow")
        current_weather()
        current_weather()
        self.assertEqual(get.call_count, 1)

    @patch("plants.weather_service.requests.get")
    def test_a_malformed_reading_is_unavailable(self, get):
        for current in (
            {**GOOD, "temperature_2m": None},
            {**GOOD, "temperature_2m": True},
            {**GOOD, "weather_code": 12345},
            {},
        ):
            cache.clear()
            get.return_value = upstream(current)
            self.assertEqual(current_weather(), {"available": False}, current)

    def test_weather_codes_group_into_farmer_conditions(self):
        self.assertEqual(condition_for(0), "clear")
        self.assertEqual(condition_for(3), "cloudy")
        self.assertEqual(condition_for(82), "heavy_rain")
        self.assertEqual(condition_for(95), "thunderstorm")
        self.assertIsNone(condition_for(True))
        self.assertIsNone(condition_for("3"))


class WeatherEndpointTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def login(self, role):
        user = User.objects.create_user(
            email=f"{role.lower()}@example.com",
            password=PW,
            first_name="Test",
            last_name="User",
            role=role,
            account_status=AccountStatus.APPROVED,
        )
        self.client.force_authenticate(user)

    def test_requires_sign_in(self):
        self.assertEqual(self.client.get(URL).status_code, 401)

    @patch("plants.weather_service.requests.get")
    def test_every_role_can_read_it(self, get):
        get.return_value = upstream(GOOD)
        for role in (UserRole.FARMER, UserRole.LGU_OFFICER, UserRole.ADMIN):
            self.login(role)
            response = self.client.get(URL)
            self.assertEqual(response.status_code, 200, role)
            self.assertEqual(response.data["temperature_c"], 31)

    @patch("plants.weather_service.requests.get")
    def test_an_outage_is_still_a_200(self, get):
        get.side_effect = requests.ConnectionError("down")
        self.login(UserRole.FARMER)
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"available": False})

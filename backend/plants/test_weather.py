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


def upstream_daily(daily):
    response = MagicMock()
    response.raise_for_status.return_value = None
    response.json.return_value = {"daily": daily}
    return response


# Eight days back to today; the summary keeps the last seven.
WEEK = {
    "time": [f"2026-10-{day:02d}" for day in range(5, 13)],
    "precipitation_sum": [50.0, 0.0, 12.4, 0.6, 3.0, 0.0, 25.5, 1.0],
    "temperature_2m_max": [30.0, 31.2, 29.8, 30.5, 32.4, 31.0, 28.9, 29.5],
    "temperature_2m_min": [21.0, 24.1, 23.6, 23.0, 24.8, 23.9, 22.7, 23.2],
}


@override_settings(WEATHER_CACHE_SECONDS=1800, WEATHER_FAILURE_CACHE_SECONDS=300)
class RecentWeatherTests(TestCase):
    def setUp(self):
        cache.clear()

    @patch("plants.weather_service.requests.get")
    def test_summarises_the_last_seven_days(self, get):
        from .weather_service import recent_weather

        get.return_value = upstream_daily(WEEK)
        self.assertEqual(
            recent_weather(),
            {
                "available": True,
                "days": 7,
                "from": "2026-10-06",
                "to": "2026-10-12",
                "rain_total_mm": 42.5,
                "rainy_days": 4,
                "wettest_day_mm": 25.5,
                "temperature_max_c": 32,
                "temperature_min_c": 23,
            },
        )
        self.assertEqual(get.call_args.kwargs["params"]["past_days"], 7)

    @patch("plants.weather_service.requests.get")
    def test_incomplete_days_are_unavailable_not_guessed(self, get):
        from .weather_service import recent_weather

        get.return_value = upstream_daily({**WEEK, "precipitation_sum": [1.0, None] * 4})
        self.assertEqual(recent_weather(), {"available": False})

    @patch("plants.weather_service.requests.get", side_effect=requests.ConnectionError)
    def test_an_outage_is_unavailable_and_cached_briefly(self, get):
        from .weather_service import recent_weather

        self.assertEqual(recent_weather(), {"available": False})
        recent_weather()
        self.assertEqual(get.call_count, 1)

"""How long a Farmer uses BulanTanom, as the LGU sees it."""

from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from .models import AccountStatus, UsageDay, UserRole
from .test_lgu import FARMER_LOGIN_URL, FARMERS_URL, LGU_LOGIN_URL, PW, make_user
from .usage import record_minute

HEARTBEAT_URL = "/api/auth/heartbeat/"


class UsageTests(APITestCase):
    def setUp(self):
        make_user("officer@example.com", UserRole.LGU_OFFICER, AccountStatus.APPROVED)
        self.farmer = make_user("farmer@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        officer_token = self.client.post(
            LGU_LOGIN_URL, {"email": "officer@example.com", "password": PW}, format="json"
        ).data["access"]
        self.officer = {"HTTP_AUTHORIZATION": f"Bearer {officer_token}"}

    def _usage(self):
        rows = self.client.get(FARMERS_URL, **self.officer).data
        return next(row for row in rows if row["email"] == "farmer@example.com")["usage"]

    def test_a_heartbeat_counts_a_minute(self):
        token = self.client.post(
            FARMER_LOGIN_URL, {"email": "farmer@example.com", "password": PW}, format="json"
        ).data["access"]
        self.client.post(HEARTBEAT_URL, HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(self._usage()["today"], 1)

    def test_heartbeats_moments_apart_count_once(self):
        now = timezone.now()
        record_minute(self.farmer, now)
        record_minute(self.farmer, now + timedelta(seconds=10))  # a second tab
        record_minute(self.farmer, now + timedelta(seconds=60))  # the next minute
        self.assertEqual(UsageDay.objects.get(user=self.farmer).minutes, 2)

    def test_today_week_and_month_add_up_the_right_days(self):
        today = timezone.localdate()
        for days_ago, minutes in [(0, 30), (3, 60), (20, 90), (40, 500)]:
            UsageDay.objects.create(user=self.farmer, date=today - timedelta(days=days_ago), minutes=minutes)
        usage = self._usage()
        self.assertEqual(usage["today"], 30)
        self.assertEqual(usage["week"], 90)
        self.assertEqual(usage["month"], 180)  # the 40-day-old day is outside
        self.assertIn("since", usage)

    def test_a_farmer_who_never_used_it_shows_zero(self):
        self.assertEqual(self._usage(), {**self._usage(), "today": 0, "week": 0, "month": 0})

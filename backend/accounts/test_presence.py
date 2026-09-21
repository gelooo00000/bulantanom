from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import AccountStatus, User, UserRole
from .presence import ONLINE_WINDOW, is_online
from .test_lgu import FARMER_LOGIN_URL, FARMERS_URL, LGU_LOGIN_URL, PW, make_user

HEARTBEAT_URL = "/api/auth/heartbeat/"
LOGOUT_URL = "/api/auth/logout/"


class PresenceTests(APITestCase):
    """The LGU's online indicator must follow what the Farmer actually does."""

    def setUp(self):
        make_user("officer@example.com", UserRole.LGU_OFFICER, AccountStatus.APPROVED)
        self.farmer = make_user("farmer@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        officer_token = self.client.post(
            LGU_LOGIN_URL, {"email": "officer@example.com", "password": PW}, format="json"
        ).data["access"]
        self.officer = {"HTTP_AUTHORIZATION": f"Bearer {officer_token}"}

    def _farmer_login(self):
        response = self.client.post(
            FARMER_LOGIN_URL, {"email": "farmer@example.com", "password": PW}, format="json"
        )
        return {"HTTP_AUTHORIZATION": f"Bearer {response.data['access']}"}

    def _row(self):
        rows = self.client.get(FARMERS_URL, **self.officer).data
        return next(row for row in rows if row["email"] == "farmer@example.com")

    def test_a_farmer_who_never_signed_in_is_offline_with_no_last_seen(self):
        row = self._row()
        self.assertFalse(row["is_online"])
        self.assertIsNone(row["last_seen_at"])

    def test_heartbeat_marks_the_farmer_online(self):
        farmer = self._farmer_login()
        self.assertEqual(
            self.client.post(HEARTBEAT_URL, **farmer).status_code,
            status.HTTP_204_NO_CONTENT,
        )
        row = self._row()
        self.assertTrue(row["is_online"])
        self.assertIsNotNone(row["last_seen_at"])

    def test_heartbeat_requires_a_signed_in_user(self):
        self.assertEqual(
            self.client.post(HEARTBEAT_URL).status_code, status.HTTP_401_UNAUTHORIZED
        )

    def test_logging_out_takes_the_farmer_offline_at_once(self):
        farmer = self._farmer_login()
        self.client.post(HEARTBEAT_URL, **farmer)
        self.assertTrue(self._row()["is_online"])

        # The refresh cookie set at login identifies who is logging out.
        self.client.post(LOGOUT_URL)
        row = self._row()
        self.assertFalse(row["is_online"])
        # When they were last there is kept, for "last active …".
        self.assertIsNotNone(row["last_seen_at"])

    def test_going_quiet_past_the_window_reads_as_offline(self):
        long_ago = timezone.now() - ONLINE_WINDOW - timedelta(seconds=1)
        User.objects.filter(pk=self.farmer.pk).update(last_seen_at=long_ago)
        self.assertFalse(self._row()["is_online"])

    def test_signing_back_in_after_logout_is_online_again(self):
        now = timezone.now()
        self.farmer.last_logout_at = now - timedelta(minutes=1)
        self.farmer.last_seen_at = now
        self.assertTrue(is_online(self.farmer, now))

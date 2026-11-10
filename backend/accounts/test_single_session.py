"""One device per account: a new sign-in ends the session on the other device."""

from django.conf import settings
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .models import AccountStatus, UserRole
from .sessions import SIGNED_IN_ELSEWHERE
from .tests import FARMER_LOGIN_URL, ME_URL, REFRESH_URL, make_user

CREDENTIALS = {"email": "farmer@example.com", "password": "SecurePassword123!"}


def sign_in(client):
    response = client.post(FARMER_LOGIN_URL, CREDENTIALS, format="json")
    assert response.status_code == status.HTTP_200_OK, response.data
    return response.data["access"]


class SingleDeviceTests(APITestCase):
    def setUp(self):
        make_user("farmer@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        self.laptop = APIClient()
        self.phone = APIClient()

    def test_signing_in_on_a_phone_ends_the_laptop_session(self):
        laptop_token = sign_in(self.laptop)
        self.assertEqual(
            self.laptop.get(ME_URL, HTTP_AUTHORIZATION=f"Bearer {laptop_token}").status_code,
            status.HTTP_200_OK,
        )

        phone_token = sign_in(self.phone)

        # The laptop's still-unexpired access token is refused at once...
        refused = self.laptop.get(ME_URL, HTTP_AUTHORIZATION=f"Bearer {laptop_token}")
        self.assertEqual(refused.status_code, status.HTTP_401_UNAUTHORIZED)
        # ...and its refresh cookie cannot start a new session, with the reason given.
        refresh = self.laptop.post(REFRESH_URL)
        self.assertEqual(refresh.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(refresh.data["code"], SIGNED_IN_ELSEWHERE)
        self.assertEqual(refresh.cookies[settings.REFRESH_COOKIE_NAME].value, "")

        # The phone carries on.
        self.assertEqual(
            self.phone.get(ME_URL, HTTP_AUTHORIZATION=f"Bearer {phone_token}").status_code,
            status.HTTP_200_OK,
        )

    def test_refreshing_keeps_the_same_device_signed_in(self):
        sign_in(self.laptop)
        renewed = self.laptop.post(REFRESH_URL)
        self.assertEqual(renewed.status_code, status.HTTP_200_OK)
        again = self.laptop.post(REFRESH_URL)
        self.assertEqual(again.status_code, status.HTTP_200_OK)
        me = self.laptop.get(ME_URL, HTTP_AUTHORIZATION=f"Bearer {again.data['access']}")
        self.assertEqual(me.status_code, status.HTTP_200_OK)

    def test_the_laptop_can_take_the_account_back(self):
        sign_in(self.laptop)
        phone_token = sign_in(self.phone)
        laptop_token = sign_in(self.laptop)

        self.assertEqual(
            self.phone.get(ME_URL, HTTP_AUTHORIZATION=f"Bearer {phone_token}").status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertEqual(
            self.laptop.get(ME_URL, HTTP_AUTHORIZATION=f"Bearer {laptop_token}").status_code,
            status.HTTP_200_OK,
        )

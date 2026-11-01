"""
Forgotten passwords, and the limits on everything that sends a code.
"""

from django.core import mail
from django.core.cache import caches
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APIRequestFactory, APITestCase
from rest_framework.request import Request
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from .models import AccountStatus, EmailVerification, User, UserRole
from .throttles import SignupIpThrottle

PW = "SecurePassword123!"
NEW_PW = "BrandNewPassword456!"
FORGOT_URL = "/api/auth/farmer/forgot-password/"
RESET_URL = "/api/auth/farmer/reset-password/"
LOGIN_URL = "/api/auth/farmer/login/"
SIGNUP_URL = "/api/auth/farmer/signup/"

REAL_THROTTLE_CACHE = {
    "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"},
    "throttle": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "password-reset-tests",
    },
}


def make_farmer(email="juan@example.com", **extra):
    defaults = {
        "password": PW,
        "first_name": "Juan",
        "last_name": "Cruz",
        "role": UserRole.FARMER,
        "account_status": AccountStatus.APPROVED,
        "email_verified": True,
    }
    return User.objects.create_user(email=email, **{**defaults, **extra})


class PasswordResetTests(APITestCase):
    def setUp(self):
        self.farmer = make_farmer()

    def request_code(self):
        response = self.client.post(FORGOT_URL, {"email": self.farmer.email}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return mail.outbox[-1].subject.split()[0]

    def reset(self, code, password=NEW_PW, confirm=None):
        return self.client.post(
            RESET_URL,
            {
                "email": self.farmer.email,
                "code": code,
                "password": password,
                "password_confirm": confirm or password,
            },
            format="json",
        )

    def test_the_code_sets_a_new_password(self):
        response = self.reset(self.request_code())
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        old = self.client.post(LOGIN_URL, {"email": self.farmer.email, "password": PW}, format="json")
        new = self.client.post(
            LOGIN_URL, {"email": self.farmer.email, "password": NEW_PW}, format="json"
        )
        self.assertEqual(old.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(new.status_code, status.HTTP_200_OK)

    def test_the_email_says_it_is_a_password_reset(self):
        self.request_code()
        self.assertIn("password reset code", mail.outbox[-1].subject)
        self.assertIn("choose a new password", mail.outbox[-1].body)

    def test_the_code_works_once(self):
        code = self.request_code()
        self.reset(code)
        self.assertEqual(self.reset(code, password="AnotherPassword789!").status_code, 400)

    def test_a_wrong_code_changes_nothing_and_counts_as_a_guess(self):
        code = self.request_code()
        wrong = "000000" if code != "000000" else "111111"
        self.assertEqual(self.reset(wrong).status_code, status.HTTP_400_BAD_REQUEST)

        self.farmer.refresh_from_db()
        self.assertTrue(self.farmer.check_password(PW))
        self.assertEqual(EmailVerification.objects.get(user=self.farmer).attempts, 1)

    def test_a_weak_password_is_refused_without_spending_the_code(self):
        code = self.request_code()
        response = self.reset(code, password="12345678")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)
        self.assertEqual(self.reset(code).status_code, status.HTTP_200_OK)

    def test_mismatched_passwords_are_refused(self):
        response = self.reset(self.request_code(), confirm="SomethingElse123!")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password_confirm", response.data)

    def test_a_reset_ends_every_existing_session(self):
        RefreshToken.for_user(self.farmer)
        RefreshToken.for_user(self.farmer)
        self.reset(self.request_code())

        outstanding = OutstandingToken.objects.filter(user=self.farmer).count()
        self.assertEqual(outstanding, 2)
        self.assertEqual(
            BlacklistedToken.objects.filter(token__user=self.farmer).count(), outstanding
        )

    def test_it_also_proves_an_older_unverified_address(self):
        self.farmer.email_verified = False
        self.farmer.save(update_fields=["email_verified"])
        self.reset(self.request_code())
        self.farmer.refresh_from_db()
        self.assertTrue(self.farmer.email_verified)

    def test_an_unknown_address_gets_the_same_answer_and_no_email(self):
        response = self.client.post(FORGOT_URL, {"email": "nobody@example.com"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("If nobody@example.com has an account", response.data["detail"])
        self.assertEqual(mail.outbox, [])

    def test_only_active_finished_farmer_accounts_get_a_code(self):
        make_farmer("suspended@example.com", account_status=AccountStatus.SUSPENDED)
        make_farmer("pending@example.com", pending_signup=True, email_verified=False)
        make_farmer("officer@example.com", role=UserRole.LGU_OFFICER)
        for email in ("suspended@example.com", "pending@example.com", "officer@example.com"):
            self.client.post(FORGOT_URL, {"email": email}, format="json")
        self.assertEqual(mail.outbox, [])

    def test_a_second_code_inside_the_cooldown_is_refused(self):
        self.request_code()
        response = self.client.post(FORGOT_URL, {"email": self.farmer.email}, format="json")
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


SIGNUP = {
    "first_name": "Maria",
    "last_name": "Santos",
    "email": "maria@example.com",
    "password": PW,
    "password_confirm": PW,
}


@override_settings(CACHES=REAL_THROTTLE_CACHE)
class CodeLimitTests(APITestCase):
    def setUp(self):
        caches["throttle"].clear()

    @override_settings(EMAIL_CODES_PER_DAY=1)
    def test_the_daily_budget_stops_further_codes(self):
        first = self.client.post(SIGNUP_URL, SIGNUP, format="json")
        second = self.client.post(
            SIGNUP_URL, {**SIGNUP, "email": "pedro@example.com"}, format="json"
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(len(mail.outbox), 1)
        self.assertFalse(User.objects.filter(email="pedro@example.com").exists())

    def test_one_address_cannot_be_flooded_with_sign_ups(self):
        for _ in range(5):
            self.client.post(SIGNUP_URL, SIGNUP, format="json")
        response = self.client.post(SIGNUP_URL, SIGNUP, format="json")
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class ClientAddressTests(APITestCase):
    def ident(self, **headers):
        request = Request(APIRequestFactory().post("/", **headers))
        return SignupIpThrottle().get_ident(request)

    @override_settings(CLIENT_IP_HEADER="CF-Connecting-IP")
    def test_a_forged_forwarded_header_does_not_change_the_address(self):
        honest = self.ident(HTTP_CF_CONNECTING_IP="1.2.3.4", HTTP_X_FORWARDED_FOR="1.2.3.4")
        forged = self.ident(
            HTTP_CF_CONNECTING_IP="1.2.3.4", HTTP_X_FORWARDED_FOR="9.9.9.9, 1.2.3.4"
        )
        self.assertEqual(honest, "1.2.3.4")
        self.assertEqual(forged, "1.2.3.4")

    @override_settings(CLIENT_IP_HEADER="CF-Connecting-IP")
    def test_without_the_header_it_falls_back_to_the_connection(self):
        self.assertEqual(self.ident(REMOTE_ADDR="5.6.7.8"), "5.6.7.8")

"""
New-device sign-in check (accounts.devices), the password-changed email, and
the proxy-forwarded client address used by the sign-in rate limits.
"""

from datetime import timedelta

from django.conf import settings
from django.core import mail
from django.test import RequestFactory, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from .models import AccountStatus, TrustedDevice, User, UserRole
from .throttles import client_ip

PW = "SecurePassword123!"
NEW_PW = "BrandNewPassword456!"
FARMER_LOGIN_URL = "/api/auth/farmer/login/"
LGU_LOGIN_URL = "/api/auth/lgu/login/"
ADMIN_LOGIN_URL = "/api/auth/admin/login/"
VERIFY_URL = "/api/auth/login/verify/"
RESEND_URL = "/api/auth/login/resend-code/"
FORGOT_URL = "/api/auth/farmer/forgot-password/"
RESET_URL = "/api/auth/farmer/reset-password/"
IPHONE = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
)


def make_user(email="juan@example.com", role=UserRole.FARMER, **extra):
    defaults = {
        "password": PW,
        "first_name": "Juan",
        "last_name": "Cruz",
        "role": role,
        "account_status": AccountStatus.APPROVED,
        "email_verified": True,
    }
    return User.objects.create_user(email=email, **{**defaults, **extra})


def age_code(user):
    """Moves the last code's send time back past the 60-second resend wait."""
    row = user.email_verification
    row.sent_at -= timedelta(minutes=2)
    row.save()


def last_code(subject_words="sign-in code"):
    for message in reversed(mail.outbox):
        if subject_words in message.subject:
            return message.subject.split()[0]
    raise AssertionError(f"No email with {subject_words!r} was sent.")


@override_settings(NEW_DEVICE_CHECK=True)
class NewDeviceTests(APITestCase):
    def setUp(self):
        self.farmer = make_user()

    def login(self, url=FARMER_LOGIN_URL, email="juan@example.com", password=PW):
        return self.client.post(
            url, {"email": email, "password": password}, format="json", HTTP_USER_AGENT=IPHONE
        )

    def verify(self, challenge, code, email="juan@example.com"):
        return self.client.post(
            VERIFY_URL,
            {"email": email, "challenge": challenge, "code": code},
            format="json",
            HTTP_USER_AGENT=IPHONE,
        )

    def test_a_new_device_needs_the_emailed_code(self):
        response = self.login()
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["code"], "new_device")
        self.assertNotIn("access", response.data)
        self.assertNotIn(settings.REFRESH_COOKIE_NAME, response.cookies)
        self.assertIn("sign-in code", mail.outbox[-1].subject)
        self.assertIn("new device", mail.outbox[-1].body)

    def test_the_code_signs_in_and_trusts_the_device(self):
        challenge = self.login().data["challenge"]
        response = self.verify(challenge, last_code())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn(settings.REFRESH_COOKIE_NAME, response.cookies)
        cookie = response.cookies[settings.DEVICE_COOKIE_NAME]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["max-age"], 30 * 24 * 60 * 60)
        device = TrustedDevice.objects.get(user=self.farmer)
        self.assertEqual(device.label, "Safari on iPhone")
        self.assertNotEqual(device.token_hash, cookie.value)

        # Same browser again: straight in, no new email.
        sent = len(mail.outbox)
        again = self.login()
        self.assertEqual(again.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), sent)

    def test_another_browser_is_still_asked(self):
        challenge = self.login().data["challenge"]
        self.verify(challenge, last_code())
        self.client.cookies.clear()
        self.assertEqual(self.login().status_code, status.HTTP_403_FORBIDDEN)

    def test_a_wrong_password_sends_no_code(self):
        response = self.login(password="wrong-password")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(len(mail.outbox), 0)

    def test_the_code_alone_is_not_enough(self):
        self.login()
        response = self.verify("forged-challenge", last_code())
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn("access", response.data)

    def test_a_challenge_only_works_for_its_own_email(self):
        other = make_user(email="maria@example.com")
        challenge = self.login().data["challenge"]
        response = self.verify(challenge, last_code(), email=other.email)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_a_wrong_code_is_refused_and_locks_after_five(self):
        challenge = self.login().data["challenge"]
        code = last_code()
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(4):
            self.assertEqual(self.verify(challenge, wrong).status_code, 400)
        fifth = self.verify(challenge, wrong)
        self.assertIn("Too many wrong codes", fifth.data["detail"])
        self.assertEqual(self.verify(challenge, code).status_code, 400)

    def test_a_password_reset_code_does_not_finish_a_sign_in(self):
        challenge = self.login().data["challenge"]
        age_code(self.farmer)
        self.client.post(FORGOT_URL, {"email": self.farmer.email}, format="json")
        response = self.verify(challenge, last_code("password reset code"))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_resend_sends_a_fresh_code(self):
        challenge = self.login().data["challenge"]
        first = last_code()
        age_code(self.farmer)
        response = self.client.post(
            RESEND_URL, {"email": self.farmer.email, "challenge": challenge}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        second = last_code()
        if second != first:
            self.assertEqual(self.verify(challenge, first).status_code, 400)
        self.assertEqual(self.verify(challenge, second).status_code, 200)

    def test_a_suspended_account_cannot_finish(self):
        challenge = self.login().data["challenge"]
        self.farmer.account_status = AccountStatus.SUSPENDED
        self.farmer.save()
        response = self.verify(challenge, last_code())
        self.assertNotIn("access", getattr(response, "data", {}) or {})
        self.assertIn(response.status_code, (401, 403))

    def test_lgu_and_admin_are_checked_too(self):
        make_user(email="officer@example.com", role=UserRole.LGU_OFFICER)
        make_user(email="admin@example.com", role=UserRole.ADMIN)
        lgu = self.login(LGU_LOGIN_URL, "officer@example.com")
        admin = self.login(ADMIN_LOGIN_URL, "admin@example.com")
        self.assertEqual(lgu.data["code"], "new_device")
        self.assertEqual(admin.data["code"], "new_device")
        response = self.verify(admin.data["challenge"], last_code(), email="admin@example.com")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["role"], "ADMIN")

    def test_a_password_reset_forgets_devices_and_cancels_waiting_sign_ins(self):
        challenge = self.login().data["challenge"]
        self.verify(challenge, last_code())
        pending = self.login(password=PW)  # Trusted now, so this signs in.
        self.assertEqual(pending.status_code, 200)

        self.client.cookies.clear()
        waiting = self.login().data["challenge"]
        age_code(self.farmer)
        self.client.post(FORGOT_URL, {"email": self.farmer.email}, format="json")
        reset = self.client.post(
            RESET_URL,
            {
                "email": self.farmer.email,
                "code": last_code("password reset code"),
                "password": NEW_PW,
                "password_confirm": NEW_PW,
            },
            format="json",
        )
        self.assertEqual(reset.status_code, 200)
        self.assertFalse(TrustedDevice.objects.filter(user=self.farmer).exists())
        # A challenge from before the reset no longer works.
        self.assertEqual(self.verify(waiting, "123456").data["detail"],
                         "This sign-in has expired. Please sign in again.")


class PasswordChangedEmailTests(APITestCase):
    def test_a_reset_emails_the_owner(self):
        farmer = make_user()
        self.client.post(FORGOT_URL, {"email": farmer.email}, format="json")
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(
                RESET_URL,
                {
                    "email": farmer.email,
                    "code": last_code("password reset code"),
                    "password": NEW_PW,
                    "password_confirm": NEW_PW,
                },
                format="json",
            )
        notice = mail.outbox[-1]
        self.assertEqual(notice.subject, "Your BulanTanom password was changed")
        self.assertEqual(notice.to, [farmer.email])
        self.assertIn("Not you?", notice.body)
        self.assertIn("/forgot-password", notice.body)


class ProxyClientIpTests(APITestCase):
    def request(self, **headers):
        return RequestFactory().post("/api/auth/farmer/login/", **headers)

    @override_settings(API_PROXY_SECRET="s3cret", CLIENT_IP_HEADER="CF-Connecting-IP")
    def test_the_forwarded_address_is_used_with_the_secret(self):
        request = self.request(
            HTTP_X_BULANTANOM_CLIENT_IP="203.0.113.7",
            HTTP_X_BULANTANOM_PROXY_SECRET="s3cret",
            HTTP_CF_CONNECTING_IP="198.51.100.1",
        )
        self.assertEqual(client_ip(request), "203.0.113.7")

    @override_settings(API_PROXY_SECRET="s3cret", CLIENT_IP_HEADER="CF-Connecting-IP")
    def test_a_forged_address_without_the_secret_is_ignored(self):
        request = self.request(
            HTTP_X_BULANTANOM_CLIENT_IP="203.0.113.7",
            HTTP_X_BULANTANOM_PROXY_SECRET="guess",
            HTTP_CF_CONNECTING_IP="198.51.100.1",
        )
        self.assertEqual(client_ip(request), "198.51.100.1")

    @override_settings(API_PROXY_SECRET="", CLIENT_IP_HEADER="CF-Connecting-IP")
    def test_no_secret_configured_means_the_header_is_never_trusted(self):
        request = self.request(
            HTTP_X_BULANTANOM_CLIENT_IP="203.0.113.7",
            HTTP_X_BULANTANOM_PROXY_SECRET="",
            HTTP_CF_CONNECTING_IP="198.51.100.1",
        )
        self.assertEqual(client_ip(request), "198.51.100.1")

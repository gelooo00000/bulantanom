"""
Rate limits for the sign-in endpoints, so a password cannot be guessed by
trying thousands of them.

Two limits apply to every login request:

- per account (the email typed), which an attacker cannot dodge by changing
  address or headers: it is what protects one known account, such as the
  Admin's, from being guessed;
- per client address, which slows one machine trying many accounts. The
  address comes from settings.CLIENT_IP_HEADER, because X-Forwarded-For can
  be forged behind Render's proxy.

Counts live in the "throttle" cache (settings.CACHES), a database table
shared by every gunicorn worker so each attempt is counted once.
"""

import hmac

from django.conf import settings
from django.core.cache import caches
from rest_framework.throttling import SimpleRateThrottle


class _LoginThrottle(SimpleRateThrottle):
    @property
    def cache(self):
        return caches["throttle"]

    def get_ident(self, request):
        return client_ip(request) or super().get_ident(request)


def client_ip(request) -> str:
    """
    The visitor's address, or "" to let DRF decide.

    Requests forwarded by the frontend (src/proxy.ts) carry the visitor's
    address in X-BulanTanom-Client-IP. It is believed only with the shared
    secret, because anyone can send that header straight to the API.
    """
    secret = settings.API_PROXY_SECRET
    if secret:
        sent = request.headers.get("X-BulanTanom-Proxy-Secret", "")
        address = request.headers.get("X-BulanTanom-Client-IP", "").strip()
        if address and hmac.compare_digest(sent.encode(), secret.encode()):
            return address
    if settings.CLIENT_IP_HEADER:
        return request.headers.get(settings.CLIENT_IP_HEADER, "").strip()
    return ""


class LoginEmailThrottle(_LoginThrottle):
    scope = "login_email"

    def get_cache_key(self, request, view):
        email = request.data.get("email") if hasattr(request.data, "get") else None
        if not isinstance(email, str) or not email.strip():
            return None  # The serializer rejects it; nothing to count.
        return self.cache_format % {"scope": self.scope, "ident": email.strip().lower()}


class LoginEmailHourlyThrottle(LoginEmailThrottle):
    scope = "login_email_hourly"


class LoginIpThrottle(_LoginThrottle):
    scope = "login_ip"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


LOGIN_THROTTLES = [LoginEmailThrottle, LoginEmailHourlyThrottle, LoginIpThrottle]


class VerifyEmailThrottle(LoginEmailThrottle):
    """Guesses at one account's sign-up code, on top of its 5-wrong-guess limit."""

    scope = "verify_email"


class ResendEmailThrottle(LoginEmailThrottle):
    """New codes asked for one address, so it cannot be flooded with email."""

    scope = "resend_email"


class SignupEmailThrottle(LoginEmailThrottle):
    """Sign-ups for one address, each of which emails it a code."""

    scope = "signup_email"


class SignupIpThrottle(LoginIpThrottle):
    """Every sign-up sends an email; one machine cannot send hundreds."""

    scope = "signup_ip"


VERIFY_THROTTLES = [VerifyEmailThrottle, LoginIpThrottle]
RESEND_THROTTLES = [ResendEmailThrottle, LoginIpThrottle]
SIGNUP_THROTTLES = [SignupEmailThrottle, SignupIpThrottle]

"""
Rate limits for the sign-in endpoints, so a password cannot be guessed by
trying thousands of them.

Two limits apply to every login request:

- per account (the email typed), which an attacker cannot dodge by changing
  address or headers: it is what protects one known account, such as the
  Admin's, from being guessed;
- per client address, which slows one machine trying many accounts. The
  address comes from X-Forwarded-For behind Render's proxy, so it is a
  best effort; the per-account limit is the one that holds.

Counts live in the "throttle" cache (settings.CACHES), a database table
shared by every gunicorn worker so each attempt is counted once.
"""

from django.core.cache import caches
from rest_framework.throttling import SimpleRateThrottle


class _LoginThrottle(SimpleRateThrottle):
    @property
    def cache(self):
        return caches["throttle"]


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

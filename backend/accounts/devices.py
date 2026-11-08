"""
New-device sign-in check.

A correct password is not enough on a browser the account has never used:
the account's email is sent a 6-digit code (accounts.verification, purpose
"login") and the sign-in finishes only once it is typed back. That browser is
then trusted for TRUST_DAYS, so day-to-day sign-ins on the farmer's own phone
never ask for a code. A stolen password alone therefore cannot open the
account from somewhere else.

Between the password step and the code step the browser holds a signed
"challenge": proof that the password was right a moment ago. Only that
challenge plus the emailed code finish the sign-in, so someone who can read
the inbox but does not know the password gets nowhere.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.core import signing
from django.utils import timezone

from .models import TrustedDevice, User

TRUST_DAYS = 30
# Most devices a single account keeps trusted; the oldest go first.
MAX_DEVICES_PER_USER = 10
# How long a password-checked sign-in waits for its code, resends included.
CHALLENGE_MAX_AGE = timedelta(minutes=30)
_CHALLENGE_SALT = "bulantanom.accounts.login-challenge"


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _password_fingerprint(user) -> str:
    # Changes whenever the password does, so a password reset also cancels
    # every sign-in still waiting for its code.
    return hashlib.sha256(user.password.encode()).hexdigest()[:16]


def device_label(request) -> str:
    """A rough, human name for the browser, e.g. "Safari on iPhone"."""
    agent = request.headers.get("User-Agent", "")
    if "iPhone" in agent:
        system = "iPhone"
    elif "iPad" in agent:
        system = "iPad"
    elif "Android" in agent:
        system = "Android"
    elif "Windows" in agent:
        system = "Windows"
    elif "Mac OS" in agent:
        system = "Mac"
    elif "Linux" in agent:
        system = "Linux"
    else:
        system = "an unknown device"

    if "Edg/" in agent:
        browser = "Edge"
    elif "CriOS" in agent or "Chrome/" in agent:
        browser = "Chrome"
    elif "FxiOS" in agent or "Firefox/" in agent:
        browser = "Firefox"
    elif "Safari/" in agent:
        browser = "Safari"
    else:
        browser = "A browser"
    return f"{browser} on {system}"


def is_trusted(request, user) -> bool:
    """True when this browser proved itself for `user` and the trust is still live."""
    token = request.COOKIES.get(settings.DEVICE_COOKIE_NAME)
    if not token:
        return False
    now = timezone.now()
    updated = TrustedDevice.objects.filter(
        user=user, token_hash=_token_hash(token), expires_at__gt=now
    ).update(last_used_at=now)
    return updated > 0


def trust_device(request, response, user) -> None:
    """Remembers this browser for `user` and sets its cookie on `response`."""
    now = timezone.now()
    TrustedDevice.objects.filter(user=user, expires_at__lte=now).delete()
    stale = TrustedDevice.objects.filter(user=user).order_by("-last_used_at")[
        MAX_DEVICES_PER_USER - 1 :
    ]
    TrustedDevice.objects.filter(pk__in=list(stale.values_list("pk", flat=True))).delete()

    token = secrets.token_urlsafe(32)
    TrustedDevice.objects.create(
        user=user,
        token_hash=_token_hash(token),
        label=device_label(request),
        created_at=now,
        last_used_at=now,
        expires_at=now + timedelta(days=TRUST_DAYS),
    )
    response.set_cookie(
        key=settings.DEVICE_COOKIE_NAME,
        value=token,
        max_age=TRUST_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path=settings.REFRESH_COOKIE_PATH,
    )


def forget_devices(user) -> None:
    """Every browser must prove itself again (after a password change)."""
    TrustedDevice.objects.filter(user=user).delete()


def make_challenge(user) -> str:
    return signing.dumps(
        {"u": user.pk, "r": user.role, "p": _password_fingerprint(user)},
        salt=_CHALLENGE_SALT,
    )


def read_challenge(challenge: str):
    """The user a still-valid challenge belongs to, or None."""
    try:
        data = signing.loads(
            challenge, salt=_CHALLENGE_SALT, max_age=CHALLENGE_MAX_AGE.total_seconds()
        )
        user = User.objects.get(pk=data["u"])
    except (signing.BadSignature, User.DoesNotExist, KeyError, TypeError):
        return None
    if user.role != data.get("r") or _password_fingerprint(user) != data.get("p"):
        return None
    return user

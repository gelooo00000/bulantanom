"""
One-time email codes that prove someone reads a Farmer's inbox.

Sign-up creates the account unverified and emails a 6-digit code; the
account cannot sign in until that code is typed back. An address nobody
reads never gets the code, so its account can never be used. A forgotten
password is proved the same way, with the same row: either code shows the
same thing, so only the wording of the email differs.

* The code is never stored, only an HMAC of it keyed with SECRET_KEY, so a
  database dump does not reveal live codes.
* It works once, for CODE_TTL, and for at most MAX_ATTEMPTS wrong guesses;
  a new code replaces the old one.
* Unlike the lifecycle emails in notifications.emails, this one is sent
  synchronously: the farmer is waiting for it, so a failed send must be
  reported to them, not queued and logged.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.cache import caches
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone

from notifications.emails import _brand_context

from .models import EmailVerification

logger = logging.getLogger(__name__)

CODE_TTL = timedelta(minutes=10)
MAX_ATTEMPTS = 5
RESEND_COOLDOWN = timedelta(seconds=60)

# What each kind of code says: the email's subject and its template.
PURPOSES = {
    "signup": ("{code} is your BulanTanom verification code", "verification_code"),
    "reset": ("{code} is your BulanTanom password reset code", "password_reset_code"),
    "login": ("{code} is your BulanTanom sign-in code", "login_code"),
}


class CodeSendFailed(Exception):
    """The mail server refused or could not be reached."""


class ResendTooSoon(Exception):
    def __init__(self, wait_seconds: int):
        super().__init__(wait_seconds)
        self.wait_seconds = wait_seconds


def _hash(user, code: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode(), f"{user.pk}:{code}".encode(), hashlib.sha256
    ).hexdigest()


def seconds_until_resend(user) -> int:
    """0 when a new code may be sent now."""
    row = EmailVerification.objects.filter(user=user).first()
    if row is None:
        return 0
    remaining = (row.sent_at + RESEND_COOLDOWN - timezone.now()).total_seconds()
    return max(0, int(-(-remaining // 1)))


def _within_daily_budget() -> bool:
    """
    Counts this send against settings.EMAIL_CODES_PER_DAY. The count is
    approximate under concurrent sends, which is fine for a safety limit.
    """
    throttle_cache = caches["throttle"]
    key = f"email_codes_{timezone.localdate():%Y%m%d}"
    throttle_cache.add(key, 0, timeout=2 * 24 * 60 * 60)
    try:
        return throttle_cache.incr(key) <= settings.EMAIL_CODES_PER_DAY
    except ValueError:  # The test cache keeps nothing, so nothing to count.
        return True


def send_code(user, *, enforce_cooldown: bool = True, purpose: str = "signup") -> None:
    """
    Emails `user` a fresh code, replacing any earlier one. Raises
    ResendTooSoon inside the cooldown and CodeSendFailed if the email could
    not be handed to the mail server or the day's budget is spent.
    """
    if enforce_cooldown:
        wait = seconds_until_resend(user)
        if wait:
            raise ResendTooSoon(wait)

    if not _within_daily_budget():
        logger.error("Daily email code budget of %s is spent.", settings.EMAIL_CODES_PER_DAY)
        raise CodeSendFailed

    subject, template = PURPOSES[purpose]
    code = f"{secrets.randbelow(1_000_000):06d}"
    now = timezone.now()
    EmailVerification.objects.update_or_create(
        user=user,
        defaults={
            "code_hash": _hash(user, code),
            "sent_at": now,
            "expires_at": now + CODE_TTL,
            "attempts": 0,
            "purpose": purpose,
        },
    )

    context = {
        "name": user.get_full_name() or user.email,
        "code": code,
        "minutes": int(CODE_TTL.total_seconds() // 60),
        **_brand_context(),
    }
    try:
        message = EmailMultiAlternatives(
            subject=subject.format(code=code),
            body=render_to_string(f"emails/{template}.txt", context),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email],
        )
        message.attach_alternative(
            render_to_string(f"emails/{template}.html", context), "text/html"
        )
        message.send(fail_silently=False)
    except Exception as exc:
        # The code never left, so it must not block a retry with a cooldown.
        EmailVerification.objects.filter(user=user).delete()
        logger.warning(
            "Verification code to user %s failed: %s: %s", user.pk, type(exc).__name__, exc
        )
        raise CodeSendFailed from exc


def check_code(user, code: str, purpose: str = "signup") -> str:
    """
    "ok" (and the account is now verified), "invalid", "expired" or
    "locked" (too many wrong guesses; a new code is needed).

    A code only works for the purpose it was sent for: a password reset code
    typed into the new-device step is treated as no code at all.
    """
    row = EmailVerification.objects.filter(user=user).first()
    if row is None or row.purpose != purpose:
        return "expired"
    if row.attempts >= MAX_ATTEMPTS:
        return "locked"
    if timezone.now() >= row.expires_at:
        return "expired"

    cleaned = "".join(ch for ch in str(code) if ch.isdigit())
    if not hmac.compare_digest(row.code_hash, _hash(user, cleaned)):
        row.attempts += 1
        row.save(update_fields=["attempts"])
        return "locked" if row.attempts >= MAX_ATTEMPTS else "invalid"

    row.delete()
    user.email_verified = True
    user.pending_signup = False
    user.save(update_fields=["email_verified", "pending_signup", "updated_at"])
    return "ok"

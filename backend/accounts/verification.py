"""
One-time email codes that prove a new Farmer's address is real.

Sign-up creates the account unverified and emails a 6-digit code; the
account cannot sign in until that code is typed back. An address nobody
reads never gets the code, so its account can never be used.

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
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone

from notifications.emails import _brand_context

from .models import EmailVerification

logger = logging.getLogger(__name__)

CODE_TTL = timedelta(minutes=10)
MAX_ATTEMPTS = 5
RESEND_COOLDOWN = timedelta(seconds=60)


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


def send_code(user, *, enforce_cooldown: bool = True) -> None:
    """
    Emails `user` a fresh code, replacing any earlier one. Raises
    ResendTooSoon inside the cooldown and CodeSendFailed if the email could
    not be handed to the mail server.
    """
    if enforce_cooldown:
        wait = seconds_until_resend(user)
        if wait:
            raise ResendTooSoon(wait)

    code = f"{secrets.randbelow(1_000_000):06d}"
    now = timezone.now()
    EmailVerification.objects.update_or_create(
        user=user,
        defaults={
            "code_hash": _hash(user, code),
            "sent_at": now,
            "expires_at": now + CODE_TTL,
            "attempts": 0,
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
            subject=f"{code} is your BulanTanom verification code",
            body=render_to_string("emails/verification_code.txt", context),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email],
        )
        message.attach_alternative(
            render_to_string("emails/verification_code.html", context), "text/html"
        )
        message.send(fail_silently=False)
    except Exception as exc:
        # The code never left, so it must not block a retry with a cooldown.
        EmailVerification.objects.filter(user=user).delete()
        logger.warning(
            "Verification code to user %s failed: %s: %s", user.pk, type(exc).__name__, exc
        )
        raise CodeSendFailed from exc


def check_code(user, code: str) -> str:
    """
    "ok" (and the account is now verified), "invalid", "expired" or
    "locked" (too many wrong guesses; a new code is needed).
    """
    row = EmailVerification.objects.filter(user=user).first()
    if row is None:
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
    user.save(update_fields=["email_verified", "updated_at"])
    return "ok"

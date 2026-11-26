"""
Farmer accounts made by an Admin, finished by the Farmer.

Farmers no longer register themselves. An Admin types the Farmer's name and
email; the account is created with no usable password and the Farmer is
emailed a "Set your password" link. The link opens BulanTanom's
/set-password page, where the Farmer chooses a password; it is hashed into
the account and from then on the Farmer signs in with email and password.

* The link carries a Django password-reset style token. It is built from the
  account's password hash, so it stops working the moment a password is
  set, and it expires after settings.PASSWORD_RESET_TIMEOUT.
* Its salt is our own, so a token made here is useless anywhere else Django
  checks tokens, and the reverse.
* Like the sign-in codes, the email is sent synchronously: the Admin is
  waiting, and an invite that never left must be reported, not logged.
"""

from __future__ import annotations

import logging

from django.conf import settings
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from notifications.emails import _brand_context

from .models import User, UserRole

logger = logging.getLogger(__name__)


class FarmerInviteTokenGenerator(PasswordResetTokenGenerator):
    key_salt = "bulantanom.accounts.invites.FarmerInviteTokenGenerator"


invite_tokens = FarmerInviteTokenGenerator()


class InviteSendFailed(Exception):
    """The mail server refused or could not be reached."""


def awaiting_password(user) -> bool:
    """A Farmer the Admin created who has not chosen a password yet."""
    return user.role == UserRole.FARMER and not user.has_usable_password()


def invite_link(user) -> str:
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = invite_tokens.make_token(user)
    return f"{settings.FRONTEND_URL}/set-password?uid={uid}&token={token}"


def invited_farmer(uid: str, token: str):
    """The Farmer this link was made for, or None if it is wrong or used up."""
    try:
        pk = int(force_str(urlsafe_base64_decode(uid or "")))
    except (TypeError, ValueError, OverflowError, UnicodeDecodeError):
        return None
    user = User.objects.filter(pk=pk, role=UserRole.FARMER).first()
    if user is None or not awaiting_password(user):
        return None
    if not invite_tokens.check_token(user, token or ""):
        return None
    return user


def send_invite(user) -> None:
    """
    Emails `user` a fresh set-password link. Raises InviteSendFailed if it
    could not be handed to the mail server.
    """
    days = max(1, settings.PASSWORD_RESET_TIMEOUT // (24 * 60 * 60))
    context = {
        "name": user.get_full_name() or user.email,
        "first_name": user.first_name,
        "email": user.email,
        "set_password_url": invite_link(user),
        "days": days,
        **_brand_context(),
    }
    try:
        message = EmailMultiAlternatives(
            subject="Set your BulanTanom password - your Farmer account is ready",
            body=render_to_string("emails/farmer_invite.txt", context),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email],
        )
        message.attach_alternative(
            render_to_string("emails/farmer_invite.html", context), "text/html"
        )
        message.send(fail_silently=False)
    except Exception as exc:
        logger.warning(
            "Farmer invite to user %s failed: %s: %s", user.pk, type(exc).__name__, exc
        )
        raise InviteSendFailed from exc

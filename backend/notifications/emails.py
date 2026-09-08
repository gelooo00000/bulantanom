"""
Account-lifecycle emails.

Scope is deliberately narrow: BulanTanom emails a person only when their
account changes state — approved, rejected, suspended, reactivated, or newly
provisioned. There is no login alert, no digest, no marketing.

Three rules hold everywhere in this module:

* An email never affects the database transaction that caused it. Sending is
  queued with `transaction.on_commit`, so a rolled-back approval emails
  nobody, and a failed send cannot undo a committed approval.
* A failure is recorded, not raised. The Admin sees their action succeed
  (because it did); the failure is logged as FAILED with its error for retry.
* A password never appears in an email. These messages announce that an
  account exists or changed; credentials are delivered out of band.
"""

from __future__ import annotations

import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import IntegrityError, transaction
from django.template.loader import render_to_string
from django.utils import timezone

from .models import EmailLog, EmailStatus

logger = logging.getLogger(__name__)


# What each role can reach once active. Kept here so the email and the app
# describe the same product.
FARMER_FEATURES = [
    "My Plants",
    "Risk Indicator",
    "Weekly Assessments",
    "Soil Recommendation",
    "Monitoring",
    "Notifications",
]

OFFICER_FEATURES = [
    "Farmer records and plant monitoring",
    "Risk assessments and high-risk cases",
    "Weekly assessment history and evidence",
    "Soil recommendation records",
    "Harvest windows across the farm",
]


def login_url() -> str:
    """Absolute login link. Never hardcoded — production needs a real host."""
    return f"{settings.FRONTEND_URL}/login"


def _send(*, recipient, event_key, subject, template, context) -> bool:
    """
    Sends one lifecycle email at most once per recipient per event.

    The unique constraint on (recipient, event_key) is the duplicate guard:
    a second attempt for the same transition finds the row already present
    and returns without sending. That makes repeated Admin clicks, page
    refreshes and component remounts all harmless without a single frontend
    flag.

    Returns True only if this call actually delivered a message.
    """
    to_email = (recipient.email or "").strip()
    if not to_email:
        logger.warning("No email address for user %s; skipping %s.", recipient.pk, event_key)
        return False

    # Claim the event first. If the row exists, this event was already
    # handled — including a previous FAILED attempt, which is left for the
    # retry command rather than resent implicitly here.
    try:
        with transaction.atomic():
            log = EmailLog.objects.create(
                recipient=recipient,
                event_key=event_key,
                subject=subject,
                to_email=to_email,
                status=EmailStatus.FAILED,
                attempts=1,
            )
    except IntegrityError:
        logger.info("Email %s already handled for user %s.", event_key, recipient.pk)
        return False

    full_context = {
        "name": recipient.get_full_name() or recipient.email,
        "login_url": login_url(),
        "site_name": "BulanTanom",
        **context,
    }

    try:
        text_body = render_to_string(f"emails/{template}.txt", full_context)
        html_body = render_to_string(f"emails/{template}.html", full_context)

        message = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[to_email],
        )
        message.attach_alternative(html_body, "text/html")
        message.send(fail_silently=False)
    except Exception as exc:
        # Never re-raise: the account change already committed and is
        # correct. Log the reason so it can be retried, and never show an
        # SMTP error to a user.
        log.error = f"{type(exc).__name__}: {exc}"[:2000]
        log.save(update_fields=["error"])
        logger.warning(
            "Lifecycle email %s to user %s failed: %s: %s",
            event_key, recipient.pk, type(exc).__name__, exc,
        )
        return False

    log.status = EmailStatus.SENT
    log.sent_at = timezone.now()
    log.error = ""
    log.save(update_fields=["status", "sent_at", "error"])
    return True


def _queue(fn):
    """Run after commit, so a rolled-back transaction emails nobody."""
    transaction.on_commit(fn)


# ---------------------------------------------------------------------------
# Farmer lifecycle
# ---------------------------------------------------------------------------


def email_farmer_approved(farmer):
    _queue(
        lambda: _send(
            recipient=farmer,
            event_key="account_approved",
            subject="Your BulanTanom Farmer Account Has Been Approved 🌱",
            template="account_approved",
            context={"role_label": "Farmer", "features": FARMER_FEATURES},
        )
    )


def email_farmer_rejected(farmer):
    _queue(
        lambda: _send(
            recipient=farmer,
            event_key="account_rejected",
            subject="Update on Your BulanTanom Registration",
            template="account_rejected",
            context={"role_label": "Farmer"},
        )
    )


def email_account_suspended(user):
    role_label = "LGU Officer" if user.role == "LGU_OFFICER" else "Farmer"
    subject = (
        "Your BulanTanom LGU Officer Account Has Been Suspended"
        if user.role == "LGU_OFFICER"
        else "Your BulanTanom Account Has Been Suspended"
    )
    _queue(
        lambda: _send(
            recipient=user,
            event_key="account_suspended",
            subject=subject,
            template="account_suspended",
            context={"role_label": role_label},
        )
    )


def email_account_reactivated(user):
    is_officer = user.role == "LGU_OFFICER"
    subject = (
        "Your BulanTanom LGU Officer Account Has Been Reactivated"
        if is_officer
        else "Your BulanTanom Account Has Been Reactivated"
    )
    _queue(
        lambda: _send(
            recipient=user,
            event_key="account_reactivated",
            subject=subject,
            template="account_reactivated",
            context={
                "role_label": "LGU Officer" if is_officer else "Farmer",
                "features": OFFICER_FEATURES if is_officer else FARMER_FEATURES,
            },
        )
    )


# ---------------------------------------------------------------------------
# LGU Officer provisioning
# ---------------------------------------------------------------------------


def email_officer_welcome(officer):
    """
    Officers have no registration path, so this is the only signal an account
    now exists for them. It deliberately does not carry the password the
    Admin chose — that is delivered out of band.
    """
    _queue(
        lambda: _send(
            recipient=officer,
            event_key="officer_welcome",
            subject="Welcome to BulanTanom — LGU Officer Account Created",
            template="officer_welcome",
            context={"role_label": "LGU Officer", "features": OFFICER_FEATURES},
        )
    )

"""
One notification model for every BulanTanom role.

A notification always belongs to exactly one recipient — there is no
broadcast row and no per-role table. Farmer-facing and LGU-facing messages
about the same event are separate rows with different recipients and
different wording, which is what keeps a Farmer from ever reading an
operational message about another Farmer.
"""

from django.conf import settings
from django.db import models
from django.utils import timezone


class NotificationType(models.TextChoices):
    """
    Only events the backend actually performs.

    Deliberately absent:
    * MONITORING_UPDATE — monitoring is a derived view over assessments;
      there is no monitoring record to create or update.
    * ASSESSMENT_STARTED — opening the form is not a state change, and
      notifying on it would fire on every page visit.
    """

    ACCOUNT_CREATED = "ACCOUNT_CREATED", "Account created"
    ACCOUNT_APPROVED = "ACCOUNT_APPROVED", "Account approved"
    ACCOUNT_REJECTED = "ACCOUNT_REJECTED", "Account rejected"
    ACCOUNT_SUSPENDED = "ACCOUNT_SUSPENDED", "Account suspended"
    ACCOUNT_DELETED = "ACCOUNT_DELETED", "Account deleted"

    PLANT_ADDED = "PLANT_ADDED", "Plant added"
    PLANT_UPDATED = "PLANT_UPDATED", "Plant updated"

    ASSESSMENT_SUBMITTED = "ASSESSMENT_SUBMITTED", "Assessment submitted"
    ASSESSMENT_COMPLETED = "ASSESSMENT_COMPLETED", "Assessment completed"
    ASSESSMENT_LOCKED = "ASSESSMENT_LOCKED", "Assessment locked"

    EVIDENCE_UPLOADED = "EVIDENCE_UPLOADED", "Evidence uploaded"
    EVIDENCE_ACCEPTED = "EVIDENCE_ACCEPTED", "Evidence accepted"
    EVIDENCE_REJECTED = "EVIDENCE_REJECTED", "Evidence rejected"

    AI_EVALUATION_COMPLETED = "AI_EVALUATION_COMPLETED", "AI evaluation completed"
    RISK_LOW = "RISK_LOW", "Low risk"
    RISK_MEDIUM = "RISK_MEDIUM", "Medium risk"
    RISK_HIGH = "RISK_HIGH", "High risk"
    RISK_CHANGED = "RISK_CHANGED", "Risk level changed"

    SOIL_RECOMMENDATION_READY = (
        "SOIL_RECOMMENDATION_READY",
        "Soil recommendation ready",
    )
    SOIL_ASSESSMENT_SAVED = "SOIL_ASSESSMENT_SAVED", "Soil assessment saved"
    SOIL_WARNING = "SOIL_WARNING", "Soil warning"

    HARVEST_APPROACHING = "HARVEST_APPROACHING", "Harvest approaching"
    HARVEST_READY = "HARVEST_READY", "Harvest ready"

    SYSTEM = "SYSTEM", "System"


class NotificationSeverity(models.TextChoices):
    """How prominently the UI should present a notification."""

    INFO = "info", "Info"
    SUCCESS = "success", "Success"
    WARNING = "warning", "Warning"
    CRITICAL = "critical", "Critical"


class RelatedType(models.TextChoices):
    """What the notification points at, so the UI can build a route."""

    NONE = "", "None"
    PLANT = "plant", "Plant"
    ASSESSMENT = "assessment", "Assessment"
    FARMER = "farmer", "Farmer"


class Notification(models.Model):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    notification_type = models.CharField(max_length=32, choices=NotificationType.choices)
    severity = models.CharField(
        max_length=16,
        choices=NotificationSeverity.choices,
        default=NotificationSeverity.INFO,
    )

    title = models.CharField(max_length=150)
    message = models.TextField()

    # What this is about. Stored as a type + id rather than a frontend URL so
    # the route can change without rewriting history in the database.
    related_type = models.CharField(
        max_length=32, choices=RelatedType.choices, blank=True, default=""
    )
    related_id = models.PositiveIntegerField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    # Identifies the underlying event. A second attempt to notify about the
    # same event for the same recipient is a no-op, so refreshing a page or
    # re-opening a record can never produce a duplicate.
    #
    # Always populated — the service generates a unique key for notifications
    # that are not deduplicated. That lets the uniqueness be a plain DB
    # constraint: MySQL silently ignores *conditional* unique constraints, so
    # a `condition=~Q(dedupe_key="")` version would not actually exist in the
    # database and two concurrent requests could both insert.
    dedupe_key = models.CharField(max_length=190)

    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            # The two queries this table serves: "my newest notifications"
            # and "how many of mine are unread".
            models.Index(fields=["recipient", "-created_at"]),
            models.Index(fields=["recipient", "is_read"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["recipient", "dedupe_key"],
                name="unique_notification_event_per_recipient",
            )
        ]

    def __str__(self):
        return f"{self.recipient_id}: {self.title}"

    def mark_read(self):
        if self.is_read:
            return False
        self.is_read = True
        self.read_at = timezone.now()
        self.save(update_fields=["is_read", "read_at"])
        return True


class EmailStatus(models.TextChoices):
    SENT = "SENT", "Sent"
    FAILED = "FAILED", "Failed"


class EmailLog(models.Model):
    """
    One row per account-lifecycle email the system has attempted.

    Exists for three reasons the in-app Notification table cannot serve:

    * Duplicate protection at the database level. `event_key` identifies the
      transition ("approved", "suspended"), and the unique constraint with
      `recipient` means a second attempt for the same event cannot send a
      second email — no frontend flag involved.
    * Honest status. A failed send is recorded as FAILED with its error, so
      the system never reports "email sent" for something that did not go
      out.
    * Retry. A FAILED row carries everything needed to resend, without
      guessing which accounts missed their notice.

    Deliberately never stores the message body, because these emails are
    about credentials-adjacent events and the body is reproducible from the
    template.
    """

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="email_logs",
    )
    # The lifecycle transition this email reports, e.g. "account_approved".
    event_key = models.CharField(max_length=190)
    subject = models.CharField(max_length=255)
    to_email = models.EmailField()

    status = models.CharField(max_length=16, choices=EmailStatus.choices)
    error = models.TextField(blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)

    created_at = models.DateTimeField(default=timezone.now)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["recipient", "-created_at"]),
            models.Index(fields=["status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["recipient", "event_key"],
                name="unique_account_email_per_recipient_event",
            )
        ]

    def __str__(self):
        return f"{self.event_key} -> {self.to_email} ({self.status})"

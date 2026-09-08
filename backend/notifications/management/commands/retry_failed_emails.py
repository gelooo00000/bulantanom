"""
Resends account-lifecycle emails that previously failed.

A failed send is recorded as FAILED rather than retried inline, because the
account change had already committed and the Admin's request must not hang on
SMTP. This command is the deliberate retry path.
"""

from django.core.management.base import BaseCommand

from notifications.emails import _send
from notifications.models import EmailLog, EmailStatus

# event_key -> (template, context builder). Kept explicit so a retry cannot
# silently send a different message than the original attempt.
TEMPLATES = {
    "account_approved": "account_approved",
    "account_rejected": "account_rejected",
    "account_suspended": "account_suspended",
    "account_reactivated": "account_reactivated",
    "officer_welcome": "officer_welcome",
}


class Command(BaseCommand):
    help = "Retry account-lifecycle emails recorded as FAILED."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List what would be retried without sending anything.",
        )

    def handle(self, *args, **options):
        from notifications.emails import FARMER_FEATURES, OFFICER_FEATURES

        failed = EmailLog.objects.filter(status=EmailStatus.FAILED).select_related(
            "recipient"
        )
        if not failed.exists():
            self.stdout.write("No failed emails to retry.")
            return

        sent = 0
        for log in failed:
            template = TEMPLATES.get(log.event_key)
            if template is None:
                self.stdout.write(f"  skipping unknown event {log.event_key!r}")
                continue

            if options["dry_run"]:
                self.stdout.write(f"  [dry run] would retry {log.event_key} -> {log.to_email}")
                continue

            is_officer = log.recipient.role == "LGU_OFFICER"
            # Delete the claim row so `_send` can re-create it; the unique
            # constraint is what makes the original attempt idempotent.
            recipient, event_key, subject = log.recipient, log.event_key, log.subject
            log.delete()

            if _send(
                recipient=recipient,
                event_key=event_key,
                subject=subject,
                template=template,
                context={
                    "role_label": "LGU Officer" if is_officer else "Farmer",
                    "features": OFFICER_FEATURES if is_officer else FARMER_FEATURES,
                },
            ):
                sent += 1
                self.stdout.write(f"  resent {event_key} -> {recipient.email}")
            else:
                self.stdout.write(f"  still failing: {event_key} -> {recipient.email}")

        if not options["dry_run"]:
            self.stdout.write(self.style.SUCCESS(f"Retried {failed.count()}, sent {sent}."))

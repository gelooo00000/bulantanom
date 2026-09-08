"""
Reports the active email configuration and optionally sends one test message.

Account emails failing is almost never a bug in the lifecycle code - that path
is covered by tests. It is nearly always configuration: no EMAIL_HOST, so
Django silently selects the console backend and every message is printed to the
runserver output instead of being delivered.

This command makes that state visible before anyone goes looking for a code
fault, and turns an SMTP failure into a named cause rather than a stack trace.

    python manage.py check_email_config
    python manage.py check_email_config --to someone@example.com

Secrets are never printed - credentials are reported only as configured/not set,
and provider errors are scrubbed of the account address before display.
"""

import smtplib
import socket
import ssl

from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.core.management.base import BaseCommand

CONSOLE_BACKEND = "django.core.mail.backends.console.EmailBackend"


def _state(value):
    """Never reveal a secret - only whether one is present."""
    return "configured" if value else "NOT SET"


def _redact(text):
    """Strip the SMTP account address out of a provider error before display."""
    message = str(text)
    for secret in (settings.EMAIL_HOST_USER, settings.EMAIL_HOST_PASSWORD):
        if secret:
            message = message.replace(secret, "<redacted>")
    return message[:500]


def _classify(exc):
    """Map an exception to the actual cause, so the fix is unambiguous."""
    if isinstance(exc, smtplib.SMTPAuthenticationError):
        return (
            "SMTP AUTHENTICATION FAILED",
            "EMAIL_HOST_USER / EMAIL_HOST_PASSWORD were rejected. For Gmail the "
            "password must be a 16-character App Password (2-Step Verification "
            "must be enabled first) - a normal account password always fails here.",
        )
    if isinstance(exc, smtplib.SMTPSenderRefused):
        return (
            "SENDER REFUSED",
            "The provider will not send as DEFAULT_FROM_EMAIL. Use an address the "
            "authenticated account owns.",
        )
    if isinstance(exc, smtplib.SMTPRecipientsRefused):
        return ("RECIPIENT REFUSED", "The provider rejected the destination address.")
    if isinstance(exc, ssl.SSLError):
        return (
            "TLS/SSL PROBLEM",
            "Port and encryption disagree. Use port 587 with EMAIL_USE_TLS=True, "
            "or port 465 with EMAIL_USE_SSL=True.",
        )
    if isinstance(exc, socket.timeout):
        return (
            "CONNECTION TIMEOUT",
            "The SMTP host did not answer within EMAIL_TIMEOUT_SECONDS. A firewall "
            "or network policy commonly blocks outbound 587/465.",
        )
    if isinstance(exc, socket.gaierror):
        return ("DNS PROBLEM", "EMAIL_HOST could not be resolved. Check the hostname.")
    if isinstance(exc, ConnectionRefusedError):
        return ("CONNECTION REFUSED", "Nothing is accepting SMTP on that host and port.")
    return (f"{type(exc).__name__}", "See the message above.")


class Command(BaseCommand):
    help = "Report the active email configuration and optionally send a test message."

    def add_arguments(self, parser):
        parser.add_argument(
            "--to",
            help="Send one test message to this address using the configured backend.",
        )

    def handle(self, *args, **options):
        using_console = settings.EMAIL_BACKEND == CONSOLE_BACKEND

        self.stdout.write("Email configuration")
        self.stdout.write("-" * 60)
        for label, value in (
            ("EMAIL_BACKEND", settings.EMAIL_BACKEND),
            ("EMAIL_HOST", _state(settings.EMAIL_HOST)),
            ("EMAIL_PORT", settings.EMAIL_PORT),
            ("EMAIL_HOST_USER", _state(settings.EMAIL_HOST_USER)),
            ("EMAIL_HOST_PASSWORD", _state(settings.EMAIL_HOST_PASSWORD)),
            ("EMAIL_USE_TLS", settings.EMAIL_USE_TLS),
            ("EMAIL_USE_SSL", settings.EMAIL_USE_SSL),
            ("EMAIL_TIMEOUT", settings.EMAIL_TIMEOUT),
            ("DEFAULT_FROM_EMAIL", settings.DEFAULT_FROM_EMAIL),
            ("FRONTEND_URL", settings.FRONTEND_URL),
        ):
            self.stdout.write(f"  {label:<20} {value}")

        self.stdout.write("")
        if using_console:
            self.stdout.write(
                self.style.WARNING(
                    "CONSOLE BACKEND ACTIVE - messages are printed to the server "
                    "output and reach NO inbox."
                )
            )
            self.stdout.write(
                "  Cause: EMAIL_HOST is empty. Set the EMAIL_* values in backend/.env "
                "(see backend/.env.example) and restart Django."
            )
        else:
            self.stdout.write(self.style.SUCCESS("SMTP backend active."))

        recipient = options.get("to")
        if not recipient:
            self.stdout.write("")
            self.stdout.write("Pass --to <address> to send a test message.")
            return

        self.stdout.write("")
        self.stdout.write(f"Sending test message to {recipient} ...")
        message = EmailMultiAlternatives(
            subject="BulanTanom email configuration test",
            body=(
                "This is a configuration test from BulanTanom.\n\n"
                "If you are reading this in a real inbox, SMTP delivery works.\n"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient],
            connection=get_connection(fail_silently=False),
        )

        try:
            delivered = message.send(fail_silently=False)
        except Exception as exc:  # noqa: BLE001 - every failure is reported, not raised
            cause, guidance = _classify(exc)
            self.stdout.write("")
            self.stdout.write(self.style.ERROR(f"FAILED: {cause}"))
            self.stdout.write(f"  {guidance}")
            self.stdout.write(f"  Provider said: {_redact(exc)}")
            return

        self.stdout.write("")
        if using_console:
            self.stdout.write(
                self.style.WARNING(
                    f"send() returned {delivered}, but the CONSOLE backend only printed "
                    "the message above. Nothing was delivered."
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"send() returned {delivered} - the SMTP server ACCEPTED the message."
                )
            )
            self.stdout.write(
                "  Accepted is not the same as delivered. Confirm it arrived, and "
                "check the spam folder."
            )

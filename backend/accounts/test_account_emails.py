"""
Account-lifecycle email tests.

Django's locmem backend captures messages in `mail.outbox`, so these assert
on real rendered emails — subject, recipient and body — not on mocks.

The properties that matter most here are the negative ones: an email is never
sent for an event that did not happen, never sent twice for the same
transition, never contains a password, and never affects the database change
that triggered it.
"""

import smtplib
from io import StringIO
from unittest.mock import patch

from django.conf import settings
from django.core import mail
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITransactionTestCase

from notifications.models import EmailLog, EmailStatus, Notification

from .models import AccountStatus, User, UserRole

SIGNUP_URL = "/api/auth/farmer/signup/"
CREATE_OFFICER_URL = "/api/admin/lgu-officers/"
FARMER_LOGIN_URL = "/api/auth/farmer/login/"
LGU_LOGIN_URL = "/api/auth/lgu/login/"
ADMIN_LOGIN_URL = "/api/auth/admin/login/"
PW = "SecurePassword123!"


def make_user(email, role=UserRole.FARMER, status_=AccountStatus.APPROVED):
    return User.objects.create_user(
        email=email, password=PW, first_name="Test", last_name="User",
        role=role, account_status=status_,
    )


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="https://bulantanom.example",
    DEFAULT_FROM_EMAIL="BulanTanom <no-reply@bulantanom.example>",
)
class AccountEmailTests(APITransactionTestCase):
    """
    Transactional: emails are queued with `transaction.on_commit`, so a
    rolled-back TestCase would send nothing and every assertion would pass
    for the wrong reason.
    """

    def setUp(self):
        mail.outbox = []
        self.admin = make_user("admin@example.com", UserRole.ADMIN)
        self.farmer = make_user("farmer@example.com")
        self.pending = make_user("pending@example.com", status_=AccountStatus.PENDING)

    def auth(self, email, url=ADMIN_LOGIN_URL):
        token = self.client.post(
            url, {"email": email, "password": PW}, format="json"
        ).data["access"]
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def admin_patch(self, path):
        return self.client.patch(path, **self.auth("admin@example.com"))

    # ------------------------------------------------------- no premature mail

    def test_registration_does_not_email_the_farmer(self):
        """Approval mail must wait for the actual approval."""
        response = self.client.post(
            SIGNUP_URL,
            {
                "first_name": "New", "last_name": "Farmer",
                "email": "new@example.com", "password": PW, "password_confirm": PW,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = User.objects.get(email="new@example.com")
        self.assertEqual(created.account_status, AccountStatus.PENDING)
        self.assertEqual(
            [m for m in mail.outbox if "new@example.com" in m.to], []
        )

    def test_login_does_not_send_email(self):
        self.client.post(
            FARMER_LOGIN_URL,
            {"email": "farmer@example.com", "password": PW},
            format="json",
        )
        self.assertEqual(mail.outbox, [])

    # ------------------------------------------------------------- approval

    def test_approval_sends_the_farmer_an_email(self):
        self.admin_patch(f"/api/admin/farmers/{self.pending.id}/approve/")

        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ["pending@example.com"])
        self.assertIn("Approved", message.subject)
        self.assertIn("Test User", message.body)
        self.assertIn("My Plants", message.body)
        self.assertIn("https://bulantanom.example/login", message.body)

    def test_approval_also_updates_status_and_in_app_notification(self):
        """Email, database and in-app notice describe one real event."""
        self.admin_patch(f"/api/admin/farmers/{self.pending.id}/approve/")

        self.pending.refresh_from_db()
        self.assertEqual(self.pending.account_status, AccountStatus.APPROVED)
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.pending, notification_type="ACCOUNT_APPROVED"
            ).exists()
        )
        self.assertEqual(len(mail.outbox), 1)

    def test_approval_email_is_sent_once_even_if_retried(self):
        """A second approve is refused by the state machine — and by the log."""
        self.admin_patch(f"/api/admin/farmers/{self.pending.id}/approve/")
        second = self.admin_patch(f"/api/admin/farmers/{self.pending.id}/approve/")

        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(
            EmailLog.objects.filter(
                recipient=self.pending, event_key="account_approved"
            ).count(),
            1,
        )

    def test_email_log_records_a_successful_send(self):
        self.admin_patch(f"/api/admin/farmers/{self.pending.id}/approve/")
        log = EmailLog.objects.get(recipient=self.pending, event_key="account_approved")
        self.assertEqual(log.status, EmailStatus.SENT)
        self.assertIsNotNone(log.sent_at)
        self.assertEqual(log.error, "")

    # ------------------------------------------------- rejection / suspension

    def test_rejection_sends_an_email(self):
        self.admin_patch(f"/api/admin/farmers/{self.pending.id}/reject/")
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Update on Your BulanTanom Registration", mail.outbox[0].subject)
        self.assertEqual(mail.outbox[0].to, ["pending@example.com"])

    def test_suspension_sends_an_email(self):
        self.admin_patch(f"/api/admin/farmers/{self.farmer.id}/suspend/")
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Suspended", mail.outbox[0].subject)
        self.assertIn("Suspended", mail.outbox[0].body)

    def test_reactivation_sends_an_email(self):
        self.admin_patch(f"/api/admin/farmers/{self.farmer.id}/suspend/")
        mail.outbox = []
        self.admin_patch(f"/api/admin/farmers/{self.farmer.id}/approve/")

        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Reactivated", mail.outbox[0].subject)

    def test_an_invalid_transition_sends_nothing(self):
        """Suspending a PENDING account is refused, so nobody is emailed."""
        response = self.admin_patch(f"/api/admin/farmers/{self.pending.id}/suspend/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(mail.outbox, [])

    # ------------------------------------------------------- officer welcome

    def test_creating_an_officer_sends_a_welcome_email(self):
        self.client.post(
            CREATE_OFFICER_URL,
            {
                "first_name": "Maria", "last_name": "Santos",
                "email": "maria@example.com", "password": PW,
            },
            format="json",
            **self.auth("admin@example.com"),
        )
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ["maria@example.com"])
        self.assertIn("LGU Officer Account Created", message.subject)
        self.assertIn("Maria Santos", message.body)

    def test_officer_suspension_and_reactivation_email(self):
        officer = make_user("officer@example.com", UserRole.LGU_OFFICER)

        self.admin_patch(f"/api/admin/officers/{officer.id}/suspend/")
        self.assertIn("LGU Officer Account Has Been Suspended", mail.outbox[-1].subject)

        self.admin_patch(f"/api/admin/officers/{officer.id}/reactivate/")
        self.assertIn(
            "LGU Officer Account Has Been Reactivated", mail.outbox[-1].subject
        )

    # ------------------------------------------------------------- security

    def test_no_email_contains_a_password(self):
        """The single most important property of this whole feature."""
        self.client.post(
            CREATE_OFFICER_URL,
            {
                "first_name": "Maria", "last_name": "Santos",
                "email": "maria@example.com", "password": PW,
            },
            format="json",
            **self.auth("admin@example.com"),
        )
        self.admin_patch(f"/api/admin/farmers/{self.pending.id}/approve/")
        self.admin_patch(f"/api/admin/farmers/{self.farmer.id}/suspend/")

        self.assertGreater(len(mail.outbox), 2)
        for message in mail.outbox:
            bodies = [message.body] + [body for body, _ in message.alternatives]
            for body in bodies:
                self.assertNotIn(PW, body, message.subject)
                self.assertNotIn("pbkdf2", body, message.subject)

    def test_smtp_credentials_are_never_returned_by_an_api(self):
        response = self.client.post(
            CREATE_OFFICER_URL,
            {
                "first_name": "Maria", "last_name": "Santos",
                "email": "maria@example.com", "password": PW,
            },
            format="json",
            **self.auth("admin@example.com"),
        )
        body = response.content.decode().lower()
        for leaked in ("email_host", "smtp", "email_host_password", "password"):
            self.assertNotIn(leaked, body)

    def test_non_admin_cannot_trigger_lifecycle_emails(self):
        for email, url in (
            ("farmer@example.com", FARMER_LOGIN_URL),
        ):
            response = self.client.patch(
                f"/api/admin/farmers/{self.pending.id}/approve/",
                **self.auth(email, url),
            )
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(mail.outbox, [])

    # -------------------------------------------------------- failure safety

    def test_email_failure_does_not_corrupt_the_account_change(self):
        """
        The approval already committed. A broken mail server must not undo
        it, must not surface to the Admin, and must be recorded for retry.
        """
        with patch(
            "django.core.mail.EmailMultiAlternatives.send",
            side_effect=OSError("SMTP unreachable"),
        ):
            response = self.admin_patch(
                f"/api/admin/farmers/{self.pending.id}/approve/"
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.pending.refresh_from_db()
        self.assertEqual(self.pending.account_status, AccountStatus.APPROVED)

        log = EmailLog.objects.get(recipient=self.pending, event_key="account_approved")
        self.assertEqual(log.status, EmailStatus.FAILED)
        self.assertIn("SMTP unreachable", log.error)
        self.assertIsNone(log.sent_at)

    def test_smtp_error_is_not_leaked_to_the_admin(self):
        with patch(
            "django.core.mail.EmailMultiAlternatives.send",
            side_effect=OSError("SMTP unreachable at mail.internal:587"),
        ):
            response = self.admin_patch(
                f"/api/admin/farmers/{self.pending.id}/approve/"
            )
        self.assertNotIn("SMTP", response.content.decode())
        self.assertNotIn("mail.internal", response.content.decode())

    def test_a_failed_email_can_be_retried(self):
        from django.core.management import call_command

        with patch(
            "django.core.mail.EmailMultiAlternatives.send",
            side_effect=OSError("SMTP unreachable"),
        ):
            self.admin_patch(f"/api/admin/farmers/{self.pending.id}/approve/")

        self.assertEqual(mail.outbox, [])
        call_command("retry_failed_emails")

        self.assertEqual(len(mail.outbox), 1)
        log = EmailLog.objects.get(recipient=self.pending, event_key="account_approved")
        self.assertEqual(log.status, EmailStatus.SENT)

    def test_a_user_without_an_email_address_is_skipped_safely(self):
        self.pending.email = ""
        self.pending.save(update_fields=["email"])
        response = self.admin_patch(f"/api/admin/farmers/{self.pending.id}/approve/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.pending.refresh_from_db()
        self.assertEqual(self.pending.account_status, AccountStatus.APPROVED)
        self.assertEqual(mail.outbox, [])


class EmailConfigurationTests(TestCase):
    """
    The diagnostic that explains *why* account emails are not arriving.

    Every lifecycle email above passes against the locmem backend, which is
    exactly what made the real failure hard to see: the application code was
    never at fault. With no EMAIL_HOST configured Django selects the console
    backend and prints messages to the server output, so the tests pass, the
    Admin sees success, and no inbox ever receives anything.
    """

    def run_command(self, **kwargs):
        out = StringIO()
        call_command("check_email_config", stdout=out, **kwargs)
        return out.getvalue()

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.console.EmailBackend",
        EMAIL_HOST="",
    )
    def test_console_backend_is_reported_as_reaching_no_inbox(self):
        output = self.run_command()
        self.assertIn("CONSOLE BACKEND ACTIVE", output)
        self.assertIn("NO inbox", output)
        self.assertIn("EMAIL_HOST is empty", output)

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
        EMAIL_HOST="smtp.example.com",
        EMAIL_HOST_USER="operator@example.com",
        EMAIL_HOST_PASSWORD="super-secret-app-password",
    )
    def test_credentials_are_never_printed(self):
        """The whole point of reporting 'configured' instead of the value."""
        output = self.run_command()
        self.assertNotIn("super-secret-app-password", output)
        self.assertNotIn("operator@example.com", output)
        self.assertIn("configured", output)

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
        EMAIL_HOST="smtp.example.com",
        EMAIL_HOST_USER="operator@example.com",
        EMAIL_HOST_PASSWORD="super-secret-app-password",
    )
    def test_auth_failure_is_named_and_redacted(self):
        """An SMTP 535 must become guidance, not a stack trace with the password in it."""
        failure = smtplib.SMTPAuthenticationError(
            535, b"5.7.8 Username and Password not accepted"
        )
        with patch(
            "django.core.mail.EmailMultiAlternatives.send", side_effect=failure
        ):
            output = self.run_command(to="someone@example.com")

        self.assertIn("SMTP AUTHENTICATION FAILED", output)
        self.assertIn("App Password", output)
        self.assertNotIn("super-secret-app-password", output)

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
        EMAIL_HOST="smtp.example.com",
    )
    def test_smtp_backend_does_not_claim_inbox_delivery(self):
        """Accepted by a server is not the same as delivered to a person."""
        output = self.run_command(to="someone@example.com")
        self.assertIn("ACCEPTED", output)
        self.assertIn("not the same as delivered", output)

    def test_tls_and_ssl_are_never_both_enabled(self):
        """
        Django raises ImproperlyConfigured if both are set. settings.py lets
        EMAIL_USE_SSL win so a port-465 provider is configurable at all, which
        was previously impossible - EMAIL_USE_SSL was never read from the
        environment.
        """
        self.assertFalse(settings.EMAIL_USE_TLS and settings.EMAIL_USE_SSL)

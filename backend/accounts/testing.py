"""Test helpers for the Farmer sign-up flow (sign up, then type the emailed code)."""

from django.core import mail

SIGNUP_URL = "/api/auth/farmer/signup/"
VERIFY_URL = "/api/auth/farmer/verify/"
RESEND_URL = "/api/auth/farmer/resend-code/"


def last_code(email):
    """The code in the newest verification email sent to `email`."""
    for message in reversed(mail.outbox):
        if email in message.to and "verification code" in message.subject:
            return message.subject.split()[0]
    raise AssertionError(f"No verification code was emailed to {email}.")


def signup_and_verify(client, payload):
    """Signs up and types the emailed code back; returns the verify response."""
    signup = client.post(SIGNUP_URL, payload, format="json")
    assert signup.status_code == 201, signup.content
    return client.post(
        VERIFY_URL,
        {"email": payload["email"], "code": last_code(payload["email"])},
        format="json",
    )

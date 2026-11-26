"""
Test helpers for how a Farmer account comes to exist now: an Admin creates
it, and the Farmer sets a password from the emailed invite link.
"""

import re
from urllib.parse import parse_qs, urlparse

from django.core import mail
from rest_framework.test import APIClient

CREATE_FARMER_URL = "/api/admin/farmers/"
SET_PASSWORD_URL = "/api/auth/farmer/set-password/"
VERIFY_URL = "/api/auth/farmer/verify/"
RESEND_URL = "/api/auth/farmer/resend-code/"


def last_code(email):
    """The code in the newest verification email sent to `email`."""
    for message in reversed(mail.outbox):
        if email in message.to and "verification code" in message.subject:
            return message.subject.split()[0]
    raise AssertionError(f"No verification code was emailed to {email}.")


def last_invite(email):
    """(uid, token) from the newest set-password link emailed to `email`."""
    for message in reversed(mail.outbox):
        if email in message.to and "Set your BulanTanom password" in message.subject:
            url = re.search(r"https?://\S+/set-password\?\S+", message.body).group(0)
            query = parse_qs(urlparse(url).query)
            return query["uid"][0], query["token"][0]
    raise AssertionError(f"No invite was emailed to {email}.")


def admin_client():
    from .models import AccountStatus, User, UserRole

    admin = User.objects.filter(role=UserRole.ADMIN).first() or User.objects.create_user(
        email="invite-admin@example.com",
        password="SecurePassword123!",
        first_name="Invite",
        last_name="Admin",
        role=UserRole.ADMIN,
        account_status=AccountStatus.APPROVED,
    )
    client = APIClient()
    client.force_authenticate(admin)
    return client


def create_farmer(payload):
    """An Admin creates the Farmer; returns the response."""
    fields = {k: v for k, v in payload.items() if k in ("first_name", "last_name", "email", "gender")}
    return admin_client().post(CREATE_FARMER_URL, fields, format="json")


def signup_and_verify(client, payload):
    """
    Admin creates the Farmer, then the Farmer sets `payload["password"]`
    from the invite link. Returns the set-password response.
    """
    created = create_farmer(payload)
    assert created.status_code == 201, created.content
    uid, token = last_invite(payload["email"])
    return client.post(
        SET_PASSWORD_URL,
        {
            "uid": uid,
            "token": token,
            "password": payload["password"],
            "password_confirm": payload.get("password_confirm", payload["password"]),
        },
        format="json",
    )

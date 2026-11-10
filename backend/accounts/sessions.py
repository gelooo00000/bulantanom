"""
One device per account.

Each sign-in starts a new session: a random key is stored on the user and
written into the refresh and access tokens as the "sid" claim. Signing in
on another device replaces the key, so the earlier device's tokens stop
working on its next request or refresh, and it is sent back to sign in with
SIGNED_IN_ELSEWHERE as the reason.

Tokens issued before this existed carry no "sid"; they are accepted only
until the account's next sign-in sets a key.
"""

import secrets

SID_CLAIM = "sid"
SIGNED_IN_ELSEWHERE = "signed_in_elsewhere"
SIGNED_IN_ELSEWHERE_MESSAGE = (
    "You were signed out because this account signed in on another device."
)


def start_session(user):
    """A new sign-in: a fresh key, which ends every other device's session."""
    key = secrets.token_hex(16)
    type(user).objects.filter(pk=user.pk).update(session_key=key)
    user.session_key = key
    return key


def is_current(user, token):
    """Whether this token belongs to the account's current session."""
    return token.get(SID_CLAIM, "") == (user.session_key or "")

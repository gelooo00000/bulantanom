"""
Who is using BulanTanom right now.

`last_seen_at` is stamped by the authentication class below on every
authenticated request, and the Farmer app sends a heartbeat each minute while
it is open and visible, so a Farmer reading a page without clicking anything
still counts as present. Logging out stamps `last_logout_at`, which takes the
Farmer offline at once instead of waiting for the window to lapse.
"""

from datetime import timedelta

from django.utils import timezone
from rest_framework_simplejwt.authentication import JWTAuthentication

# The frontend heartbeat runs every 60 seconds; two minutes leaves room for
# one late beat before a Farmer who is still there is shown as offline.
ONLINE_WINDOW = timedelta(minutes=2)

# A busy page makes several requests a second. Writing the timestamp at most
# this often keeps presence accurate without a database write per request.
SEEN_WRITE_INTERVAL = timedelta(seconds=30)


def touch(user, now=None):
    """Record that `user` is active, unless it was recorded moments ago."""
    now = now or timezone.now()
    if user.last_seen_at and now - user.last_seen_at < SEEN_WRITE_INTERVAL:
        return
    # `.update()` so the write skips `updated_at` and any save() side effects.
    type(user).objects.filter(pk=user.pk).update(last_seen_at=now)
    user.last_seen_at = now


def is_online(user, now=None):
    """Active within the window, and not logged out since."""
    now = now or timezone.now()
    if not user.last_seen_at or now - user.last_seen_at > ONLINE_WINDOW:
        return False
    return not (user.last_logout_at and user.last_logout_at >= user.last_seen_at)


class PresenceJWTAuthentication(JWTAuthentication):
    """The project's JWT authentication, plus a `last_seen_at` stamp."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            touch(result[0])
        return result

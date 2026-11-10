"""
How long people use BulanTanom.

Every heartbeat (about one a minute while the app is open and visible)
counts one minute for today. Heartbeats closer together than COUNT_GAP, from
a second tab or a tab coming back into view, do not count again.
"""

from datetime import date, timedelta

from django.db.models import F, Q, Sum
from django.utils import timezone

from .models import UsageDay

COUNT_GAP = timedelta(seconds=50)

# The first day usage was recorded; nothing before it is known.
TRACKING_SINCE = date(2026, 11, 11)


def record_minute(user, now=None):
    """Count a minute of use for today, unless one was counted moments ago."""
    now = now or timezone.now()
    today = timezone.localdate(now)
    row, _ = UsageDay.objects.get_or_create(user=user, date=today)
    # One conditional UPDATE, so two tabs beating at once count once.
    UsageDay.objects.filter(pk=row.pk).filter(
        Q(counted_at__isnull=True) | Q(counted_at__lte=now - COUNT_GAP)
    ).update(minutes=F("minutes") + 1, counted_at=now)


def usage_summary(user_ids, now=None):
    """Minutes today, in the last 7 days and in the last 30, per user id."""
    today = timezone.localdate(now or timezone.now())
    summary = {uid: {"today": 0, "week": 0, "month": 0} for uid in user_ids}
    windows = {"today": today, "week": today - timedelta(days=6), "month": today - timedelta(days=29)}
    for key, start in windows.items():
        rows = (
            UsageDay.objects.filter(user_id__in=user_ids, date__gte=start, date__lte=today)
            .values("user_id")
            .annotate(total=Sum("minutes"))
        )
        for row in rows:
            summary[row["user_id"]][key] = row["total"] or 0
    return summary

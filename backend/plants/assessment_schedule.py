"""
Weekly assessment scheduling.

A plant may be assessed once per 7-day period. Eligibility is computed here,
from `Assessment.assessment_date` rows in MySQL, and is the *only* authority:
the frontend renders what this module reports but never decides it, so
changing the browser clock cannot unlock an assessment early.
"""

from __future__ import annotations

from datetime import timedelta

from django.db.models import Max
from django.utils import timezone

# One completed assessment per plant per 7-day period.
ASSESSMENT_INTERVAL_DAYS = 7


def last_assessment_date(plant):
    """Most recent assessment date for a plant, or None if never assessed."""
    # Reuse the annotation when the queryset supplied one, so listing plants
    # does not fire a query per row.
    annotated = getattr(plant, "last_assessment_date_annotated", None)
    if annotated is not None:
        return annotated
    return plant.assessments.aggregate(latest=Max("assessment_date"))["latest"]


def eligibility(plant, today=None) -> dict:
    """
    Whether `plant` may be assessed today, and when it next can be.

    Returns the shape the API and UI share:
        can_assess, last_assessment_date, next_assessment_date,
        days_remaining, interval_days
    """
    today = today or timezone.localdate()
    latest = last_assessment_date(plant)

    if latest is None:
        return {
            "can_assess": True,
            "last_assessment_date": None,
            "next_assessment_date": None,
            "days_remaining": 0,
            "interval_days": ASSESSMENT_INTERVAL_DAYS,
        }

    next_date = latest + timedelta(days=ASSESSMENT_INTERVAL_DAYS)
    days_remaining = (next_date - today).days
    return {
        "can_assess": days_remaining <= 0,
        "last_assessment_date": latest.isoformat(),
        "next_assessment_date": next_date.isoformat(),
        # Never negative: once eligible there is nothing left to wait for.
        "days_remaining": max(0, days_remaining),
        "interval_days": ASSESSMENT_INTERVAL_DAYS,
    }


def with_last_assessment_date(queryset):
    """Annotate a Plant queryset so `eligibility()` needs no extra query."""
    return queryset.annotate(last_assessment_date_annotated=Max("assessments__assessment_date"))

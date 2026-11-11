"""
Weekly assessment scheduling.

A plant may be assessed once per 7-day period. Eligibility is computed here,
from `Assessment.assessment_date` rows in MySQL, and is the *only* authority:
the frontend renders what this module reports but never decides it, so
changing the browser clock cannot unlock an assessment early.
"""

from __future__ import annotations

from datetime import timedelta

from django.db.models import Max, OuterRef, Subquery
from django.utils import timezone

# One completed assessment per plant per 7-day period.
ASSESSMENT_INTERVAL_DAYS = 7

# How long a newly planted crop is left alone before its first assessment.
#
# Without this a plant recorded today could be assessed on day 0, and the AI
# had to answer LOW/MEDIUM/HIGH for a seed that has not visibly done anything
# yet — a verdict with nothing behind it. A week is also what the rest of the
# schedule runs on, so the first check simply falls on the normal cadence.
FIRST_ASSESSMENT_AGE_DAYS = 7

# A plant whose latest reading is High or Medium may be checked again this
# soon, instead of waiting the full week: the farmer has treated it and needs
# to see whether it is recovering before it is too late.
EARLY_RECHECK_DAYS = 3
EARLY_RECHECK_LEVELS = ("HIGH", "MEDIUM")

_UNSET = object()


def last_risk_level(plant):
    """The risk level of the plant's latest assessment, or None."""
    annotated = getattr(plant, "last_risk_level_annotated", _UNSET)
    if annotated is not _UNSET:
        return annotated
    from .models import Assessment

    return (
        Assessment.objects.filter(plant=plant)
        .order_by("-assessment_date", "-created_at")
        .values_list("risk__risk_level", flat=True)
        .first()
    )


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

    # A harvested or lost plant is finished: no more weekly assessments.
    if plant.status in ("HARVESTED", "ARCHIVED", "LOST"):
        return {
            "can_assess": False,
            "harvested": plant.status != "LOST",
            "lost": plant.status == "LOST",
            "last_assessment_date": None,
            "next_assessment_date": None,
            "days_remaining": 0,
            "interval_days": ASSESSMENT_INTERVAL_DAYS,
        }

    # A planned planting is not in the ground yet, so there is nothing to
    # assess: the first assessment opens on the planting date itself.
    if plant.planting_date > today:
        return {
            "can_assess": False,
            "planned": True,
            "last_assessment_date": None,
            "next_assessment_date": plant.planting_date.isoformat(),
            "days_remaining": (plant.planting_date - today).days,
            "interval_days": ASSESSMENT_INTERVAL_DAYS,
        }

    latest = last_assessment_date(plant)

    # Ready to harvest: from the first day of its harvest period the crop is
    # grown, so there is nothing left to assess week by week - the farmer
    # harvests it and files the harvest report instead.
    if plant.expected_harvest_start and today >= plant.expected_harvest_start:
        return {
            "can_assess": False,
            "ready_to_harvest": True,
            "last_assessment_date": latest.isoformat() if latest else None,
            "next_assessment_date": None,
            "days_remaining": 0,
            "interval_days": ASSESSMENT_INTERVAL_DAYS,
        }

    if latest is None:
        # Too new to judge: the first assessment opens a week after planting.
        first_date = plant.planting_date + timedelta(days=FIRST_ASSESSMENT_AGE_DAYS)
        if today < first_date:
            return {
                "can_assess": False,
                "too_young": True,
                "last_assessment_date": None,
                "next_assessment_date": first_date.isoformat(),
                "days_remaining": (first_date - today).days,
                "interval_days": ASSESSMENT_INTERVAL_DAYS,
            }
        return {
            "can_assess": True,
            "last_assessment_date": None,
            "next_assessment_date": None,
            "days_remaining": 0,
            "interval_days": ASSESSMENT_INTERVAL_DAYS,
        }

    next_date = latest + timedelta(days=ASSESSMENT_INTERVAL_DAYS)
    days_remaining = (next_date - today).days
    at_risk = last_risk_level(plant) in EARLY_RECHECK_LEVELS
    early_date = latest + timedelta(days=EARLY_RECHECK_DAYS)
    if days_remaining > 0 and at_risk and today < early_date:
        # At risk, and the early re-check has not opened yet: count down to
        # it, so the card agrees with the reading's "reassess in 3 days".
        return {
            "can_assess": False,
            "last_assessment_date": latest.isoformat(),
            "next_assessment_date": early_date.isoformat(),
            "days_remaining": (early_date - today).days,
            "interval_days": ASSESSMENT_INTERVAL_DAYS,
        }
    if (
        days_remaining > 0
        and (today - latest).days >= EARLY_RECHECK_DAYS
        and last_risk_level(plant) in EARLY_RECHECK_LEVELS
    ):
        return {
            "can_assess": True,
            # Allowed before the week is up because the plant is at risk.
            "early_recheck": True,
            "last_assessment_date": latest.isoformat(),
            "next_assessment_date": next_date.isoformat(),
            "days_remaining": 0,
            "interval_days": ASSESSMENT_INTERVAL_DAYS,
        }
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
    from .models import Assessment

    latest_level = (
        Assessment.objects.filter(plant=OuterRef("pk"))
        .order_by("-assessment_date", "-created_at")
        .values("risk__risk_level")[:1]
    )
    return queryset.annotate(
        last_assessment_date_annotated=Max("assessments__assessment_date"),
        last_risk_level_annotated=Subquery(latest_level),
    )

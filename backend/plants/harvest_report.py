"""
Harvest reports: the final assessment written when a Farmer marks a plant
harvested, and the outcome figures LGU Officers and Admins read from them.

The Farmer answers three taps (quality, health, whether the advice helped)
and may add an amount, a photo and a note. Everything else is taken from what
the system already recorded about the plant, so the farmer types nothing more
and the facts cannot be talked up.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from accounts.models import AccountStatus, UserRole

from .models import Assessment, HarvestReport, Plant, PlantStatus, RiskLevel, RiskStatus

# How long a reported harvest can still be undone (moved back to growing).
RESTORE_WINDOW = timedelta(hours=24)

_RISK_ORDER = {RiskLevel.LOW: 1, RiskLevel.MEDIUM: 2, RiskLevel.HIGH: 3}


def system_facts(plant: Plant, harvested_on) -> dict:
    """What the system knows about this plant's life, at harvest time."""
    days_to_harvest = max(0, (harvested_on - plant.planting_date).days)
    expected_days = max(0, (plant.expected_harvest_start - plant.planting_date).days)
    if harvested_on < plant.expected_harvest_start:
        timing = HarvestReport.Timing.EARLY
    elif harvested_on > plant.expected_harvest_end:
        timing = HarvestReport.Timing.LATE
    else:
        timing = HarvestReport.Timing.ON_TIME

    assessments = Assessment.objects.filter(plant=plant)
    levels = list(
        assessments.filter(risk__status=RiskStatus.COMPLETED, risk__risk_level__in=_RISK_ORDER)
        .order_by("assessment_date", "created_at")
        .values_list("risk__risk_level", flat=True)
    )
    highest = max(levels, key=lambda level: _RISK_ORDER[level], default="")
    high_count = sum(1 for level in levels if level == RiskLevel.HIGH)
    return {
        "harvested_on": harvested_on,
        "days_to_harvest": days_to_harvest,
        "expected_days": expected_days,
        "timing": timing,
        "assessments_count": assessments.count(),
        "highest_risk": highest,
        "high_risk_count": high_count,
        "recovered_from_high": high_count > 0 and levels[-1] != RiskLevel.HIGH,
    }


@transaction.atomic
def record_harvest(plant: Plant, answers: dict) -> HarvestReport:
    """Marks `plant` harvested and files its report, together or not at all."""
    plant.status = PlantStatus.HARVESTED
    plant.save(update_fields=["status", "updated_at"])
    harvested_on = timezone.localtime(plant.harvested_at).date()
    return HarvestReport.objects.create(plant=plant, **answers, **system_facts(plant, harvested_on))


def restore_problem(plant: Plant) -> str | None:
    """Why a harvested plant can no longer go back to growing, or None."""
    report = getattr(plant, "harvest_report", None)
    if report is None or plant.harvested_at is None:
        return None  # Harvested before reports existed: unchanged behaviour.
    if timezone.now() - plant.harvested_at > RESTORE_WINDOW:
        return (
            "This harvest was reported more than 24 hours ago, so it can no "
            "longer be undone."
        )
    return None


# ---------------------------------------------------------------------------
# Outcomes for LGU Officers and Admins
# ---------------------------------------------------------------------------


def _percent(part: int, whole: int) -> int | None:
    return round(100 * part / whole) if whole else None


def reports_in_scope():
    """Reports of approved Farmers: the same scope the LGU reports cover."""
    return HarvestReport.objects.filter(
        plant__farmer__role=UserRole.FARMER,
        plant__farmer__account_status=AccountStatus.APPROVED,
    ).select_related("plant", "plant__crop", "plant__variant", "plant__farmer")


def outcomes(reports=None, *, recent: int = 10) -> dict:
    """
    The figures that show how monitored plants turned out:
    healthy at harvest, recovered from High risk, harvested on time, and
    whether farmers felt the advice helped - overall and per crop.
    """
    reports = list(reports if reports is not None else reports_in_scope())
    total = len(reports)

    def count(field, value, rows=reports):
        return sum(1 for r in rows if getattr(r, field) == value)

    healthy = count("final_health", HarvestReport.FinalHealth.HEALTHY)
    helped = sum(
        1
        for r in reports
        if r.advice_helped in (HarvestReport.AdviceHelped.YES, HarvestReport.AdviceHelped.A_LITTLE)
    )
    had_high = [r for r in reports if r.high_risk_count > 0]
    recovered_healthy = sum(
        1 for r in had_high if r.final_health == HarvestReport.FinalHealth.HEALTHY
    )
    on_time = count("timing", HarvestReport.Timing.ON_TIME)
    monitored = sum(1 for r in reports if r.assessments_count > 0)

    by_crop = defaultdict(list)
    for report in reports:
        by_crop[report.plant.crop].append(report)
    crops = []
    for crop, rows in sorted(by_crop.items(), key=lambda item: (-len(item[1]), item[0].name)):
        yields = defaultdict(list)
        for r in rows:
            if r.yield_amount is not None and r.yield_unit:
                yields[r.yield_unit].append(float(r.yield_amount))
        crops.append(
            {
                "crop": crop.name,
                "emoji": crop.emoji,
                "harvests": len(rows),
                "healthy_rate": _percent(count("final_health", "HEALTHY", rows), len(rows)),
                "good_quality_rate": _percent(count("quality", "GOOD", rows), len(rows)),
                "on_time_rate": _percent(count("timing", "ON_TIME", rows), len(rows)),
                "average_yield": [
                    {
                        "unit": unit,
                        "unit_label": HarvestReport.YieldUnit(unit).label,
                        "average": round(sum(values) / len(values), 2),
                        "reports": len(values),
                    }
                    for unit, values in sorted(yields.items())
                ],
                "average_days": round(sum(r.days_to_harvest for r in rows) / len(rows)),
            }
        )

    def breakdown(field, choices):
        return [
            {"value": value, "label": label, "count": count(field, value)}
            for value, label in choices.choices
        ]

    return {
        "total": total,
        "healthy_rate": _percent(healthy, total),
        "advice_helped_rate": _percent(helped, total),
        "on_time_rate": _percent(on_time, total),
        "monitored_rate": _percent(monitored, total),
        "reached_high_risk": len(had_high),
        "recovered_healthy": recovered_healthy,
        "quality": breakdown("quality", HarvestReport.Quality),
        "final_health": breakdown("final_health", HarvestReport.FinalHealth),
        "advice_helped": breakdown("advice_helped", HarvestReport.AdviceHelped),
        "timing": breakdown("timing", HarvestReport.Timing),
        "by_crop": crops,
        "recent": reports[:recent],
    }

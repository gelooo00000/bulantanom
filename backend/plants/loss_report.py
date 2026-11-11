"""
Plant losses for LGU Officers: plants that died before harvest, read from
the loss report each Farmer files when they mark a plant as died.

Two groups matter most to an officer and are flagged on every loss:

* a calamity - the Farmer said a typhoon, flood, drought or strong winds
  killed it;
* a High-risk plant that was not saved - BulanTanom had read it as High
  risk at some point, and it died anyway.

Every loss also falls in one of four cause groups: calamity, pests and
disease, growing conditions (nutrients, soil, water, temperature), and
farming practice or other.

Both come from what is already stored on the LossReport (the Farmer's cause,
and the risk history frozen at the time of the report), so nothing here is
guessed.
"""

from __future__ import annotations

from collections import Counter
from datetime import date

from django.utils import timezone

from .models import LossReport, RiskLevel

CALAMITY_CAUSES = (LossReport.Cause.CALAMITY,)
PEST_DISEASE_CAUSES = (LossReport.Cause.PEST, LossReport.Cause.DISEASE)
CONDITION_CAUSES = (
    LossReport.Cause.NUTRIENTS,
    LossReport.Cause.POOR_SOIL,
    LossReport.Cause.WATER,
    LossReport.Cause.EXTREME_TEMP,
)

# How many months the "losses by month" chart covers, this month included.
MONTHS = 6


def is_calamity(loss: LossReport) -> bool:
    return loss.cause in CALAMITY_CAUSES


def is_high_risk_not_saved(loss: LossReport) -> bool:
    return loss.highest_risk == RiskLevel.HIGH


def cause_group(loss: LossReport) -> str:
    """calamity, pest_disease, conditions or other: the cause, in the page's four groups."""
    if is_calamity(loss):
        return "calamity"
    if loss.cause in PEST_DISEASE_CAUSES:
        return "pest_disease"
    if loss.cause in CONDITION_CAUSES:
        return "conditions"
    return "other"


_GROUP_OF = {
    **{value: "calamity" for value in CALAMITY_CAUSES},
    **{value: "pest_disease" for value in PEST_DISEASE_CAUSES},
    **{value: "conditions" for value in CONDITION_CAUSES},
    LossReport.Cause.HUMAN_ERROR: "other",
    LossReport.Cause.OTHER: "other",
}


def _percent(part: int, whole: int) -> int | None:
    return round(100 * part / whole) if whole else None


def _month_starts(today: date, count: int) -> list[date]:
    """The first day of this month and the `count - 1` before it, oldest first."""
    months = []
    year, month = today.year, today.month
    for _ in range(count):
        months.append(date(year, month, 1))
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    return list(reversed(months))


def summary(losses, *, harvested: int, today: date | None = None) -> dict:
    """The Plant Loss page's figures, from loss reports already in scope."""
    losses = list(losses)
    today = today or timezone.localdate()
    total = len(losses)

    calamity = sum(1 for loss in losses if is_calamity(loss))
    not_saved = sum(1 for loss in losses if is_high_risk_not_saved(loss))
    warned = sum(1 for loss in losses if loss.warned_before)
    pest_disease = sum(1 for loss in losses if cause_group(loss) == "pest_disease")
    conditions = sum(1 for loss in losses if cause_group(loss) == "conditions")

    by_cause = Counter(loss.cause for loss in losses)
    causes = [
        {
            "value": value,
            "label": label,
            "count": by_cause.get(value, 0),
            "calamity": value in CALAMITY_CAUSES,
            "group": _GROUP_OF[value],
        }
        for value, label in LossReport.Cause.choices
    ]

    by_crop: dict[int, dict] = {}
    for loss in losses:
        crop = loss.plant.crop
        row = by_crop.setdefault(
            crop.pk, {"crop": crop.name, "emoji": crop.emoji, "count": 0}
        )
        row["count"] += 1
    crops = sorted(by_crop.values(), key=lambda row: (-row["count"], row["crop"]))

    per_month = Counter(
        (timezone.localtime(loss.lost_at).year, timezone.localtime(loss.lost_at).month)
        for loss in losses
    )
    months = [
        {"month": start.isoformat()[:7], "count": per_month.get((start.year, start.month), 0)}
        for start in _month_starts(today, MONTHS)
    ]

    return {
        "total": total,
        "calamity": calamity,
        "high_risk_not_saved": not_saved,
        "pest_disease": pest_disease,
        "conditions": conditions,
        "other": total - calamity - pest_disease - conditions,
        "warned_before": warned,
        "warned_before_rate": _percent(warned, total),
        "harvested": harvested,
        "survival_rate": _percent(harvested, harvested + total),
        "causes": causes,
        "crops": crops,
        "months": months,
    }

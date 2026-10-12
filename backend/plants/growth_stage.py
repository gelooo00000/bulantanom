"""
The growth stage a plant should be at for its age, and how far a photo may
be ahead of it.

One scale for both AI checks: the photo check (evidence_validation_service)
compares the stage it sees against the stage expected here, and the risk
evaluation (risk_evaluation_service) is told the expected stage in words.

The expected stage comes from the plant's own growing time — planting date
to expected harvest, which follows its variety (Singkamas takes far longer
than a radish) — or the crop's configured duration when there is no plant.
The system's own figures, so a deliberately coarse guide, not an agronomic
claim.
"""

from __future__ import annotations

# In order. A photo is described on the same scale by the AI.
STAGES = ("seedling", "vegetative", "flowering", "fruiting", "mature")

STAGE_WORDS = {
    "seedling": "early establishment / seedling",
    "vegetative": "vegetative growth",
    "flowering": "flowering / early reproductive",
    "fruiting": "fruiting / maturing",
    "mature": "harvest-ready or past expected harvest start",
}

# How many stages a photo may be ahead of the expected one before the photo
# and the planting date cannot both be right. One stage of slack allows for
# fast growers and the coarse boundaries below; two or more (fruit on a
# plant planted days ago) is a different plant or a wrong planting date.
MAX_STAGES_AHEAD = 1


def growing_days(plant) -> int:
    """Planting to expected harvest start: the plant's variety-aware duration."""
    start = getattr(plant, "expected_harvest_start", None)
    if start and plant.planting_date:
        return max(0, (start - plant.planting_date).days)
    return getattr(plant.crop, "growing_duration_days", 0) or 0


def expected_stage(duration_days: int | None, age_days: int) -> str | None:
    """The stage a plant should be at, given its growing time, or None if unknown."""
    duration = duration_days or 0
    if duration <= 0:
        return None
    fraction = age_days / duration
    if fraction < 0.15:
        return "seedling"
    if fraction < 0.45:
        return "vegetative"
    if fraction < 0.70:
        return "flowering"
    if fraction < 1.0:
        return "fruiting"
    return "mature"


def too_far_ahead(expected: str | None, observed: str | None) -> bool:
    """
    True when the photo shows a plant clearly older than its recorded age:
    flowering or later, and more than MAX_STAGES_AHEAD past the expected
    stage. A plant that looks younger than expected is a growth question for
    the risk evaluation, never a reason to refuse the photo.
    """
    if expected not in STAGES or observed not in STAGES:
        return False
    ahead = STAGES.index(observed) - STAGES.index(expected)
    return STAGES.index(observed) >= STAGES.index("flowering") and ahead > MAX_STAGES_AHEAD

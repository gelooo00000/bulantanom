"""
Which weekly-assessment questions fit which crop.

Every farmer used to answer the same form, so a mushroom grower had to pick a
leaf condition and an ube grower a fruiting stage. Those forced answers are
not real observations: the AI read them as claims and could flag them as
contradicting the photo, blocking an honest assessment.

This is the single source of truth. The form hides these questions for the
crop, the server stores them blank, and the risk evaluation tells the AI they
do not apply, so they can never be a contradiction or a risk factor.
"""

from __future__ import annotations

# Questions a crop can skip. Anything not listed is asked as normal.
HEIGHT = "plant_height_cm"
LEAF = "leaf_condition"
FLOWERING = "flowering_status"
FRUITING = "fruiting_status"

SKIPPABLE = (HEIGHT, LEAF, FLOWERING, FRUITING)

_ROOT_CROP = (FRUITING,)  # the harvest grows underground, out of any photo
_LEAFY_CROP = (FRUITING,)  # harvested for leaves or stalks, never for fruit

NOT_APPLICABLE: dict[str, tuple[str, ...]] = {
    # A fungus: no leaves, no flowers, and no meaningful plant height. Its
    # mushrooms are the fruiting bodies, so fruiting still applies.
    "mushroom": (HEIGHT, LEAF, FLOWERING),
    "purple-sweet-potato": _ROOT_CROP,
    "ginger": _ROOT_CROP,
    "radish-jicama": _ROOT_CROP,
    # Flowering stays: in leafy greens it is bolting, a real warning sign.
    "lettuce-cabbage": _LEAFY_CROP,
    "lemongrass": _LEAFY_CROP,
}


def not_applicable(crop) -> tuple[str, ...]:
    """The questions that do not apply to `crop` (a Crop or its id)."""
    crop_id = crop if isinstance(crop, str) else getattr(crop, "id", None)
    return NOT_APPLICABLE.get(crop_id, ())

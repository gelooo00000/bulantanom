"""
Planting-season guidance for Layuan Nature Integrated Farm, Bulan, Sorsogon.

WHY THIS FILE EXISTS
--------------------
`Crop.growing_duration_days` answers "how long until harvest". It cannot
answer "is this a sensible month to put this crop in the ground here", and
in Bulan that second question matters more: the farm sits in one of the
wettest, most typhoon-exposed provinces in the country, so the same crop
planted in March and in October has two very different outcomes.

PROVENANCE OF THE FIGURES BELOW
-------------------------------
Two layers, deliberately kept separate so an agronomist can audit them:

1. LOCAL CLIMATE (high confidence, published).
   Bulan, Sorsogon falls under PAGASA / Coronas **Climate Type II**:
   no pronounced dry season, with a very pronounced rainfall maximum from
   November to January. Bicol Region is also the most tropical-cyclone-
   exposed region in the Philippines; the season runs roughly June to
   December and peaks September to November.
   Consequences used throughout this module:
     - Driest, most reliable planting window: February - May.
     - Transition, usable with drainage: June - August.
     - Wettest + peak typhoon risk: September - January.

2. CROP BEHAVIOUR (standard Philippine extension guidance).
   Which of those windows each crop wants, e.g. solanaceous crops
   (eggplant, tomato, peppers) are planted into the drier months because
   bacterial wilt (Ralstonia solanacearum) and fruit rot are driven by
   waterlogging; fruit trees go in at the onset of the rains so seedlings
   establish on natural rainfall.

WHAT THESE FIGURES ARE NOT
--------------------------
They are month-level guidance, not a prescription, and they are not
calibrated against Layuan Farm's own yield records. They never move a
harvest date — `Plant.calculate_harvest_window` remains the only thing
that does that. This module only ever produces advisory text.

Windows are editable per crop in the database (`Crop.planting_months`),
so correcting one is an Admin edit, not a code change. The values here are
only the initial seed.
"""

from __future__ import annotations

# Month groupings for Bulan's Type II climate. Used to explain *why* a
# month is or isn't recommended, so the farmer sees reasoning, not a verdict.
DRY_WINDOW = (2, 3, 4, 5)           # February - May
TRANSITION_WINDOW = (6, 7, 8)       # June - August
WET_WINDOW = (9, 10, 11, 12, 1)     # September - January (peak rain + typhoons)

MONTH_NAMES = {
    1: "January", 2: "February", 3: "March", 4: "April",
    5: "May", 6: "June", 7: "July", 8: "August",
    9: "September", 10: "October", 11: "November", 12: "December",
}

# Suitability verdicts, ordered worst to best.
POOR = "poor"
CAUTION = "caution"
GOOD = "good"


def month_range_label(months) -> str:
    """Render [2,3,4,5] as 'February-May', handling wrap-around and gaps."""
    if not months:
        return "no recommended window on record"
    ordered = sorted(set(months))
    if len(ordered) == 12:
        return "year-round"

    # Group consecutive months, treating December -> January as consecutive.
    runs: list[list[int]] = []
    for m in ordered:
        if runs and (m - runs[-1][-1]) == 1:
            runs[-1].append(m)
        else:
            runs.append([m])
    # Merge a December-ending run with a January-starting run.
    if len(runs) > 1 and runs[0][0] == 1 and runs[-1][-1] == 12:
        runs[0] = runs[-1] + runs[0]
        runs.pop()

    parts = []
    for run in runs:
        if len(run) == 1:
            parts.append(MONTH_NAMES[run[0]])
        else:
            parts.append(f"{MONTH_NAMES[run[0]]}-{MONTH_NAMES[run[-1]]}")
    return ", ".join(parts)


# ---------------------------------------------------------------------------
# Seed planting windows, by crop id.
#
#   preferred — months this crop is normally put in the ground at Layuan.
#   caution   — workable, but needs a named mitigation (drainage, watering,
#               windbreak). Never left unexplained.
#   reason    — why the preferred window is what it is. Shown to the farmer.
#   risk      — what actually goes wrong outside it. Shown as the warning.
#
# Anything not listed in preferred or caution is treated as POOR.
# ---------------------------------------------------------------------------

_PERENNIAL_TREE = {
    "preferred": [6, 7, 8],
    "caution": [2, 3, 4, 5],
    "reason": (
        "Fruit trees are set out at the onset of the rains so the seedling "
        "establishes its roots on natural rainfall."
    ),
    "risk": (
        "Planting into September-January puts a young, shallow-rooted tree "
        "through the peak typhoon months and the wettest part of the year, "
        "when losses to toppling and root asphyxiation are highest."
    ),
    "caution_note": (
        "Workable in the drier months, but the seedling will need regular "
        "hand watering until the rains arrive."
    ),
}

_SOLANACEOUS = {
    "preferred": [2, 3, 4, 5],
    "caution": [6, 7, 8],
    "reason": (
        "Planted into the drier February-May window, when the soil drains "
        "freely and bacterial wilt pressure is at its lowest."
    ),
    "risk": (
        "In the September-January rainfall peak, waterlogged beds drive "
        "bacterial wilt and fruit rot, and flowers drop instead of setting."
    ),
    "caution_note": (
        "Possible through the June-August transition on raised beds with "
        "clear drainage furrows; expect heavier disease scouting."
    ),
}

PLANTING_CALENDAR: dict[str, dict] = {
    # ------------------------------------------------------------- fruit
    "starfruit": _PERENNIAL_TREE,
    "guava": _PERENNIAL_TREE,
    "orange-calamansi": _PERENNIAL_TREE,
    "soursop": _PERENNIAL_TREE,
    "java-plum": _PERENNIAL_TREE,
    "pomelo": _PERENNIAL_TREE,
    "sapodilla": _PERENNIAL_TREE,
    "rambutan-lychee": _PERENNIAL_TREE,
    "sugar-apple": _PERENNIAL_TREE,
    "jackfruit": _PERENNIAL_TREE,
    "avocado": _PERENNIAL_TREE,
    "cacao": _PERENNIAL_TREE,
    "banana": {
        "preferred": [2, 3, 4, 5],
        "caution": [6, 7],
        "reason": (
            "Suckers go in early in the year so the pseudostem is well "
            "anchored before the typhoon season builds."
        ),
        "risk": (
            "Banana has no woody trunk. A mat planted into August-December "
            "meets the peak typhoon months while still top-heavy and "
            "shallow-rooted, which is when whole stands are lost to toppling."
        ),
        "caution_note": "Acceptable at the onset of the rains if a windbreak is in place.",
    },
    "papaya": {
        "preferred": [2, 3, 4, 5],
        "caution": [6, 7],
        "reason": (
            "Early-year planting lets the stem thicken through the drier "
            "months before it has to carry fruit through the storm season."
        ),
        "risk": (
            "Papaya is brittle and snaps at the crown in strong wind, and its "
            "roots collapse quickly in saturated soil. September-January "
            "planting exposes a young plant to both."
        ),
        "caution_note": "Workable early in the rains on a mound with free drainage.",
    },
    "pineapple": {
        "preferred": [2, 3, 4, 5, 6, 7, 8],
        "caution": [9, 1],
        "reason": (
            "Pineapple is drought-tolerant and roots well across the drier "
            "months and the early rains."
        ),
        "risk": (
            "The one thing it will not tolerate is standing water; suckers "
            "planted into the November-January peak rot at the base."
        ),
        "caution_note": "Only on well-drained, raised ground.",
    },
    "passion-fruit": {
        "preferred": [2, 3, 4, 5],
        "caution": [6, 7],
        "reason": (
            "Vines are established in the drier months so the trellis carries "
            "growth into the rains."
        ),
        "risk": (
            "A loaded trellis acts as a sail. Planting ahead of the "
            "September-December storm peak risks losing both vine and "
            "structure, and persistent wet drives fruit rot."
        ),
        "caution_note": "Needs a low, well-braced trellis if started in the rains.",
    },
    "grapes": {
        "preferred": [2, 3, 4],
        "caution": [5, 6],
        "reason": (
            "Grapes need a genuinely dry spell to ripen without splitting, so "
            "they are set out at the start of the driest window."
        ),
        "risk": (
            "Grapes are marginal in a Type II climate. Rain during ripening "
            "splits the berries and invites anthracnose and downy mildew; "
            "September-January planting is not advisable here."
        ),
        "caution_note": "Requires an overhead rain shelter to be worth attempting.",
    },
    "cantaloupe": {
        "preferred": [1, 2, 3],
        "caution": [4, 12],
        "reason": (
            "Melons are timed so the fruit sizes and ripens inside the "
            "February-May dry window."
        ),
        "risk": (
            "Rain during ripening dilutes sugars and rots fruit resting on wet "
            "soil. A crop planted June-November rarely reaches eating quality."
        ),
        "caution_note": "Mulch under the fruit and expect lower sugar.",
    },
    "watermelon": {
        "preferred": [1, 2, 3],
        "caution": [4, 12],
        "reason": (
            "Planted early in the year so the long sizing period falls in the "
            "drier months."
        ),
        "risk": (
            "Wet-season watermelon splits, rots on the ground, and runs low in "
            "sugar; the vines also mildew badly in the rainfall peak."
        ),
        "caution_note": "Mulch under the fruit and expect lower sugar.",
    },
    # --------------------------------------------------------- vegetable
    "eggplant": {
        "preferred": [2, 3, 4, 5],
        "caution": [6, 7, 8, 1],
        "reason": (
            "Eggplant is transplanted into the drier February-May window, when "
            "free-draining soil keeps bacterial wilt pressure low and the long "
            "harvest window can run undisturbed."
        ),
        "risk": (
            "Eggplant is hardy but not waterproof. Through the "
            "September-January rainfall peak, saturated beds drive bacterial "
            "wilt and fruit rot, flowers drop instead of setting, and fruit "
            "and shoot borer pressure climbs."
        ),
        "caution_note": (
            "Its heat tolerance carries it through the transition months on "
            "raised beds with clear drainage furrows; scout for wilt weekly."
        ),
    },
    "tomato": _SOLANACEOUS,
    "pepper": _SOLANACEOUS,
    "red-chili": _SOLANACEOUS,
    "lettuce-cabbage": {
        "preferred": [12, 1, 2],
        "caution": [11, 3],
        "reason": (
            "These are cool-season heads. The only lowland window that comes "
            "close is the coolest part of the year, and only with "
            "heat-tolerant varieties."
        ),
        "risk": (
            "Bulan is lowland tropics; commercial cabbage and lettuce in the "
            "Philippines are highland crops. Outside the coolest months the "
            "heads bolt or fail to form at all, and warm rain brings soft rot."
        ),
        "caution_note": (
            "Marginal at the best of times here - treat any lowland planting "
            "as a trial, not a production block."
        ),
    },
    "mushroom": {
        "preferred": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        "caution": [],
        "reason": (
            "Mushrooms are grown on prepared substrate in a shaded, humid "
            "house, so the outdoor season does not gate planting."
        ),
        "risk": "",
        "caution_note": "",
    },
    "purple-sweet-potato": {
        "preferred": [3, 4, 5, 6],
        "caution": [2, 7],
        "reason": (
            "Vine cuttings are set out as the rains begin, giving the crop "
            "steady moisture through the long bulking period."
        ),
        "risk": (
            "Storage roots rot in waterlogged ground. Planting into the "
            "September-January peak also means bulking in saturated soil, "
            "which splits roots and invites weevil damage."
        ),
        "caution_note": "Plant on ridges so the roots sit above any standing water.",
    },
    "ginger": {
        "preferred": [3, 4, 5],
        "caution": [2, 6],
        "reason": (
            "Rhizomes go in just before the rains so they sprout into a wet, "
            "warm season under partial shade."
        ),
        "risk": (
            "Ginger is highly prone to soft rot and bacterial wilt in "
            "waterlogged soil. Planting into the rainfall peak commonly loses "
            "the bed outright."
        ),
        "caution_note": "Only on raised, free-draining beds with good shade.",
    },
    "lemongrass": {
        "preferred": [2, 3, 4, 5, 6, 7, 8],
        "caution": [9, 1],
        "reason": (
            "Hardy clumping greens establish easily across the drier months "
            "and the early rains, then give repeat cuttings."
        ),
        "risk": (
            "Only the wettest months are a real problem: new divisions rot "
            "before they root when the ground stays saturated."
        ),
        "caution_note": "Establish on a ridge if started late in the year.",
    },
    "radish-jicama": {
        "preferred": [2, 3, 4, 5],
        "caution": [6, 7],
        "reason": (
            "Quick root crops are grown in the drier window, when loose soil "
            "lets the roots swell cleanly."
        ),
        "risk": (
            "Heavy rain compacts and waterlogs the bed, which forks and cracks "
            "the roots and rots them before they size up."
        ),
        "caution_note": "Needs a deep, loose, free-draining bed to work in the rains.",
    },
    "corn": {
        "preferred": [2, 3, 4, 5, 6],
        "caution": [7, 8],
        "reason": (
            "Corn is planted from the dry window into the onset of the rains "
            "so that tasselling and grain fill happen before the storm peak."
        ),
        "risk": (
            "Corn lodges - the stand is flattened by wind - and a crop planted "
            "September-January is tasselling straight into the peak typhoon "
            "months. Wet tassels also pollinate poorly, leaving gappy ears."
        ),
        "caution_note": (
            "Still workable mid-rains; plant in blocks rather than rows so the "
            "stand supports itself and pollination stays even."
        ),
    },
}


def evaluate(entry: dict | None, month: int) -> dict | None:
    """
    Advisory verdict for planting `month`, given a window `entry`.

    `entry` is whatever holds the window - a row from PLANTING_CALENDAR, or
    the equivalent fields off a Crop record, which is what the running app
    uses so an Admin edit takes effect without a deploy.

    Returns None when there is no window on record, so callers stay silent
    rather than invent guidance. Never influences harvest dates.
    """
    if not entry or not (1 <= month <= 12):
        return None
    if not entry.get("preferred") and not entry.get("caution"):
        return None

    preferred = list(entry.get("preferred") or [])
    caution = list(entry.get("caution") or [])

    if month in preferred:
        status = GOOD
        headline = f"{MONTH_NAMES[month]} is a good month to plant this at Layuan Farm."
        detail = entry.get("reason", "")
    elif month in caution:
        status = CAUTION
        headline = f"{MONTH_NAMES[month]} is workable, but not the ideal window."
        detail = " ".join(
            x for x in (entry.get("caution_note", ""), entry.get("risk", "")) if x
        )
    else:
        status = POOR
        headline = f"{MONTH_NAMES[month]} is outside the recommended planting window."
        detail = entry.get("risk", "")

    return {
        "status": status,
        "month": month,
        "month_name": MONTH_NAMES[month],
        "headline": headline,
        "detail": detail.strip(),
        "preferred_months": preferred,
        "preferred_label": month_range_label(preferred),
        "caution_months": caution,
    }


def evaluate_month(crop_id: str, month: int) -> dict | None:
    """Convenience wrapper over the seed table, used by tests and seeding."""
    return evaluate(PLANTING_CALENDAR.get(crop_id), month)

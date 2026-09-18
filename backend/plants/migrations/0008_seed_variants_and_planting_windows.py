"""
Seeds crop varieties and planting windows.

VARIETY DURATIONS
-----------------
Days here are the conventional field figures used in Philippine vegetable
and fruit production (DA / BPI / PhilRice extension material and the
varietal descriptions seed suppliers publish), counted the same way as the
parent crop: from planting to the start of the harvest window.

They are more defensible than the parent-crop placeholders they sit beside,
because a variety is a much narrower thing to put a number on - sweet corn
harvested at the milk stage really is weeks ahead of yellow field corn taken
as dry grain. They are still indicative, not calibrated against Layuan
Farm's own records, and every one of them is editable in Django admin.

Three splits here deliberately correct a conflation in the parent catalog,
where two genuinely different plants share one row:
  - purple-sweet-potato: ube is a yam (Dioscorea alata, 8-10 months);
    kamote is a sweet potato (Ipomoea batatas, 3-4 months).
  - radish-jicama: labanos is ready in about six weeks, singkamas takes
    five months or more.
  - lettuce-cabbage: leaf lettuce and head cabbage are weeks apart.
Recording the variety is what lets the harvest window come out right for
those crops.

PLANTING WINDOWS
----------------
Copied from `plants/crop_calendar.py`, which documents where they come from
(Bulan's PAGASA Type II climate and its tropical-cyclone exposure) and what
they are not. Copying rather than importing keeps this migration replayable
if that module is later edited.
"""

from django.db import migrations

from plants.crop_calendar import PLANTING_CALENDAR

# crop_id, variant_id, name, growing_days, harvest_days, description, search_terms
VARIANTS = [
    # ------------------------------------------------------------------ corn
    ("corn", "corn-sweet", "Sweet Corn", 75, 14,
     "Harvested young at the milk stage for eating fresh; the quickest corn to reach the table.",
     ["sweet corn", "mais"]),
    ("corn", "corn-white-glutinous", "White Corn (Glutinous)", 90, 14,
     "The sticky white corn boiled and sold on the cob; harvested green.",
     ["malagkit", "puti", "glutinous", "waxy"]),
    ("corn", "corn-yellow-field", "Yellow Corn (Grain)", 110, 21,
     "Left on the plant to dry down for grain and feed, so it occupies the field longest.",
     ["yellow", "field corn", "grain", "feed"]),

    # -------------------------------------------------------------- eggplant
    ("eggplant", "eggplant-long-purple", "Long Purple", 110, 45,
     "The long, slender purple type that dominates Philippine markets. Heavy yielder over a long picking window.",
     ["talong", "dumaguete long purple", "long"]),
    ("eggplant", "eggplant-round-native", "Round / Native", 105, 45,
     "Shorter, rounder native-type fruit. Generally hardier and more tolerant of local pest pressure.",
     ["native", "round", "bilog"]),

    # ---------------------------------------------------------------- tomato
    ("tomato", "tomato-native", "Native (Kamatis)", 80, 30,
     "Small-fruited native type. Lower yielding than a hybrid but noticeably more tolerant of heat and wet.",
     ["kamatis", "native"]),
    ("tomato", "tomato-hybrid-slicing", "Hybrid Slicing", 85, 30,
     "Large-fruited fresh-market hybrid. Higher yield, but needs staking and closer disease management.",
     ["hybrid", "slicing", "fresh market"]),

    # ---------------------------------------------------------------- pepper
    ("pepper", "pepper-siling-haba", "Siling Haba (Finger Pepper)", 95, 40,
     "The long, mild green pepper used in sinigang and pinakbet. Picked green over several weeks.",
     ["siling haba", "finger pepper", "long green"]),
    ("pepper", "pepper-bell", "Bell Pepper", 100, 35,
     "Thick-walled sweet pepper. The most demanding of the peppers here - it dislikes heavy rain and high heat.",
     ["bell", "sweet pepper", "capsicum"]),

    # ------------------------------------------------------------- red chili
    ("red-chili", "red-chili-labuyo", "Siling Labuyo", 100, 60,
     "Small, very hot bird's-eye chili on an upright bush. Picks repeatedly over a long window.",
     ["labuyo", "birds eye", "native chili"]),
    ("red-chili", "red-chili-cayenne", "Long Red Cayenne", 95, 45,
     "Long red chili dried for flakes and sauces; larger fruit, milder than labuyo.",
     ["cayenne", "long red"]),

    # ---------------------------------------------------------------- banana
    ("banana", "banana-latundan", "Latundan", 380, 30,
     "Sweet dessert banana with a thin skin. The quickest of the three to bunch.",
     ["latundan", "tundan"]),
    ("banana", "banana-lakatan", "Lakatan", 400, 30,
     "Premium dessert banana, firmer and more aromatic; the usual choice for market sale.",
     ["lakatan"]),
    ("banana", "banana-saba", "Saba / Cardaba", 480, 30,
     "Starchy cooking banana for turon and banana cue. Hardiest of the three, but the longest in the ground.",
     ["saba", "cardaba", "cooking banana"]),

    # ------------------------------------------------------------ watermelon
    ("watermelon", "watermelon-seeded", "Seeded (Sugar Baby type)", 85, 21,
     "Round, dark-skinned, reliable open-pollinated type. Easier to grow than seedless.",
     ["sugar baby", "seeded", "pakwan"]),
    ("watermelon", "watermelon-seedless", "Seedless", 95, 21,
     "Higher market value, but needs a seeded pollinator planted alongside it to set fruit at all.",
     ["seedless", "triploid"]),

    # ------------------------------------------- purple sweet potato (split)
    ("purple-sweet-potato", "ube-purple-yam", "Ube (Purple Yam)", 270, 30,
     "A true yam grown from tubers, deep violet inside. Long season - roughly nine months in the ground.",
     ["ube", "purple yam", "dioscorea"]),
    ("purple-sweet-potato", "kamote-sweet-potato", "Kamote (Sweet Potato)", 120, 30,
     "Sweet potato grown from vine cuttings. A different plant from ube and ready in about a third of the time.",
     ["kamote", "sweet potato", "camote"]),

    # -------------------------------------------------- radish/jicama (split)
    ("radish-jicama", "radish-labanos", "Labanos (Radish)", 45, 14,
     "Fast white radish, pulled about six weeks after sowing. Goes woody if left too long.",
     ["labanos", "radish", "daikon"]),
    ("radish-jicama", "jicama-singkamas", "Singkamas (Jicama)", 150, 30,
     "Crisp sweet root eaten raw. Takes five months or more - far longer than the radish it shares a row with.",
     ["singkamas", "jicama", "yam bean"]),

    # ------------------------------------------------ lettuce/cabbage (split)
    ("lettuce-cabbage", "lettuce-leaf", "Leaf Lettuce", 55, 21,
     "Loose-leaf lettuce, cut young. The more realistic of the two in lowland heat.",
     ["letsugas", "lettuce", "leaf"]),
    ("lettuce-cabbage", "cabbage-repolyo", "Cabbage (Repolyo)", 80, 21,
     "Head cabbage. Needs cool weather to form a solid head and is marginal outside the highlands.",
     ["repolyo", "cabbage", "head"]),

    # -------------------------------------------------------------- mushroom
    ("mushroom", "mushroom-oyster", "Oyster Mushroom", 30, 21,
     "Grown on sawdust or straw bags in a shaded house. Flushes repeatedly from the same bags.",
     ["oyster", "kabuteng tainga", "pleurotus"]),
    ("mushroom", "mushroom-straw", "Straw Mushroom", 18, 10,
     "Grown on composted rice straw beds. Very fast, but each bed runs for a short time.",
     ["straw", "volvariella", "kabuteng dayami"]),

    # ------------------------------------------------------ orange/calamansi
    ("orange-calamansi", "calamansi", "Calamansi", 730, 150,
     "Small sour citrus picked almost year-round once established. The mainstay backyard citrus.",
     ["calamansi", "kalamansi"]),
    ("orange-calamansi", "dalandan-sweet-orange", "Dalandan (Sweet Orange)", 900, 90,
     "Green-skinned sweet orange. Slower to come into bearing than calamansi.",
     ["dalandan", "sweet orange"]),
]


def seed(apps, schema_editor):
    Crop = apps.get_model("plants", "Crop")
    CropVariant = apps.get_model("plants", "CropVariant")

    # Planting windows onto the crops that have one on record.
    for crop_id, entry in PLANTING_CALENDAR.items():
        Crop.objects.filter(id=crop_id).update(
            planting_months=list(entry.get("preferred") or []),
            planting_caution_months=list(entry.get("caution") or []),
            planting_reason=entry.get("reason", ""),
            planting_risk=entry.get("risk", ""),
            planting_caution_note=entry.get("caution_note", ""),
        )

    # Varieties. Skipped rather than failed if the parent crop is absent, so
    # a partially seeded catalog still migrates.
    order_by_crop: dict[str, int] = {}
    for (crop_id, vid, name, growing, harvest, description, terms) in VARIANTS:
        if not Crop.objects.filter(id=crop_id).exists():
            continue
        order_by_crop[crop_id] = order_by_crop.get(crop_id, 0) + 1
        CropVariant.objects.update_or_create(
            id=vid,
            defaults={
                "crop_id": crop_id,
                "name": name,
                "description": description,
                "growing_duration_days": growing,
                "harvest_window_days": harvest,
                "search_terms": terms,
                "sort_order": order_by_crop[crop_id],
                "is_active": True,
            },
        )


def unseed(apps, schema_editor):
    Crop = apps.get_model("plants", "Crop")
    CropVariant = apps.get_model("plants", "CropVariant")
    # PROTECT on Plant.variant means this raises if a farmer already recorded
    # a plant against a variety - which is the correct outcome for a reverse.
    CropVariant.objects.filter(id__in=[v[1] for v in VARIANTS]).delete()
    Crop.objects.filter(id__in=PLANTING_CALENDAR.keys()).update(
        planting_months=[],
        planting_caution_months=[],
        planting_reason="",
        planting_risk="",
        planting_caution_note="",
    )


class Migration(migrations.Migration):
    dependencies = [("plants", "0007_crop_planting_caution_months_and_more")]

    operations = [migrations.RunPython(seed, unseed)]

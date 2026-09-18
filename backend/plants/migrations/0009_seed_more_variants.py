"""
Extends the variety catalog to the remaining crops.

HOW THE NAMES WERE CHOSEN
-------------------------
Two tiers, and the difference is deliberate and visible in the data.

  NAMED CULTIVAR - used only where a variety is genuinely established in
  Philippine production and a farmer in Sorsogon would recognise the name:
  Magallanes pomelo, Maharlika rambutan, EVIARC Sweet jackfruit, Guapple,
  Red Lady / Solo / Sinta papaya, Smooth Cayenne / Queen / MD-2 pineapple,
  Cardinal grapes, Senorita banana, Ponkan mandarin.

  TYPE-LEVEL - used where naming a cultivar would be inventing precision:
  sweet vs sour carambola, yellow vs purple passion fruit, native vs
  large-fruited chico and guyabano, netted vs smooth-skinned melon. These
  are real distinctions a grower makes; they are just not cultivar names.

WHAT WAS DELIBERATELY LEFT ALONE
--------------------------------
Java plum (duhat) gets no varieties. It is a minor, largely unimproved
backyard crop here and there is no varietal split worth recording - a made-up
"Type A / Type B" would be padding, and this catalog is meant to be trusted.
Adding one later is an Admin edit, not a migration.

DAY COUNTS
----------
Same basis and same caveat as migration 0008: conventional Philippine field
figures, counted from planting to the start of the harvest window, indicative
rather than calibrated against Layuan Farm's own records, and editable in
Django admin. For the tree crops these are time to first bearing, which moves
a great deal with planting material - a grafted seedling bears years ahead of
one grown from seed - so the split between grafted and seedling stock is
called out in the descriptions where it dominates the number.

THREE MORE CONFLATIONS FIXED
----------------------------
As with ube/kamote in 0008, three catalog rows hold plants that are not the
same thing, and recording the variety is what makes the harvest window right:
  - rambutan-lychee: lychee takes years longer to come into bearing.
  - lemongrass: the "leafy greens" half is pechay and kangkong, ready in
    weeks, against a tanglad clump that is cut for years.
  - pomelo: grapefruit is a different fruit from suha.
"""

from django.db import migrations

# crop_id, variant_id, name, growing_days, harvest_days, description, search_terms
VARIANTS = [
    # ------------------------------------------------------------ pineapple
    ("pineapple", "pineapple-queen", "Queen (Formosa)", 450, 30,
     "Smaller, crisper and sweeter than Cayenne, and the earliest to fruit. The usual backyard and fresh-market pineapple.",
     ["queen", "formosa", "native", "pinya"]),
    ("pineapple", "pineapple-smooth-cayenne", "Smooth Cayenne", 540, 30,
     "The large canning-industry standard, high in juice and acid. Spineless leaves make it easier to work among.",
     ["cayenne", "smooth cayenne", "hawaiian"]),
    ("pineapple", "pineapple-md2", "MD-2 (Gold)", 510, 30,
     "Modern low-acid hybrid bred for sweetness and shelf life; the export 'gold' pineapple.",
     ["md2", "md-2", "gold", "del monte gold"]),

    # --------------------------------------------------------------- papaya
    ("papaya", "papaya-red-lady", "Red Lady", 255, 60,
     "Taiwanese F1 hybrid, red-fleshed and quick to bear on a short trunk. Widely planted here for its ringspot tolerance.",
     ["red lady", "hybrid", "papaya"]),
    ("papaya", "papaya-sinta", "Sinta", 240, 60,
     "UPLB-bred F1 hybrid selected for ringspot virus tolerance - the usual reason a papaya block fails locally.",
     ["sinta", "uplb", "hybrid"]),
    ("papaya", "papaya-solo", "Solo (Hawaiian)", 300, 60,
     "Small single-serving fruit with firm sweet flesh. Slower to bear than the hybrids but keeps well.",
     ["solo", "hawaiian"]),
    ("papaya", "papaya-cavite-special", "Cavite Special", 285, 60,
     "Large-fruited local selection grown mainly for green papaya and cooking rather than dessert.",
     ["cavite special", "native", "green papaya"]),

    # -------------------------------------------------- passion fruit (2 f.)
    ("passion-fruit", "passion-fruit-yellow", "Yellow (Golden)", 330, 90,
     "The lowland form. More vigorous, more tolerant of heat and soil disease, and more acid - the safer choice in Bulan.",
     ["yellow", "golden", "flavicarpa"]),
    ("passion-fruit", "passion-fruit-purple", "Purple", 365, 90,
     "Smaller, sweeter and more aromatic, but it prefers cooler upland sites and is fussier about soil disease.",
     ["purple", "edulis"]),

    # ---------------------------------------------------------------- guava
    ("guava", "guava-guapple", "Guapple (Apple Guava)", 550, 120,
     "Large, crisp, mild apple-shaped guava, usually grafted and bagged on the tree. Bears well before a seedling would.",
     ["guapple", "apple guava", "bayabas"]),
    ("guava", "guava-native", "Native Bayabas", 730, 120,
     "Small, intensely aromatic seedling guava. Slower and seedier, but far hardier and the one used for leaves.",
     ["native", "bayabas", "seedling"]),

    # --------------------------------------------------- pomelo / grapefruit
    ("pomelo", "pomelo-magallanes", "Magallanes", 1095, 120,
     "The flagship Philippine pomelo - pink-fleshed, sweet, low in bitterness. Grafted stock bears in about three years.",
     ["magallanes", "suha", "davao"]),
    ("pomelo", "pomelo-siamese", "Siamese / Amoy Mantan", 1095, 120,
     "White to pale-fleshed pomelo, larger and more acid than Magallanes, with a thicker rind that stores well.",
     ["siamese", "amoy mantan", "suha"]),
    ("pomelo", "grapefruit", "Grapefruit", 1200, 120,
     "A different fruit from suha: smaller, markedly more bitter, and slower to come into bearing here.",
     ["grapefruit", "pink grapefruit"]),

    # ------------------------------------------- rambutan / lychee (SPLIT)
    ("rambutan-lychee", "rambutan-maharlika", "Rambutan (Maharlika)", 1460, 45,
     "The standard Philippine rambutan - sweet, freestone, deep red. Suited to the humid Bicol climate.",
     ["maharlika", "rambutan"]),
    ("rambutan-lychee", "rambutan-rongrien", "Rambutan (Rongrien)", 1400, 45,
     "Thai selection with firmer flesh and a longer shelf life; picked slightly earlier than Maharlika.",
     ["rongrien", "rambutan", "thai"]),
    ("rambutan-lychee", "lychee-mauritius", "Lychee (Mauritius)", 1825, 30,
     "A different tree from rambutan and years slower to bear. Flowers unreliably in the lowland tropics - it wants a cool dry spell.",
     ["lychee", "litsias", "mauritius"]),

    # ------------------------------------------------------------ jackfruit
    ("jackfruit", "jackfruit-eviarc-sweet", "EVIARC Sweet", 1095, 90,
     "The best-known Philippine selection: crisp, sweet, deep-orange flesh. Grafted stock bears years ahead of seedlings.",
     ["eviarc", "eviarc sweet", "langka"]),
    ("jackfruit", "jackfruit-native", "Native Langka (Seedling)", 1460, 90,
     "Seedling tree of unknown parentage. Slower and variable in quality, but vigorous and long-lived.",
     ["native", "langka", "seedling"]),

    # ---------------------------------------------------------------- cacao
    ("cacao", "cacao-trinitario", "Trinitario", 1095, 150,
     "The Criollo x Forastero hybrid group most Philippine planting material belongs to, including clones like UF-18 and BR-25. Grafted stock pods in about three years.",
     ["trinitario", "uf-18", "br-25", "cocoa"]),
    ("cacao", "cacao-forastero", "Forastero", 1200, 150,
     "The hardy, high-yielding bulk group. Less aromatic than the others but the most tolerant of disease pressure.",
     ["forastero", "bulk", "cocoa"]),
    ("cacao", "cacao-criollo", "Criollo", 1200, 120,
     "The fine-flavour group, and the most demanding: low yielding and notably disease-prone in a wet climate.",
     ["criollo", "fine flavour", "cocoa"]),

    # --------------------------------------------------------------- grapes
    ("grapes", "grapes-cardinal", "Red Cardinal", 730, 60,
     "The Philippine table grape, grown in La Union and Cebu. Large red berries on a vigorous vine.",
     ["cardinal", "red cardinal", "ubas"]),
    ("grapes", "grapes-black-ribier", "Black Ribier", 760, 60,
     "Large blue-black berries, later and slightly slower to establish than Cardinal.",
     ["ribier", "black ribier", "ubas"]),

    # ------------------------------------------------------------ starfruit
    ("starfruit", "starfruit-sweet", "Sweet (Dessert) Type", 730, 90,
     "Larger, thick-ribbed, low-acid fruit eaten fresh out of hand.",
     ["sweet", "dessert", "balimbing"]),
    ("starfruit", "starfruit-sour", "Sour (Cooking) Type", 700, 90,
     "Smaller and sharply acid. Grown for souring stews, pickling and preserves rather than eating raw.",
     ["sour", "cooking", "balimbing", "native"]),

    # ------------------------------------------------- soursop (type-level)
    ("soursop", "soursop-native", "Native Guyabano", 1095, 90,
     "Seedling tree with variable fruit size. Hardy and the usual backyard form.",
     ["native", "guyabano", "seedling"]),
    ("soursop", "soursop-large-fruited", "Large-fruited Selection", 1050, 90,
     "Grafted selection chosen for bigger, more uniform fruit and earlier bearing.",
     ["large", "grafted", "guyabano"]),

    # -------------------------------------------------- sugar apple / atis
    ("sugar-apple", "atis-native", "Native Atis", 1095, 60,
     "Small, very sweet, heavily seeded fruit on a compact tree. Hardy and reliable.",
     ["native", "atis"]),
    ("sugar-apple", "atis-thai-large", "Thai Large-fruited", 1000, 60,
     "Introduced selection with noticeably larger fruit and fewer seeds; grafted stock bears earlier.",
     ["thai", "large", "atis"]),

    # ------------------------------------------------- sapodilla / chico
    ("sapodilla", "chico-native", "Native Chico", 1825, 120,
     "Small, sweet, grainy brown fruit on a slow, very long-lived seedling tree.",
     ["native", "chico", "seedling"]),
    ("sapodilla", "chico-ponderosa", "Ponderosa (Large-fruited)", 1700, 120,
     "Selection with much larger oval fruit, grafted so it bears sooner than a seedling chico.",
     ["ponderosa", "large", "chico"]),

    # -------------------------------------------------------------- avocado
    ("avocado", "avocado-cardinal", "Cardinal", 1460, 90,
     "Philippine-selected variety, green-skinned and early bearing; among the more reliable choices in lowland heat.",
     ["cardinal", "avocado"]),
    ("avocado", "avocado-semil-34", "Semil-34", 1500, 90,
     "Large, thick-skinned, late-season fruit. Vigorous but slower to come into bearing than Cardinal.",
     ["semil", "semil-34", "avocado"]),
    ("avocado", "avocado-seedling", "Seedling (Native)", 1825, 90,
     "Grown from seed, so the fruit will not match the parent and bearing is years later. Cheap and hardy.",
     ["seedling", "native", "avocado"]),

    # ------------------------------------------------------------- melon
    ("cantaloupe", "melon-cantaloupe", "Cantaloupe (Netted)", 85, 21,
     "Orange-fleshed, net-skinned muskmelon. Slips from the vine when ripe, which makes picking easy to judge.",
     ["cantaloupe", "muskmelon", "netted", "melon"]),
    ("cantaloupe", "melon-honeydew", "Honeydew (Smooth-skinned)", 95, 21,
     "Pale green flesh and a smooth rind. Later than cantaloupe and needs a drier ripening spell to sweeten.",
     ["honeydew", "smooth", "melon"]),

    # -------------------------------------------------------------- ginger
    ("ginger", "ginger-native", "Native Luya", 240, 30,
     "Small, fibrous, intensely pungent rhizome. The traditional local type, hardier and preferred for salabat.",
     ["native", "luya", "imugan"]),
    ("ginger", "ginger-hawaiian", "Hawaiian (Large)", 270, 30,
     "Much larger, plumper, milder rhizome bred for fresh-market volume. Slower to bulk and hungrier for fertility.",
     ["hawaiian", "large", "luya"]),

    # ------------------------------------- lemongrass / leafy greens (SPLIT)
    ("lemongrass", "lemongrass-tanglad", "Lemongrass (Tanglad)", 120, 60,
     "A perennial clump cut for stalks over several years, not a crop that is replanted each season.",
     ["tanglad", "lemongrass", "salai"]),
    ("lemongrass", "greens-pechay", "Pechay", 40, 21,
     "Fast leafy green ready about six weeks from sowing - a different crop entirely from a tanglad clump.",
     ["pechay", "bok choy", "greens"]),
    ("lemongrass", "greens-kangkong", "Kangkong", 45, 60,
     "Water spinach, cut repeatedly from the same planting. Thrives in the wet months when other greens rot.",
     ["kangkong", "water spinach", "greens"]),
    ("lemongrass", "greens-alugbati", "Alugbati", 50, 60,
     "Malabar spinach, a heat-loving climbing green that keeps producing through the hottest months.",
     ["alugbati", "malabar spinach", "greens"]),

    # ------------------------------------ additions to crops already covered
    ("banana", "banana-senorita", "Senorita", 330, 30,
     "Very small, sweet finger banana on a short plant. The quickest to bunch and the least wind-exposed of the four.",
     ["senorita", "monkoy", "banana"]),
    ("lettuce-cabbage", "pechay-baguio", "Pechay Baguio (Napa)", 70, 21,
     "Napa or Chinese cabbage - a looser, more heat-forgiving head than repolyo, though still a cool-season crop.",
     ["pechay baguio", "napa", "chinese cabbage", "wombok"]),
    ("orange-calamansi", "ponkan-mandarin", "Ponkan (Mandarin)", 900, 60,
     "Loose-skinned sweet mandarin. Larger and sweeter than calamansi, and slower to come into bearing.",
     ["ponkan", "mandarin", "dalanghita"]),
    ("eggplant", "eggplant-long-green", "Long Green", 105, 45,
     "Pale green long-fruited type, common in native plantings and generally more tolerant of local pest pressure.",
     ["long green", "native", "talong"]),
    ("tomato", "tomato-cherry", "Cherry Tomato", 75, 40,
     "Small-fruited and quick, with much better tolerance of heat and wet than a large-fruited hybrid.",
     ["cherry", "kamatis"]),
]


def seed(apps, schema_editor):
    Crop = apps.get_model("plants", "Crop")
    CropVariant = apps.get_model("plants", "CropVariant")

    # Continue each crop's existing numbering rather than restarting at 1, so
    # varieties seeded in 0008 keep their place in the picker.
    next_order: dict[str, int] = {}
    for (crop_id, vid, name, growing, harvest, description, terms) in VARIANTS:
        if not Crop.objects.filter(id=crop_id).exists():
            continue
        if crop_id not in next_order:
            existing = CropVariant.objects.filter(crop_id=crop_id).count()
            next_order[crop_id] = existing + 1
        else:
            next_order[crop_id] += 1
        CropVariant.objects.update_or_create(
            id=vid,
            defaults={
                "crop_id": crop_id,
                "name": name,
                "description": description,
                "growing_duration_days": growing,
                "harvest_window_days": harvest,
                "search_terms": terms,
                "sort_order": next_order[crop_id],
                "is_active": True,
            },
        )


def unseed(apps, schema_editor):
    CropVariant = apps.get_model("plants", "CropVariant")
    # PROTECT on Plant.variant means this raises if a farmer already recorded
    # a plant against one of these - the correct outcome for a reverse.
    CropVariant.objects.filter(id__in=[v[1] for v in VARIANTS]).delete()


class Migration(migrations.Migration):
    dependencies = [("plants", "0008_seed_variants_and_planting_windows")]

    operations = [migrations.RunPython(seed, unseed)]

from django.db import migrations

# Mirrors the frontend catalog in src/lib/crops.ts, which becomes a thin
# fallback now that MySQL is the source of truth.
#
# ⚠️ growing_duration_days / harvest_window_days are INDICATIVE placeholders
# carried over from the mock data. They exist so the harvest-window
# calculation has something to work from and are NOT verified agronomic
# figures for Layuan Farm. An Admin should replace them with real values
# (PhilRice / DA references, or the farm's own records) — the Crop model is
# editable in Django admin precisely so that requires no code change.
#
# Emoji are visual aids only; the crop name is always shown alongside them.
CROPS = [
    # id, name, category, emoji, growing_days, harvest_days, description, search_terms
    ("starfruit", "Starfruit (Carambola)", "fruit", "⭐", 730, 90,
     "A tropical fruit tree that bears ridged, star-shaped fruit.", ["carambola", "balimbing"]),
    ("guava", "Guava", "fruit", "🍐", 730, 120,
     "A hardy fruit tree that tolerates a wide range of soils.", ["bayabas"]),
    ("passion-fruit", "Passion Fruit", "fruit", "🟣", 365, 90,
     "A climbing vine crop that needs trellising and steady moisture.", []),
    ("grapes", "Grapes", "fruit", "🍇", 730, 60,
     "A trellised vine crop requiring pruning and good drainage.", ["ubas"]),
    ("cantaloupe", "Cantaloupe / Melon", "fruit", "🍈", 85, 21,
     "A short-season vining melon grown on warm, well-drained soil.", ["melon", "muskmelon"]),
    ("watermelon", "Watermelon", "fruit", "🍉", 90, 21,
     "A sprawling vine crop needing space, warmth, and steady water.", ["pakwan"]),
    ("orange-calamansi", "Orange / Calamansi", "fruit", "🍊", 730, 120,
     "A citrus tree valued for its long fruiting window.", ["calamansi", "citrus", "kalamansi"]),
    ("banana", "Banana", "fruit", "🍌", 300, 30,
     "A fast-establishing perennial producing fruit in bunches.", ["saging"]),
    ("pineapple", "Pineapple", "fruit", "🍍", 540, 30,
     "A drought-tolerant bromeliad grown from suckers or crowns.", ["pinya"]),
    ("soursop", "Soursop / Custard Apple", "fruit", "🥭", 1095, 90,
     "A small tropical tree bearing large, soft-fleshed fruit.", ["guyabano", "custard apple"]),
    ("java-plum", "Java Plum (Duhat)", "fruit", "🫐", 1460, 60,
     "A large tree producing dark, astringent seasonal fruit.", ["duhat", "jamun"]),
    ("papaya", "Papaya", "fruit", "🧡", 270, 60,
     "A fast-growing fruit tree suited to Layuan's warm, humid climate.", ["papaya"]),
    ("pomelo", "Pomelo / Grapefruit", "fruit", "🍊", 1095, 120,
     "A large citrus tree with thick-rinded fruit.", ["suha", "grapefruit"]),
    ("sapodilla", "Sapodilla (Chico)", "fruit", "🟤", 1825, 120,
     "A slow-growing tree bearing sweet, grainy brown fruit.", ["chico", "chiku"]),
    ("rambutan-lychee", "Rambutan / Lychee", "fruit", "🔴", 1460, 45,
     "Humid-climate trees with a short, concentrated fruiting season.", ["lychee", "litsias"]),
    ("sugar-apple", "Sugar Apple (Atis)", "fruit", "🟢", 1095, 60,
     "A compact tree bearing segmented, sweet-fleshed fruit.", ["atis", "sweetsop"]),
    ("jackfruit", "Jackfruit", "fruit", "🥝", 1460, 90,
     "A large tree producing the heaviest tree-borne fruit.", ["langka"]),
    ("avocado", "Avocado", "fruit", "🥑", 1460, 90,
     "An evergreen tree needing well-drained soil and wind shelter.", []),
    ("cacao", "Cacao", "fruit", "🫘", 1460, 150,
     "A shade-tolerant understory tree grown for its pods.", ["cocoa"]),

    ("pepper", "Green Chili Pepper", "vegetable", "🌶️", 95, 40,
     "A warm-season crop prone to pest pressure during fruiting.",
     ["sili", "siling berde", "pepper"]),
    ("tomato", "Tomato", "vegetable", "🍅", 85, 30,
     "A high-yield vegetable crop, sensitive to overwatering and blight.", ["kamatis"]),
    ("lettuce-cabbage", "Lettuce / Cabbage", "vegetable", "🥬", 70, 21,
     "Cool-season leafy heads best grown in the cooler months.", ["repolyo", "letsugas"]),
    ("eggplant", "Eggplant", "vegetable", "🍆", 110, 45,
     "A hardy, heat-tolerant vegetable with an extended harvest window.", ["talong"]),
    ("red-chili", "Red Chili Pepper", "vegetable", "🌶️", 100, 45,
     "A hot pepper left on the plant to ripen fully red.", ["sili", "siling labuyo"]),
    ("mushroom", "Mushroom", "vegetable", "🍄", 30, 14,
     "Grown on prepared substrate in a shaded, humid environment.", ["kabute", "oyster"]),
    ("purple-sweet-potato", "Purple Sweet Potato (Ube)", "vegetable", "🍠", 150, 30,
     "A root crop grown from vine cuttings in loose, loamy soil.", ["ube", "kamote", "yam"]),
    ("ginger", "Ginger", "vegetable", "🫚", 240, 30,
     "A rhizome crop that prefers partial shade and rich soil.", ["luya"]),
    ("lemongrass", "Lemongrass / Leafy Greens", "vegetable", "🌿", 120, 60,
     "Cut-and-come-again clumping greens with repeat harvests.", ["tanglad", "greens"]),
    ("radish-jicama", "Radish / Jicama", "vegetable", "🥕", 60, 21,
     "Quick-maturing root crops grown in loose, stone-free soil.", ["labanos", "singkamas"]),
    ("corn", "Corn", "vegetable", "🌽", 100, 21,
     "A staple cereal crop planted in blocks for good pollination.", ["mais"]),
]


def seed_crops(apps, schema_editor):
    Crop = apps.get_model("plants", "Crop")
    for (crop_id, name, category, emoji, growing, harvest, description, terms) in CROPS:
        Crop.objects.update_or_create(
            id=crop_id,
            defaults={
                "name": name,
                "category": category,
                "emoji": emoji,
                "growing_duration_days": growing,
                "harvest_window_days": harvest,
                "description": description,
                "search_terms": terms,
                "is_active": True,
            },
        )


def unseed_crops(apps, schema_editor):
    Crop = apps.get_model("plants", "Crop")
    Crop.objects.filter(id__in=[c[0] for c in CROPS]).delete()


class Migration(migrations.Migration):
    dependencies = [("plants", "0001_initial")]

    operations = [migrations.RunPython(seed_crops, unseed_crops)]

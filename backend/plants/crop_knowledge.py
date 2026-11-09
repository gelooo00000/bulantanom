"""
BulanTanom's crop reference: what each crop looks like healthy, its warning
signs, and the pests and diseases common on Philippine smallholder farms.

Given to both Gemini checks (the photo check and the risk evaluation) so they
judge a plant against real crop knowledge rather than size alone. It is
general field guidance, not a diagnosis: the models are still told to keep
what they SEE apart from what MIGHT cause it.

Keyed by Crop.id. A crop missing here simply gets the general guide only.
"""

from __future__ import annotations

# How alive the plant looks, worst last. The photo check reports one of these
# and Django acts on the two worst (see VITALITY_SEVERE).
VITALITY = ("thriving", "normal", "stressed", "severe_decline", "dying_or_dead")
VITALITY_SEVERE = ("severe_decline", "dying_or_dead")

GENERAL_GUIDE = {
    "judge_condition_before_size": (
        "A plant's condition matters more than its size. A full-size plant "
        "that is rotting, collapsed or mostly dead is NOT growing as expected: "
        "it has stopped growing. Size for age only matters for a living, "
        "healthy-looking plant."
    ),
    "vitality_scale": {
        "thriving": "firm, upright, deep even colour, new growth visible",
        "normal": "healthy overall; a few old or marked leaves are normal",
        "stressed": (
            "some wilting, yellowing, spots, holes or slow growth, but most of "
            "the plant is still green and firm"
        ),
        "severe_decline": (
            "much of the plant is affected: widespread yellow or brown leaves, "
            "heavy wilting that does not recover, large rotten or mushy parts, "
            "heavy pest damage, or a collapsing stem"
        ),
        "dying_or_dead": (
            "most of the plant is brown, black, dried out, slimy, mushy or "
            "collapsed; little or no living green tissue; it will not recover"
        ),
    },
    "rot_and_decay_signs": [
        "brown or black, soft, wet or slimy tissue",
        "a collapsed or hollow stem or crown",
        "a bad smell or oozing liquid",
        "leaves dried, papery and brown all over",
        "white, grey or green mould covering parts of the plant",
    ],
    "philippine_wet_season": (
        "In Bicol's long rainy months, waterlogged soil quickly causes root, "
        "stem and fruit rots and leaf diseases; in hot dry spells, wilting "
        "and leaf scorch are common."
    ),
}

CROPS: dict[str, dict] = {
    "lettuce-cabbage": {
        "healthy": "crisp, firm, evenly green (or the variety's red) leaves; cabbage forms a tight, heavy head",
        "warning_signs": [
            "wilting that does not recover in the cool of the morning",
            "brown, soft, slimy leaves or a rotting base or head (soft rot)",
            "brown, dry leaf edges (tip burn)",
            "small holes or 'windowpane' damage on leaves",
            "a tall flowering stalk forming early (bolting) in heat",
        ],
        "pests": ["diamondback moth caterpillars", "cabbage worms", "aphids", "cutworms", "flea beetles"],
        "diseases": ["bacterial soft rot", "black rot (cabbage)", "downy mildew", "damping-off of seedlings"],
        "care": "needs steady moisture but not waterlogging; suffers in heat; rots fast in standing water",
    },
    "tomato": {
        "healthy": "dark green, upright plant; flowers then green fruit that ripen red",
        "warning_signs": [
            "sudden wilting of a green plant (bacterial wilt)",
            "brown spots with rings on older leaves (early blight)",
            "dark, greasy patches on leaves and fruit (late blight)",
            "curled, yellow, small leaves on a stunted plant (leaf curl virus)",
            "black, sunken patch at the fruit's bottom (blossom-end rot)",
        ],
        "pests": ["tomato fruitworm", "whiteflies", "leaf miners", "aphids", "cutworms"],
        "diseases": ["bacterial wilt", "early blight", "late blight", "tomato leaf curl virus", "fusarium wilt"],
        "care": "needs staking, well-drained soil and even watering; wet leaves spread blight",
    },
    "eggplant": {
        "healthy": "broad green leaves, purple flowers, glossy fruit",
        "warning_signs": [
            "wilting shoot tips or holes in fruit (fruit and shoot borer)",
            "sudden wilting of the whole plant (bacterial wilt)",
            "yellow, curled leaf edges (leafhopper)",
            "rotting, sunken spots on fruit (phomopsis blight)",
        ],
        "pests": ["eggplant fruit and shoot borer", "leafhoppers", "aphids", "mites", "whiteflies"],
        "diseases": ["bacterial wilt", "phomopsis blight", "little leaf"],
        "care": "remove and destroy bored shoots and fruit; avoid waterlogging",
    },
    "pepper": {
        "healthy": "glossy green leaves, white flowers, firm fruit",
        "warning_signs": [
            "curled, puckered leaves (thrips, mites, or virus)",
            "mottled yellow-green leaves on a stunted plant (mosaic virus)",
            "sunken dark spots on fruit (anthracnose)",
            "sudden wilting (bacterial wilt)",
        ],
        "pests": ["thrips", "aphids", "broad mites", "fruit flies"],
        "diseases": ["anthracnose", "bacterial wilt", "mosaic and leaf curl viruses", "damping-off"],
        "care": "well-drained soil; remove virus-curled plants so they do not spread",
    },
    "red-chili": {
        "healthy": "glossy green leaves, white flowers, firm fruit turning red",
        "warning_signs": [
            "curled, puckered leaves (thrips, mites, or virus)",
            "sunken dark spots on fruit (anthracnose)",
            "sudden wilting (bacterial wilt)",
        ],
        "pests": ["thrips", "aphids", "broad mites", "fruit flies"],
        "diseases": ["anthracnose", "bacterial wilt", "chili leaf curl virus"],
        "care": "well-drained soil; pick and destroy rotting fruit",
    },
    "corn": {
        "healthy": "tall upright stalk, broad green leaves, tassels then filled ears",
        "warning_signs": [
            "ragged holes and sawdust-like droppings in the whorl (fall armyworm)",
            "holes in stalks, broken tassels (Asian corn borer)",
            "pale striped leaves with white down underneath (downy mildew)",
            "rust-coloured pustules on leaves (rust)",
            "rolled, grey-green leaves in the heat (drought stress)",
        ],
        "pests": ["fall armyworm", "Asian corn borer", "cutworms", "aphids"],
        "diseases": ["downy mildew", "rust", "leaf blight", "stalk rot"],
        "care": "check the whorl for armyworm every week; waterlogging yellows young corn",
    },
    "ginger": {
        "healthy": "upright green leafy shoots; firm, fragrant rhizome",
        "warning_signs": [
            "yellowing from the leaf tips down, drying shoots (rhizome rot)",
            "soft, smelly, water-soaked rhizome",
            "sudden wilting of shoots (bacterial wilt)",
        ],
        "pests": ["shoot borer", "rhizome scale", "nematodes"],
        "diseases": ["rhizome (soft) rot", "bacterial wilt", "leaf spot"],
        "care": "must have well-drained soil; rots quickly in waterlogged beds",
    },
    "lemongrass": {
        "healthy": "dense clump of upright, green, fragrant blades (leafy greens: tender green leaves)",
        "warning_signs": [
            "rusty brown streaks on blades (rust)",
            "brown, rotting base of the clump",
            "holes in leafy greens (flea beetles, caterpillars)",
        ],
        "pests": ["aphids", "flea beetles", "caterpillars"],
        "diseases": ["rust", "leaf spot", "root and base rot in wet soil"],
        "care": "tolerates heat; avoid standing water around the clump",
    },
    "mushroom": {
        "healthy": "firm caps of even colour; clean, moist substrate bags",
        "warning_signs": [
            "green mould on the substrate (Trichoderma)",
            "slimy, sticky, yellow-brown caps (bacterial blotch)",
            "dry, cracked caps (too dry)",
            "long thin stems with small caps (too little fresh air)",
            "tiny flies around the bags",
        ],
        "pests": ["mushroom flies (sciarids)", "mites"],
        "diseases": ["green mould", "bacterial blotch"],
        "care": "needs humidity, shade and fresh air; remove contaminated bags at once",
    },
    "purple-sweet-potato": {
        "healthy": "spreading green or purple-tinged vines covering the ground",
        "warning_signs": [
            "tunnels and bad smell in tubers, holes at stem base (sweet potato weevil)",
            "curled, scabby leaves and stems (scab)",
            "yellowing vines in waterlogged soil",
        ],
        "pests": ["sweet potato weevil", "leaf-eating caterpillars"],
        "diseases": ["scab", "stem and tuber rot", "viral leaf curl"],
        "care": "hill soil over cracks to keep weevils from tubers; avoid waterlogging",
    },
    "radish-jicama": {
        "healthy": "fresh green leaves; firm, smooth root",
        "warning_signs": [
            "many small holes in leaves (flea beetles)",
            "split, woody or soft rotting roots",
            "yellowing, wilting leaves in soaked soil",
        ],
        "pests": ["flea beetles", "aphids", "cutworms", "root maggots"],
        "diseases": ["soft rot", "leaf spot", "damping-off"],
        "care": "even moisture prevents splitting; loose, drained soil",
    },
    "watermelon": {
        "healthy": "vigorous green vines, yellow flowers, firm growing fruit",
        "warning_signs": [
            "vines wilting in daytime then collapsing (fusarium wilt)",
            "white powder on leaves (powdery mildew)",
            "yellow angular patches on leaves (downy mildew)",
            "dark sunken spots on fruit (anthracnose)",
            "stings and rot in young fruit (fruit fly)",
        ],
        "pests": ["fruit flies", "aphids", "thrips", "squash beetles"],
        "diseases": ["fusarium wilt", "anthracnose", "downy and powdery mildew", "gummy stem blight"],
        "care": "keep fruit off wet soil; avoid overhead watering late in the day",
    },
    "cantaloupe": {
        "healthy": "vigorous green vines, netted fruit filling out",
        "warning_signs": [
            "vines wilting then collapsing (fusarium wilt)",
            "white powder or yellow patches on leaves (mildews)",
            "rotting, stung fruit (fruit fly)",
        ],
        "pests": ["fruit flies", "aphids", "thrips"],
        "diseases": ["fusarium wilt", "downy and powdery mildew", "gummy stem blight"],
        "care": "well-drained soil; keep fruit dry",
    },
    "banana": {
        "healthy": "tall pseudostem, broad green leaves unfurling from the top",
        "warning_signs": [
            "short, bunched, narrow upright leaves with dark streaks (bunchy top virus)",
            "older leaves yellowing and collapsing around the stem, split stem base (fusarium / Panama wilt)",
            "streaks and spots drying the leaves (Sigatoka)",
            "tunnels in the corm, plant toppling (banana weevil)",
        ],
        "pests": ["banana weevil", "aphids (spread bunchy top)", "nematodes"],
        "diseases": ["banana bunchy top virus", "fusarium wilt", "Sigatoka leaf spot"],
        "care": "remove and destroy bunchy-top plants at once; good drainage",
    },
    "papaya": {
        "healthy": "straight trunk, crown of large green leaves, fruit along the trunk",
        "warning_signs": [
            "mottled, yellow, distorted leaves and ring spots on fruit (ringspot virus)",
            "white cottony insects on leaves and fruit (mealybugs)",
            "rotting stem base, plant toppling (root and stem rot in wet soil)",
            "sunken spots on ripening fruit (anthracnose)",
        ],
        "pests": ["papaya mealybug", "mites", "fruit flies", "aphids (spread virus)"],
        "diseases": ["papaya ringspot virus", "root and stem rot", "anthracnose"],
        "care": "very sensitive to waterlogging; a few days of standing water can kill it",
    },
    "pineapple": {
        "healthy": "rosette of stiff, spiky green to reddish leaves",
        "warning_signs": [
            "reddish, wilting leaves with drooping tips (mealybug wilt)",
            "rotting, smelly heart that pulls out easily (heart rot)",
        ],
        "pests": ["pineapple mealybug", "scale insects"],
        "diseases": ["mealybug wilt", "heart and root rot"],
        "care": "tolerates drought; heart rot in waterlogged soil",
    },
    "orange-calamansi": {
        "healthy": "glossy dark-green leaves, fragrant flowers, firm fruit",
        "warning_signs": [
            "yellow blotchy leaves, lopsided bitter fruit (citrus greening / HLB)",
            "silvery winding trails in young leaves (leaf miner)",
            "raised corky spots on leaves and fruit (canker)",
            "gum oozing from the trunk (gummosis)",
        ],
        "pests": ["citrus psyllid", "leaf miner", "scale insects", "aphids", "fruit flies"],
        "diseases": ["citrus greening (HLB)", "canker", "gummosis", "sooty mould"],
        "care": "well-drained soil; greening has no cure, remove infected trees",
    },
    "pomelo": {
        "healthy": "glossy dark-green leaves, large firm fruit",
        "warning_signs": [
            "yellow blotchy leaves, misshapen fruit (citrus greening / HLB)",
            "raised corky spots (canker)",
            "gum oozing from the trunk (gummosis)",
        ],
        "pests": ["citrus psyllid", "leaf miner", "fruit borer", "scale insects"],
        "diseases": ["citrus greening (HLB)", "canker", "gummosis"],
        "care": "well-drained soil; remove greening-infected trees",
    },
    "avocado": {
        "healthy": "dense green canopy of leathery leaves",
        "warning_signs": [
            "small, pale, wilting leaves and branch dieback (root rot)",
            "dark sunken spots on leaves and fruit (anthracnose)",
        ],
        "pests": ["scale insects", "fruit borers", "mites"],
        "diseases": ["phytophthora root rot", "anthracnose"],
        "care": "cannot stand waterlogging; plant on raised ground",
    },
    "cacao": {
        "healthy": "glossy leaves, small flowers on the trunk, pods ripening",
        "warning_signs": [
            "brown spreading rot on pods (black pod)",
            "holes and uneven ripening of pods (cacao pod borer)",
            "yellow leaves with green spots and dieback (vascular streak dieback)",
        ],
        "pests": ["cacao pod borer", "mirid bugs", "mealybugs"],
        "diseases": ["black pod rot", "vascular streak dieback"],
        "care": "needs partial shade; remove rotting pods often",
    },
    "jackfruit": {
        "healthy": "large tree, dark-green leathery leaves, big fruit on trunk and branches",
        "warning_signs": [
            "rotting young fruit (fruit rot)",
            "holes and sawdust on trunk or shoots (borers)",
            "stung, rotting fruit (fruit fly)",
        ],
        "pests": ["fruit flies", "shoot and fruit borers", "mealybugs"],
        "diseases": ["fruit rot", "pink disease on branches"],
        "care": "bag fruit against fruit flies; avoid waterlogging",
    },
    "java-plum": {
        "healthy": "dense evergreen canopy, glossy leaves",
        "warning_signs": ["leaf spots and leaf drop", "rotting, stung fruit"],
        "pests": ["fruit flies", "leaf-eating caterpillars"],
        "diseases": ["leaf spot", "anthracnose"],
        "care": "hardy tree; young trees need watering in dry spells",
    },
    "rambutan-lychee": {
        "healthy": "dense green canopy, flushes of new reddish leaves",
        "warning_signs": [
            "white cottony insects on fruit and twigs (mealybugs)",
            "white powder on flowers and young fruit (powdery mildew)",
            "fruit borer holes",
        ],
        "pests": ["mealybugs", "fruit borers", "scale insects"],
        "diseases": ["powdery mildew", "fruit rot"],
        "care": "needs water during flowering and fruiting; good drainage",
    },
    "guava": {
        "healthy": "green leaves, white flowers, firm green to yellow fruit",
        "warning_signs": [
            "stung, rotting fruit (fruit fly)",
            "dark sunken spots on fruit (anthracnose)",
            "wilting branches and leaf drop (guava wilt)",
        ],
        "pests": ["fruit flies", "scale insects", "mealybugs"],
        "diseases": ["anthracnose", "guava wilt"],
        "care": "bag fruit against fruit flies",
    },
    "sapodilla": {
        "healthy": "dense glossy evergreen leaves, brown fruit",
        "warning_signs": ["leaf spots", "stung, rotting fruit"],
        "pests": ["fruit flies", "leaf webbers"],
        "diseases": ["leaf spot", "sooty mould"],
        "care": "slow-growing and hardy",
    },
    "soursop": {
        "healthy": "glossy green leaves, spiny green fruit",
        "warning_signs": [
            "white cottony insects (mealybugs)",
            "dark rotting patches on fruit (anthracnose)",
            "bored fruit and seeds",
        ],
        "pests": ["mealybugs", "fruit borers", "seed borers"],
        "diseases": ["anthracnose", "fruit rot"],
        "care": "hand-pollinating helps fruit set",
    },
    "sugar-apple": {
        "healthy": "light-green leaves, knobbly green fruit",
        "warning_signs": ["white cottony insects (mealybugs)", "dark rotting fruit (anthracnose)"],
        "pests": ["mealybugs", "fruit borers"],
        "diseases": ["anthracnose", "fruit rot"],
        "care": "sheds leaves in dry season, which is normal",
    },
    "starfruit": {
        "healthy": "light-green leaflets, pink flowers, ridged fruit",
        "warning_signs": ["bored, rotting fruit", "leaf spots and leaf drop"],
        "pests": ["fruit flies", "fruit borers"],
        "diseases": ["anthracnose", "leaf spot"],
        "care": "bag fruit against fruit flies",
    },
    "grapes": {
        "healthy": "vigorous green vines on a trellis, clusters forming",
        "warning_signs": [
            "yellow oily spots, white down under leaves (downy mildew)",
            "white powder on leaves and berries (powdery mildew)",
            "dark sunken spots on berries and shoots (anthracnose)",
        ],
        "pests": ["mealybugs", "thrips", "beetles"],
        "diseases": ["downy mildew", "powdery mildew", "anthracnose"],
        "care": "wet season brings heavy mildew; prune for airflow",
    },
    "passion-fruit": {
        "healthy": "vigorous green vines, purple-white flowers, round fruit",
        "warning_signs": [
            "mottled, crinkled leaves and hard, misshapen fruit (woodiness virus)",
            "rotting stem at soil level, vine wilting (collar rot)",
            "stung fruit (fruit fly)",
        ],
        "pests": ["fruit flies", "aphids", "mites"],
        "diseases": ["passion fruit woodiness virus", "collar rot", "brown spot"],
        "care": "good drainage around the stem base",
    },
}


def knowledge_for(crop) -> dict:
    """The reference given to the AI for `crop`: its own entry plus the general guide."""
    return {
        "note": (
            "BulanTanom's general crop reference for Philippine smallholder farms. "
            "Use it to recognise what you see; never present a possible cause as certain."
        ),
        "general": GENERAL_GUIDE,
        "this_crop": CROPS.get(getattr(crop, "id", ""), {}),
    }

import { defineMessages } from "../define";

/** Add a Plant: the form, the crop pickers, the season advice, the preview. */
export const addPlant = defineMessages({
  "add.title": { en: "Add a Plant", fil: "Magdagdag ng Tanim", bik: "Magdugang san Tanom" },
  "add.description": {
    en: "Choose a crop and its planting date to start tracking it at Layuan Farm.",
    fil: "Pumili ng pananim at petsa ng pagtatanim para masubaybayan ito sa Layuan Farm.",
    bik: "Pili san tanom asin petsa san pagtanom para mabantayan ini sa Layuan Farm.",
  },
  "add.back": {
    en: "Back to My Plants",
    fil: "Bumalik sa Aking mga Tanim",
    bik: "Balik sa Mga Tanom Ko",
  },
  "add.loadingCrops": {
    en: "Loading crops…",
    fil: "Kinukuha ang mga pananim…",
    bik: "Kinukuha an mga tanom…",
  },
  "add.crop": { en: "Crop", fil: "Pananim", bik: "Tanom" },
  "add.variety": { en: "Variety", fil: "Uri", bik: "Klase" },
  "add.varietyHint": {
    en: "Optional. Varieties differ in how long they take, so naming one gives a more accurate harvest window.",
    fil: "Opsyonal. Magkakaiba ang tagal ng bawat uri, kaya mas tumpak ang panahon ng ani kung pipili ka ng isa.",
    bik: "Opsyonal. Magkalain-lain an kaluwagan san kada klase, kaya mas tama an panahon san ani kun mapili ka san saro.",
  },
  "add.typical": {
    en: "Typical growing period: {growing} days · harvest window {window} days",
    fil: "Karaniwang tagal ng paglaki: {growing} araw · panahon ng ani {window} araw",
    bik: "Normal na kaluwagan san pagdakula: {growing} adlaw · panahon san ani {window} adlaw",
  },
  "add.plantingDate": { en: "Planting date", fil: "Petsa ng pagtatanim", bik: "Petsa san pagtanom" },
  "add.selectDate": {
    en: "Select the planting date",
    fil: "Piliin ang petsa ng pagtatanim",
    bik: "Pilion an petsa san pagtanom",
  },
  "add.dateHint": {
    en: "Pick today, or a later date to plan a planting. A planned plant can be assessed from its planting date.",
    fil: "Piliin ang araw na ito, o isang susunod na petsa para magplano ng pagtatanim. Masusuri ang nakaplanong tanim simula sa petsa ng pagtatanim nito.",
    bik: "Pilion an adlaw na ini, o masunod na petsa para magplano san pagtanom. Pwede susihon an nakaplano na tanom poon sa petsa san pagtanom kaini.",
  },
  "add.duplicate": {
    en: "You already recorded {name} planted on this date. Add another only if this is a separate planting.",
    fil: "Naitala mo na ang {name} na itinanim sa petsang ito. Magdagdag lamang kung hiwalay itong pagtatanim.",
    bik: "Nairekord mo na an {name} na itinanom sa petsa na ini. Magdugang sana kun iba ini na pagtanom.",
  },
  "add.errorCrop": {
    en: "Please select a valid crop.",
    fil: "Pumili ng tamang pananim.",
    bik: "Pili tabi san tama na tanom.",
  },
  "add.errorDate": {
    en: "Please select a valid planting date.",
    fil: "Pumili ng tamang petsa ng pagtatanim.",
    bik: "Pili tabi san tama na petsa san pagtanom.",
  },
  "add.errorPast": {
    en: "Please pick today or a later planting date.",
    fil: "Piliin ang araw na ito o isang susunod na petsa.",
    bik: "Pilion tabi an adlaw na ini o masunod na petsa.",
  },
  "add.errorIntel": {
    en: "Unable to load crop information.",
    fil: "Hindi ma-load ang impormasyon ng pananim.",
    bik: "Dili ma-load an impormasyon san tanom.",
  },
  "add.errorSave": {
    en: "Unable to add this plant.",
    fil: "Hindi maidagdag ang tanim na ito.",
    bik: "Dili maidugang an tanom na ini.",
  },

  "add.preparing": {
    en: "Preparing crop intelligence…",
    fil: "Inihahanda ang impormasyon ng pananim…",
    bik: "Inaandam an impormasyon san tanom…",
  },
  "add.analyzing": { en: "Analyzing {crop}…", fil: "Sinusuri ang {crop}…", bik: "Sinususi an {crop}…" },
  "add.step1": {
    en: "Preparing crop information",
    fil: "Inihahanda ang impormasyon ng pananim",
    bik: "Inaandam an impormasyon san tanom",
  },
  "add.step2": {
    en: "Calculating harvest window",
    fil: "Kinakalkula ang panahon ng ani",
    bik: "Kinukwenta an panahon san ani",
  },
  "add.step3": {
    en: "Generating growing guidance",
    fil: "Gumagawa ng gabay sa pagpapalaki",
    bik: "Ginigibo an giya sa pagpadakula",
  },
  "add.skipWait": {
    en: "Add plant without waiting",
    fil: "Idagdag ang tanim nang hindi naghihintay",
    bik: "Idugang an tanom na dili na naghuhulat",
  },
  "add.adding": { en: "Adding plant…", fil: "Idinaragdag ang tanim…", bik: "Idinudugang an tanom…" },
  "add.laterGuidance": {
    en: "Guidance will still appear on the plant's page.",
    fil: "Lalabas pa rin ang gabay sa pahina ng tanim.",
    bik: "Makikita pa giyapon an giya sa pahina san tanom.",
  },

  "add.backToSelect": {
    en: "Back to crop selection",
    fil: "Bumalik sa pagpili ng pananim",
    bik: "Balik sa pagpili san tanom",
  },
  "add.reviewVariant": {
    en: "{crop} · review before adding this plant.",
    fil: "{crop} · suriin bago idagdag ang tanim na ito.",
    bik: "{crop} · hilingon anay bago idugang an tanom na ini.",
  },
  "add.review": {
    en: "Review the crop information before adding this plant.",
    fil: "Suriin ang impormasyon ng pananim bago idagdag ang tanim na ito.",
    bik: "Hilingon anay an impormasyon san tanom bago idugang an tanom na ini.",
  },
  "add.window": {
    en: "Expected harvest window",
    fil: "Inaasahang panahon ng ani",
    bik: "Inaasahan na panahon san ani",
  },
  "add.windowPlanted": {
    en: "Planted {date} · typical growing period {n} days",
    fil: "Itinanim {date} · karaniwang tagal ng paglaki {n} araw",
    bik: "Itinanom {date} · normal na kaluwagan san pagdakula {n} adlaw",
  },
  "add.windowNote": {
    en: "Calculated from BulanTanom's crop records — an estimate, not a guaranteed harvest date.",
    fil: "Kinalkula mula sa talaan ng pananim ng BulanTanom — tantya lamang, hindi garantisadong petsa ng ani.",
    bik: "Kinwenta hali sa rekord san tanom san BulanTanom — tantya sana, dili garantisado na petsa san ani.",
  },
  "add.intel": { en: "Crop Intelligence", fil: "Impormasyon ng Pananim", bik: "Impormasyon san Tanom" },
  "add.growing": {
    en: "Growing characteristics",
    fil: "Katangian sa paglaki",
    bik: "Kinaiya sa pagdakula",
  },
  "add.care": { en: "Care guidance", fil: "Gabay sa pag-aalaga", bik: "Giya sa pag-ataman" },
  "add.harvestGuidance": { en: "Harvest guidance", fil: "Gabay sa pag-ani", bik: "Giya sa pag-ani" },
  "add.factors": {
    en: "Factors that can affect timing",
    fil: "Mga bagay na makaaapekto sa panahon",
    bik: "Mga bagay na makaapekto sa panahon",
  },
  "add.aiNote": {
    en: "AI-generated guidance for reference only. It does not diagnose plant disease or replace an agricultural officer.",
    fil: "Gabay na gawa ng AI para sa sanggunian lamang. Hindi ito nagdidiyagnos ng sakit ng halaman at hindi kapalit ng agricultural officer.",
    bik: "Giya na gibo san AI para sa reperensya sana. Dili ini nagdidiyagnos san helang san tanom asin dili kapalit san agricultural officer.",
  },
  "add.intelUnavailable": {
    en: "Crop intelligence is unavailable",
    fil: "Hindi available ang impormasyon ng pananim",
    bik: "Dili makakua san impormasyon san tanom",
  },
  "add.intelUnavailableDefault": {
    en: "Crop intelligence is temporarily unavailable.",
    fil: "Pansamantalang hindi available ang impormasyon ng pananim.",
    bik: "Temporaryo na dili makakua san impormasyon san tanom.",
  },
  "add.canStillAdd": {
    en: "Your plant can still be added.",
    fil: "Maaari mo pa ring idagdag ang iyong tanim.",
    bik: "Pwede mo pa giyapon idugang an imo tanom.",
  },

  "season.good": { en: "In season", fil: "Nasa panahon", bik: "Nasa panahon" },
  "season.caution": {
    en: "Outside the ideal window",
    fil: "Labas sa pinakamainam na panahon",
    bik: "Luwas sa pinakamaupay na panahon",
  },
  "season.poor": {
    en: "Not the season for this crop",
    fil: "Hindi panahon ng pananim na ito",
    bik: "Dili panahon san tanom na ini",
  },
  "season.goodHeadline": {
    en: "{month} is a good month to plant this at Layuan Farm.",
    fil: "Magandang buwan ang {month} para itanim ito sa Layuan Farm.",
    bik: "Maupay na bulan an {month} para itanom ini sa Layuan Farm.",
  },
  "season.cautionHeadline": {
    en: "{month} is workable, but not the ideal window.",
    fil: "Puwede ang {month}, pero hindi ito ang pinakamainam na panahon.",
    bik: "Pwede an {month}, pero dili ini an pinakamaupay na panahon.",
  },
  "season.poorHeadline": {
    en: "{month} is outside the recommended planting window.",
    fil: "Labas ang {month} sa inirerekomendang panahon ng pagtatanim.",
    bik: "Luwas an {month} sa rekomendado na panahon san pagtanom.",
  },
  "season.usually": {
    en: "Usually planted here in",
    fil: "Karaniwang itinatanim dito tuwing",
    bik: "Kadalasan itinatanom digdi sa",
  },

  "inSeason.title": {
    en: "Good to plant in {month}",
    fil: "Magandang itanim sa {month}",
    bik: "Maupay itanom sa {month}",
  },
  "inSeason.countOne": {
    en: "1 crop in season. Tap one to select it.",
    fil: "1 pananim ang nasa panahon. I-tap para piliin.",
    bik: "1 tanom an nasa panahon. I-tap para pilion.",
  },
  "inSeason.count": {
    en: "{n} crops in season. Tap one to select it.",
    fil: "{n} pananim ang nasa panahon. I-tap ang isa para piliin.",
    bik: "{n} tanom an nasa panahon. I-tap an saro para pilion.",
  },
  "inSeason.fewer": { en: "Show fewer", fil: "Ipakita ang mas kaunti", bik: "Ipahiling an mas dikit" },
  "inSeason.all": {
    en: "Show all {n} crops in season",
    fil: "Ipakita lahat ng {n} pananim na nasa panahon",
    bik: "Ipahiling an ngatanan na {n} tanom na nasa panahon",
  },
  "inSeason.none": {
    en: "Nothing in the catalog is at its best in {month}.",
    fil: "Walang pananim sa listahan na pinakamainam sa {month}.",
    bik: "Waray tanom sa listahan na pinakamaupay sa {month}.",
  },
  "inSeason.wet": {
    en: "{month} sits in Bulan's wettest and most typhoon-exposed stretch, so most crops are out of season rather than the list being incomplete.",
    fil: "Ang {month} ay nasa pinakamaulan at pinakamadalas bagyuhing panahon sa Bulan, kaya karamihan ng pananim ay wala sa panahon — hindi kulang ang listahan.",
    bik: "An {month} nasa pinakauranon asin pinakaparabagyo na panahon sa Bulan, kaya an kadaklan na tanom luwas sa panahon — dili kulang an listahan.",
  },
  "inSeason.picksUp": {
    en: "Planting picks up again in",
    fil: "Muling dumarami ang pagtatanim sa",
    bik: "Magdadakul liwat an pagtanom sa",
  },
  "inSeason.workable": {
    en: "Workable with care this month",
    fil: "Puwede ngayong buwan kung maingat",
    bik: "Pwede ngunyan na bulan kun maingat",
  },
  "inSeason.note": {
    en: "Based on each crop's usual planting window for Bulan's climate — not a live weather forecast.",
    fil: "Batay sa karaniwang panahon ng pagtatanim ng bawat pananim sa klima ng Bulan — hindi ito ulat-panahon.",
    bik: "Basado sa normal na panahon san pagtanom san kada tanom sa klima san Bulan — dili ini ulat-panahon.",
  },

  "cropSelect.placeholder": { en: "Select a crop", fil: "Pumili ng pananim", bik: "Pili san tanom" },
  "cropSelect.search": { en: "Search crops…", fil: "Maghanap ng pananim…", bik: "Hanapon an tanom…" },
  "cropSelect.searchLabel": { en: "Search crops", fil: "Maghanap ng pananim", bik: "Hanapon an tanom" },
  "cropSelect.fruit": { en: "Fruits", fil: "Mga Prutas", bik: "Mga Prutas" },
  "cropSelect.vegetable": {
    en: "Vegetables & Crops",
    fil: "Mga Gulay at Pananim",
    bik: "Mga Gulay asin Tanom",
  },
  "cropSelect.noMatch": {
    en: "No crops match “{query}”.",
    fil: "Walang pananim na tugma sa “{query}”.",
    bik: "Waray tanom na angay sa “{query}”.",
  },
  "variant.none": { en: "Not specified", fil: "Hindi tinukoy", bik: "Dili tinukoy" },
  "variant.days": {
    en: "about {n} days to harvest",
    fil: "mga {n} araw bago anihin",
    bik: "mga {n} adlaw bago anihon",
  },
});

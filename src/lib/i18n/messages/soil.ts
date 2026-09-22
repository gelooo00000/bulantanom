import { defineMessages } from "../define";

/**
 * Crop Recommendation. `soil.<name>` mirrors every entry of `SOIL_STRINGS`
 * in `lib/soil-options.ts`, so `useSoilStrings()` can hand the form the same
 * object shape in the Farmer's language.
 */
export const soil = defineMessages({
  "soilPage.title": {
    en: "Crop Recommendation",
    fil: "Rekomendasyon ng Pananim",
    bik: "Rekomendasyon san Tanom",
  },
  "soilPage.description": {
    en: "Enter your soil properties to get suitable crop suggestions for Layuan Farm.",
    fil: "Ilagay ang katangian ng iyong lupa para makakuha ng mga angkop na pananim para sa Layuan Farm.",
    bik: "Ibutang an kinaiya san imo daga para makakua san mga angay na tanom para sa Layuan Farm.",
  },

  "soil.resultTitle": {
    en: "AI Crop Recommendation",
    fil: "Rekomendasyon ng Pananim mula sa AI",
    bik: "Rekomendasyon san Tanom hali sa AI",
  },
  "soil.suitableFruits": { en: "Suitable Fruits", fil: "Angkop na Prutas", bik: "Angay na Prutas" },
  "soil.suitableVegetables": {
    en: "Suitable Vegetables",
    fil: "Angkop na Gulay",
    bik: "Angay na Gulay",
  },
  "soil.suitableCrops": { en: "Suitable Crops", fil: "Angkop na Pananim", bik: "Angay na Tanom" },
  "soil.fertilizer": {
    en: "Fertilizer Recommendations",
    fil: "Rekomendasyon sa Pataba",
    bik: "Rekomendasyon sa Abono",
  },
  "soil.soilImprovement": {
    en: "Soil Improvement & Watering Considerations",
    fil: "Pagpapabuti ng Lupa at Pagdidilig",
    bik: "Pagpaupay san Daga asin Pagbubo",
  },
  "soil.warnings": { en: "Important Warnings", fil: "Mahahalagang Babala", bik: "Importante na Paabiso" },
  "soil.noWarnings": {
    en: "No major warnings based on the information provided.",
    fil: "Walang malaking babala batay sa impormasyong ibinigay.",
    bik: "Waray dakula na paabiso basado sa impormasyon na itinao.",
  },
  "soil.soilType": { en: "Soil Type", fil: "Uri ng Lupa", bik: "Klase san Daga" },
  "soil.soilTexture": { en: "Soil Texture", fil: "Tekstura ng Lupa", bik: "Tekstura san Daga" },
  "soil.drainage": { en: "Drainage", fil: "Pagdaloy ng Tubig", bik: "Pagdalagan san Tubig" },
  "soil.soilMoisture": { en: "Soil Moisture", fil: "Basa ng Lupa", bik: "Kabasa san Daga" },
  "soil.phLevel": { en: "Soil pH", fil: "pH ng Lupa", bik: "pH san Daga" },
  "soil.phHint": {
    en: "Leave blank if you do not know.",
    fil: "Iwanang blangko kung hindi mo alam.",
    bik: "Pabayaan na blangko kun dili mo aram.",
  },
  "soil.nitrogen": { en: "Nitrogen", fil: "Nitrogen", bik: "Nitrogen" },
  "soil.phosphorus": { en: "Phosphorus", fil: "Phosphorus", bik: "Phosphorus" },
  "soil.potassium": { en: "Potassium", fil: "Potassium", bik: "Potassium" },
  "soil.organicMatter": { en: "Organic Matter", fil: "Organikong Bagay", bik: "Organiko na Bagay" },
  "soil.additionalInfo": {
    en: "Additional Soil Information",
    fil: "Karagdagang Impormasyon sa Lupa",
    bik: "Dugang na Impormasyon sa Daga",
  },
  "soil.additionalInfoHint": {
    en: "e.g. The soil becomes dry quickly.",
    fil: "hal. Mabilis matuyo ang lupa.",
    bik: "pananglitan: Madali mamara an daga.",
  },
  "soil.optional": { en: "Optional", fil: "Opsyonal", bik: "Opsyonal" },
  "soil.submit": { en: "Get Recommendation", fil: "Kunin ang Rekomendasyon", bik: "Kuaon an Rekomendasyon" },
  "soil.sensorSectionTitle": {
    en: "Soil Detector Readings",
    fil: "Mga Sukat ng Soil Detector",
    bik: "Mga Sukat san Soil Detector",
  },
  "soil.sensorSectionHint": {
    en: "Enter the readings from your soil detector. All eight are needed for a crop recommendation.",
    fil: "Ilagay ang mga sukat mula sa iyong soil detector. Kailangan ang lahat ng walo para sa rekomendasyon ng pananim.",
    bik: "Ibutang an mga sukat hali sa imo soil detector. Kinahanglan an ngatanan na walo para sa rekomendasyon san tanom.",
  },
  "soil.analyzing": {
    en: "Analyzing your soil information…",
    fil: "Sinusuri ang impormasyon ng iyong lupa…",
    bik: "Sinususi an impormasyon san imo daga…",
  },
  "soil.analyzingHint": {
    en: "Reviewing what you reported to suggest suitable crops.",
    fil: "Sinusuri ang iyong iniulat para magmungkahi ng angkop na pananim.",
    bik: "Sinususi an imo inireport para magsugerir san angay na tanom.",
  },
  "soil.aiUnavailable": {
    en: "AI recommendation is temporarily unavailable.",
    fil: "Pansamantalang hindi available ang rekomendasyon ng AI.",
    bik: "Temporaryo na dili makakua san rekomendasyon san AI.",
  },
  "soil.savedNotice": {
    en: "Your soil information has been saved successfully. Please try again later.",
    fil: "Matagumpay na na-save ang impormasyon ng iyong lupa. Pakisubukan muli mamaya.",
    bik: "Naka-save na an impormasyon san imo daga. Probaran tabi liwat maya-maya.",
  },
  "soil.tryAgain": { en: "Try Again", fil: "Subukan Muli", bik: "Probaran Liwat" },
  "soil.retrying": { en: "Analyzing…", fil: "Sinusuri…", bik: "Sinususi…" },
  "soil.retryHint": {
    en: "Your soil information is saved — try again without re-entering anything.",
    fil: "Naka-save ang impormasyon ng iyong lupa — subukan muli nang hindi na naglalagay muli.",
    bik: "Naka-save an impormasyon san imo daga — probaran liwat na dili na magbutang liwat.",
  },
  "soil.stillUnavailable": {
    en: "AI recommendation is still unavailable. Please try again in a few minutes.",
    fil: "Hindi pa rin available ang rekomendasyon ng AI. Pakisubukan muli pagkalipas ng ilang minuto.",
    bik: "Dili pa giyapon makakua san rekomendasyon san AI. Probaran tabi liwat pakalihis san pira na minuto.",
  },
  "soil.backToSoilInfo": {
    en: "Back to Soil Information",
    fil: "Bumalik sa Impormasyon ng Lupa",
    bik: "Balik sa Impormasyon san Daga",
  },
  "soil.saved": { en: "Saved", fil: "Na-save", bik: "Na-save" },
  "soil.saveSuccess": {
    en: "Crop recommendation saved successfully.",
    fil: "Matagumpay na na-save ang rekomendasyon ng pananim.",
    bik: "Naka-save na an rekomendasyon san tanom.",
  },
  "soil.newAssessmentReady": {
    en: "Enter your soil information for a new assessment.",
    fil: "Ilagay ang impormasyon ng iyong lupa para sa bagong pagsusuri.",
    bik: "Ibutang an impormasyon san imo daga para sa bago na pagsusi.",
  },
  "soil.soilIntelligence": {
    en: "Crop Recommendation",
    fil: "Rekomendasyon ng Pananim",
    bik: "Rekomendasyon san Tanom",
  },
  "soil.latestAssessment": { en: "Last Assessment", fil: "Huling Pagsusuri", bik: "Huri na Pagsusi" },
  "soil.viewRecommendation": {
    en: "View Full Recommendation",
    fil: "Tingnan ang Buong Rekomendasyon",
    bik: "Hilingon an Bilog na Rekomendasyon",
  },
  "soil.noAssessmentTitle": {
    en: "No soil assessment yet",
    fil: "Wala pang pagsusuri ng lupa",
    bik: "Waray pa pagsusi san daga",
  },
  "soil.noAssessmentBody": {
    en: "Enter your soil information to get AI crop suggestions for your plot.",
    fil: "Ilagay ang impormasyon ng iyong lupa para makakuha ng mungkahing pananim mula sa AI.",
    bik: "Ibutang an impormasyon san imo daga para makakua san sugerido na tanom hali sa AI.",
  },
  "soil.assessmentSaved": {
    en: "Soil assessment saved.",
    fil: "Na-save ang pagsusuri ng lupa.",
    bik: "Na-save an pagsusi san daga.",
  },
  "soil.notAnalyzed": {
    en: "No AI recommendation was generated for this assessment. Submit it to get crop suggestions.",
    fil: "Walang nagawang rekomendasyon ng AI para sa pagsusuring ito. Isumite ito para makakuha ng mungkahing pananim.",
    bik: "Waray nagibo na rekomendasyon san AI para sa pagsusi na ini. Isumite ini para makakua san sugerido na tanom.",
  },

  "sensor.soil_temperature": {
    en: "Soil Temperature",
    fil: "Temperatura ng Lupa",
    bik: "Temperatura san Daga",
  },
  "sensor.soil_moisture": { en: "Soil Moisture", fil: "Basa ng Lupa", bik: "Kabasa san Daga" },
  "sensor.soil_conductivity": {
    en: "Soil Conductivity",
    fil: "Conductivity ng Lupa",
    bik: "Conductivity san Daga",
  },
  "sensor.soil_ph": { en: "Soil pH", fil: "pH ng Lupa", bik: "pH san Daga" },
  "sensor.nitrogen": { en: "Nitrogen (N)", fil: "Nitrogen (N)", bik: "Nitrogen (N)" },
  "sensor.phosphorus": { en: "Phosphorus (P)", fil: "Phosphorus (P)", bik: "Phosphorus (P)" },
  "sensor.potassium": { en: "Potassium (K)", fil: "Potassium (K)", bik: "Potassium (K)" },
  "sensor.soil_fertility": {
    en: "Soil Fertility",
    fil: "Taba ng Lupa",
    bik: "Kataba san Daga",
  },
  "sensor.range": {
    en: "{min} to {max} {unit}",
    fil: "{min} hanggang {max} {unit}",
    bik: "{min} sagkod {max} {unit}",
  },
  "sensor.required": {
    en: "{label} is required.",
    fil: "Kailangan ang {label}.",
    bik: "Kinahanglan an {label}.",
  },
  "sensor.notNumber": {
    en: "{label} must be a number.",
    fil: "Dapat numero ang {label}.",
    bik: "Dapat numero an {label}.",
  },
  "sensor.outOfRange": {
    en: "{label} must be between {min} and {max} {unit}.",
    fil: "Dapat nasa pagitan ng {min} at {max} {unit} ang {label}.",
    bik: "Dapat nasa tahaw san {min} asin {max} {unit} an {label}.",
  },
});

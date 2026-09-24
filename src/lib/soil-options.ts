/**
 * Soil field options and UI strings for the Crop Recommendation feature.
 *
 * The feature is named for what it gives back - crop suggestions - while the
 * field labels stay soil-specific, because they describe what the Farmer is
 * being asked for. "Soil pH" is a real measurement; "Crop pH" would be
 * nonsense.
 *
 * Values mirror the `SoilRecommendation` TextChoices in Django exactly, so
 * the form can post them straight through without a mapping layer.
 *
 * Every list ends with "Unknown" on purpose — a Farmer must always be able
 * to say they do not know rather than being forced to invent a value.
 */

import { englishT, useLanguage, type MessageKey, type Translate } from "@/lib/i18n";

export type SoilOption = { value: string; label: string };

export const SOIL_TYPE_OPTIONS: SoilOption[] = [
  { value: "loamy", label: "Loamy" },
  { value: "clay", label: "Clay" },
  { value: "sandy", label: "Sandy" },
  { value: "silty", label: "Silty" },
  { value: "sandy_loam", label: "Sandy Loam" },
  { value: "clay_loam", label: "Clay Loam" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
];

export const SOIL_TEXTURE_OPTIONS: SoilOption[] = [
  { value: "sandy", label: "Sandy" },
  { value: "loose", label: "Loose" },
  { value: "fine", label: "Fine" },
  { value: "sticky", label: "Sticky" },
  { value: "heavy", label: "Heavy" },
  { value: "smooth", label: "Smooth" },
  { value: "grainy", label: "Grainy" },
  { value: "unknown", label: "Unknown" },
];

export const DRAINAGE_OPTIONS: SoilOption[] = [
  { value: "good", label: "Good" },
  { value: "moderate", label: "Moderate" },
  { value: "poor", label: "Poor" },
  { value: "unknown", label: "Unknown" },
];

export const SOIL_MOISTURE_OPTIONS: SoilOption[] = [
  { value: "very_dry", label: "Very Dry" },
  { value: "dry", label: "Dry" },
  { value: "moderate", label: "Moderate" },
  { value: "moist", label: "Moist" },
  { value: "very_wet", label: "Very Wet" },
  { value: "unknown", label: "Unknown" },
];

/** Shared by Nitrogen, Phosphorus, Potassium and Organic Matter. */
export const NUTRIENT_OPTIONS: SoilOption[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "unknown", label: "Unknown" },
];

/** The six AI result section titles, plus the form's own copy. */
/**
 * The eight readings the farm's soil detector reports.
 *
 * One definition drives the label, the unit, the input constraints and the
 * client-side range check, so the form and its validation can never disagree
 * about what the device can measure. The ranges are the device's own and are
 * enforced again in Django - this copy exists to catch a typo before it
 * costs a round trip, not to be the authority.
 */
export type SensorField = {
  /** Matches the Django field name exactly; the payload is built from it. */
  key:
    | "soil_temperature"
    | "soil_moisture"
    | "soil_conductivity"
    | "soil_ph"
    | "nitrogen"
    | "phosphorus"
    | "potassium"
    | "soil_fertility";
  label: string;
  unit: string;
  min: number;
  max: number;
  /** 1 for whole-number readings, finer where the sensor reports decimals. */
  step: number;
  placeholder: string;
};

export const SENSOR_FIELDS: SensorField[] = [
  {
    key: "soil_temperature",
    label: "Soil Temperature",
    unit: "°C",
    min: -40,
    max: 80,
    step: 0.1,
    placeholder: "28.5",
  },
  {
    key: "soil_moisture",
    label: "Soil Moisture",
    unit: "%",
    min: 0,
    max: 100,
    step: 0.1,
    placeholder: "65",
  },
  {
    key: "soil_conductivity",
    label: "Soil Conductivity",
    unit: "µS/cm",
    min: 0,
    max: 20000,
    step: 1,
    placeholder: "850",
  },
  {
    key: "soil_ph",
    label: "Soil pH",
    unit: "pH",
    min: 3,
    max: 10,
    step: 0.1,
    placeholder: "6.5",
  },
  {
    key: "nitrogen",
    label: "Nitrogen (N)",
    unit: "mg/kg",
    min: 1,
    max: 1999,
    step: 1,
    placeholder: "120",
  },
  {
    key: "phosphorus",
    label: "Phosphorus (P)",
    unit: "mg/kg",
    min: 1,
    max: 1999,
    step: 1,
    placeholder: "80",
  },
  {
    key: "potassium",
    label: "Potassium (K)",
    unit: "mg/kg",
    min: 1,
    max: 1999,
    step: 1,
    placeholder: "150",
  },
  {
    key: "soil_fertility",
    label: "Soil Fertility",
    unit: "mg/kg",
    min: 0,
    max: 3000,
    step: 1,
    placeholder: "600",
  },
];

/**
 * Why a typed reading is not acceptable, or null when it is.
 *
 * Empty is reported as missing rather than out of range: the detector gives
 * a value for every field, so a blank is an unfinished form, not a farmer
 * declining to answer.
 */
export function validateReading(
  field: SensorField,
  raw: string,
  t: Translate = englishT,
): string | null {
  const label = sensorLabel(field, t);
  const text = raw.trim();
  if (text === "") return t("sensor.required", { label });

  const value = Number(text);
  if (!Number.isFinite(value)) return t("sensor.notNumber", { label });
  if (value < field.min || value > field.max) {
    return t("sensor.outOfRange", { label, min: field.min, max: field.max, unit: field.unit });
  }
  return null;
}

/** A detector reading's name in the Farmer's language. */
export function sensorLabel(field: SensorField, t: Translate = englishT): string {
  return t(`sensor.${field.key}`);
}

export const SOIL_STRINGS = {
  resultTitle: "AI Crop Recommendation",
  suitableFruits: "Suitable Fruits",
  suitableVegetables: "Suitable Vegetables",
  suitableCrops: "Suitable Crops",
  fertilizer: "Fertilizer Recommendations",
  soilImprovement: "Soil Improvement & Watering Considerations",
  warnings: "Important Warnings",
  noWarnings: "No major warnings based on the information provided.",

  soilType: "Soil Type",
  soilTexture: "Soil Texture",
  drainage: "Drainage",
  soilMoisture: "Soil Moisture",
  phLevel: "Soil pH",
  phHint: "Leave blank if you do not know.",
  nitrogen: "Nitrogen",
  phosphorus: "Phosphorus",
  potassium: "Potassium",
  organicMatter: "Organic Matter",
  additionalInfo: "Additional Soil Information",
  additionalInfoHint: "e.g. The soil becomes dry quickly.",
  optional: "Optional",
  submit: "Get Recommendation",
  sensorSectionTitle: "Soil Detector Readings",
  sensorSectionHint:
    "Enter the readings from your soil detector. All eight are needed for a crop recommendation.",
  analyzing: "Analyzing your soil information…",
  analyzingHint: "Reviewing what you reported to suggest suitable crops.",
  aiUnavailable: "AI recommendation is temporarily unavailable.",
  savedNotice:
    "Your soil information has been saved successfully. Please try again later.",
  tryAgain: "Try Again",
  retrying: "Analyzing…",
  retryHint: "Your soil information is saved — try again without re-entering anything.",
  stillUnavailable:
    "AI recommendation is still unavailable. Please try again in a few minutes.",

  // "Back to Soil Information" button and its states
  backToSoilInfo: "Back to Soil Information",
  seeResult: "See Result",
  resultFrom: "Result from",
  latestTag: "latest",
  notAnalyzedTag: "not analyzed",
  saved: "Saved",
  saveSuccess: "Crop recommendation saved successfully.",
  newAssessmentReady: "Enter your soil information for a new assessment.",

  // Farmer Dashboard summary card
  soilIntelligence: "Crop Recommendation",
  latestAssessment: "Last Assessment",
  viewRecommendation: "View Full Recommendation",
  noAssessmentTitle: "No soil assessment yet",
  noAssessmentBody:
    "Enter your soil information to get AI crop suggestions for your plot.",
  assessmentSaved: "Soil assessment saved.",
  notAnalyzed:
    "No AI recommendation was generated for this assessment. Submit it to get crop suggestions.",
} as const;

export type SoilStrings = Record<keyof typeof SOIL_STRINGS, string>;

/**
 * `SOIL_STRINGS`, in the Farmer's language. Every entry has a
 * `soil.<name>` message; a test keeps the two in step.
 */
export function useSoilStrings(): SoilStrings {
  const { t } = useLanguage();
  return Object.fromEntries(
    Object.keys(SOIL_STRINGS).map((key) => [key, t(`soil.${key}` as MessageKey)]),
  ) as SoilStrings;
}

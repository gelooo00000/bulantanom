/**
 * Soil field options and UI strings for the Soil Recommendation feature.
 *
 * Values mirror the `SoilRecommendation` TextChoices in Django exactly, so
 * the form can post them straight through without a mapping layer.
 *
 * Every list ends with "Unknown" on purpose — a Farmer must always be able
 * to say they do not know rather than being forced to invent a value.
 */

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
export const SOIL_STRINGS = {
  resultTitle: "AI Soil Recommendation",
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
  analyzing: "Analyzing your soil information…",
  analyzingHint: "Reviewing what you reported to suggest suitable crops.",
  aiUnavailable: "AI recommendation is temporarily unavailable.",
  savedNotice:
    "Your soil information has been saved successfully. Please try again later.",

  // "Back to Soil Information" button and its states
  backToSoilInfo: "Back to Soil Information",
  saved: "Saved",
  saveSuccess: "Soil recommendation saved successfully.",
  newAssessmentReady: "Enter your soil information for a new assessment.",

  // Farmer Dashboard summary card
  soilIntelligence: "Soil Intelligence",
  latestAssessment: "Last Assessment",
  viewRecommendation: "View Full Recommendation",
  noAssessmentTitle: "No soil assessment yet",
  noAssessmentBody:
    "Enter your soil information to get AI crop suggestions for your plot.",
  assessmentSaved: "Soil assessment saved.",
  notAnalyzed:
    "No AI recommendation was generated for this assessment. Submit it to get crop suggestions.",
} as const;

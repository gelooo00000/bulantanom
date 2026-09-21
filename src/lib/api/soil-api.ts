import { apiFetch } from "./client";

/**
 * One crop Gemini suggested. `emoji` and `name` are resolved by Django
 * against the real crop catalog, so the UI never has to guess an emoji.
 */
export type SoilCropSuggestion = {
  id: string;
  name: string;
  emoji: string;
  reason: string;
};

export type SoilAdvice = {
  recommendation: string;
};

/**
 * A saved soil assessment and its AI result. Mirrors
 * `SoilRecommendationSerializer` — exactly the six result sections, with no
 * summary/confidence/suitability fields.
 */
export type SoilRecommendation = {
  id: number;

  /**
   * Soil detector readings. Numeric in the database; DRF serialises decimals
   * as strings, so temperature, moisture and pH arrive as strings and the
   * integer readings as numbers. Parse before doing arithmetic on them.
   */
  soil_temperature: string | null;
  soil_moisture: string | null;
  soil_conductivity: number | null;
  soil_ph: string | null;
  nitrogen: number | null;
  phosphorus: number | null;
  potassium: number | null;
  soil_fertility: number | null;
  notes: string;

  /** False for assessments recorded before the detector. */
  has_sensor_readings: boolean;

  /** Categorical answers the old form collected. Read-only, legacy rows only. */
  legacy_soil_type: string;
  legacy_soil_texture: string;
  legacy_drainage: string;
  legacy_soil_moisture: string;
  legacy_nitrogen: string;
  legacy_phosphorus: string;
  legacy_potassium: string;
  legacy_organic_matter: string;

  // The six Gemini sections
  suitable_fruits: SoilCropSuggestion[];
  suitable_vegetables: SoilCropSuggestion[];
  suitable_crops: SoilCropSuggestion[];
  fertilizer_recommendations: SoilAdvice[];
  soil_improvement_watering: SoilAdvice[];
  important_warnings: SoilAdvice[];

  ai_generated: boolean;
  ai_available: boolean;
  failure_reason: string;
  created_at: string;
  updated_at: string;
};

/** Only the soil inputs are writable; every AI field is server-owned. */
/**
 * What the form posts. Every reading is a number, not the typed string -
 * the database columns are numeric and sending "28.5" would make the API
 * responsible for guessing what the farmer meant.
 */
export type SoilRecommendationInput = {
  soil_temperature: number;
  soil_moisture: number;
  soil_conductivity: number;
  soil_ph: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  soil_fertility: number;
  notes: string;
};

/**
 * Saves the soil assessment and generates a recommendation. This is the only
 * call that spends Gemini quota — every read below is served from MySQL.
 */
export function createSoilRecommendation(
  input: SoilRecommendationInput,
  accessToken: string,
): Promise<SoilRecommendation> {
  return apiFetch("/farmer/soil-recommendations/", {
    method: "POST",
    body: input,
    accessToken,
  });
}

/**
 * Persists the soil assessment WITHOUT calling Gemini. Backs the "Back to
 * Dashboard" button: leaving the page must never lose what the Farmer typed,
 * but it should also be instant and must not spend AI quota. The row comes
 * back with `ai_generated: false`.
 */
export function saveSoilAssessmentOnly(
  input: SoilRecommendationInput,
  accessToken: string,
): Promise<SoilRecommendation> {
  return apiFetch("/farmer/soil-recommendations/?analyze=0", {
    method: "POST",
    body: input,
    accessToken,
  });
}

/**
 * The Farmer's most recent saved result. A pure database read — used to
 * restore the page on load without calling Gemini. Resolves to null when
 * they have never submitted one (Django returns 204).
 */
export async function fetchLatestSoilRecommendation(
  accessToken: string,
): Promise<SoilRecommendation | null> {
  const result = await apiFetch<SoilRecommendation | null>(
    "/farmer/soil-recommendations/latest/",
    { accessToken },
  );
  return result ?? null;
}

/**
 * Re-runs Gemini for a saved assessment that has no AI result. The stored
 * soil information is reused untouched, so the Farmer never re-enters it; an
 * assessment that already has a recommendation comes back unchanged.
 */
export function reanalyzeSoilRecommendation(
  accessToken: string,
  soilId: number,
): Promise<SoilRecommendation> {
  return apiFetch(`/farmer/soil-recommendations/${soilId}/reanalyze/`, {
    method: "POST",
    accessToken,
  });
}

/** Saved history. Database read only — costs no quota. */
export function fetchSoilRecommendations(
  accessToken: string,
): Promise<SoilRecommendation[]> {
  return apiFetch("/farmer/soil-recommendations/", { accessToken });
}

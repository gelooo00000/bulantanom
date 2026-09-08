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

  // Farmer-provided soil information
  soil_type: string;
  soil_texture: string;
  drainage: string;
  soil_moisture: string;
  ph_level: string | null;
  nitrogen: string;
  phosphorus: string;
  potassium: string;
  organic_matter: string;
  notes: string;

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
export type SoilRecommendationInput = {
  soil_type: string;
  soil_texture: string;
  drainage: string;
  soil_moisture: string;
  ph_level: number | null;
  nitrogen: string;
  phosphorus: string;
  potassium: string;
  organic_matter: string;
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

/** Saved history. Database read only — costs no quota. */
export function fetchSoilRecommendations(
  accessToken: string,
): Promise<SoilRecommendation[]> {
  return apiFetch("/farmer/soil-recommendations/", { accessToken });
}

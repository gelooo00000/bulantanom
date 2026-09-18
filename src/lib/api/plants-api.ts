import { apiFetch } from "@/lib/api/client";
import type { AssessmentEligibility } from "@/lib/api/risk-api";

/** A named variety within a crop, e.g. Sweet Corn under Corn. */
export type CropVariant = {
  id: string;
  name: string;
  description: string;
  /** Overrides the parent crop's duration when this variety is planted. */
  growing_duration_days: number;
  harvest_window_days: number;
  search_terms: string[];
};

/**
 * When this crop is normally planted at Layuan Farm.
 *
 * Only the month lists are data the UI tests against; every line of wording
 * comes from Django, so the agronomic text has one home. `null` on a crop
 * with no window on record — render nothing rather than guess.
 */
export type PlantingWindow = {
  preferred_months: number[];
  caution_months: number[];
  /** Pre-formatted, e.g. "February-May". */
  preferred_label: string;
  reason: string;
  risk: string;
  caution_note: string;
};

export type PlantingAdviceStatus = "good" | "caution" | "poor";

/** Django's verdict for one month. Advisory — never moves a harvest date. */
export type PlantingAdvice = {
  status: PlantingAdviceStatus;
  month: number;
  month_name: string;
  headline: string;
  detail: string;
  preferred_months: number[];
  preferred_label: string;
  caution_months: number[];
};

export type BackendCrop = {
  id: string;
  name: string;
  category: "fruit" | "vegetable";
  category_label: string;
  emoji: string;
  growing_duration_days: number;
  harvest_window_days: number;
  description: string;
  search_terms: string[];
  variants: CropVariant[];
  planting_window: PlantingWindow | null;
};

export type BackendPlant = {
  id: number;
  crop: BackendCrop;
  /** Null for crops with no varieties, and for plants recorded before them. */
  variant: CropVariant | null;
  /** Season verdict for the month this plant actually went in the ground. */
  planting_advice: PlantingAdvice | null;
  label: string;
  display_name: string;
  planting_date: string;
  expected_harvest_start: string;
  expected_harvest_end: string;
  status: "GROWING" | "READY_FOR_HARVEST" | "HARVESTED" | "ARCHIVED";
  status_label: string;
  age_days: number;
  /** Weekly-assessment lock state, decided by Django from stored assessments. */
  assessment_eligibility: AssessmentEligibility;
  created_at: string;
  updated_at: string;
};

/** AI-generated educational content. Never the source of harvest dates. */
export type CropIntelligence = {
  crop_overview: string;
  growing_notes: string[];
  care_guidance: string[];
  harvest_guidance: string;
  important_factors: string[];
  model_name: string;
  generated_at: string;
};

/** Calculated by Django from the crop table — not by Gemini. */
export type HarvestWindow = {
  planting_date: string;
  expected_harvest_start: string;
  expected_harvest_end: string;
  growing_duration_days: number;
  harvest_window_days: number;
  source: string;
};

export type CropIntelligenceResponse = {
  crop: BackendCrop;
  /** Echoes back the variety the window was calculated for, if any. */
  variant: CropVariant | null;
  harvest_window: HarvestWindow | null;
  intelligence: CropIntelligence | null;
  intelligence_generated_now: boolean;
  unavailable_reason: string | null;
};

export function fetchCrops(accessToken: string): Promise<BackendCrop[]> {
  return apiFetch("/farmer/crops/", { accessToken });
}

export function fetchCropIntelligence(
  accessToken: string,
  cropId: string,
  plantingDate: string,
  /**
   * Required for the preview to match what gets saved. Without it the
   * harvest window came back computed from the parent crop while the
   * created plant used the variety's own durations — 25 days apart for
   * Sweet Corn against Corn.
   */
  variantId?: string | null,
): Promise<CropIntelligenceResponse> {
  const params = new URLSearchParams({ planting_date: plantingDate });
  if (variantId) params.set("variant", variantId);
  return apiFetch(`/farmer/crops/${cropId}/intelligence/?${params}`, { accessToken });
}

export function fetchPlants(accessToken: string): Promise<BackendPlant[]> {
  return apiFetch("/farmer/plants/", { accessToken });
}

export function fetchPlant(accessToken: string, plantId: string): Promise<BackendPlant> {
  return apiFetch(`/farmer/plants/${plantId}/`, { accessToken });
}

/** The farmer is taken from the auth token server-side — never sent here. */
export function createPlant(
  accessToken: string,
  payload: {
    crop_id: string;
    planting_date: string;
    label?: string;
    variant_id?: string | null;
  },
): Promise<BackendPlant> {
  return apiFetch("/farmer/plants/", { method: "POST", body: payload, accessToken });
}

export function deletePlant(accessToken: string, plantId: number): Promise<void> {
  return apiFetch(`/farmer/plants/${plantId}/`, { method: "DELETE", accessToken });
}

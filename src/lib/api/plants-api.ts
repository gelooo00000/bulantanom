import { apiFetch } from "@/lib/api/client";
import type { AssessmentEligibility } from "@/lib/api/risk-api";

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
};

export type BackendPlant = {
  id: number;
  crop: BackendCrop;
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
): Promise<CropIntelligenceResponse> {
  return apiFetch(
    `/farmer/crops/${cropId}/intelligence/?planting_date=${encodeURIComponent(plantingDate)}`,
    { accessToken },
  );
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
  payload: { crop_id: string; planting_date: string; label?: string },
): Promise<BackendPlant> {
  return apiFetch("/farmer/plants/", { method: "POST", body: payload, accessToken });
}

export function deletePlant(accessToken: string, plantId: number): Promise<void> {
  return apiFetch(`/farmer/plants/${plantId}/`, { method: "DELETE", accessToken });
}

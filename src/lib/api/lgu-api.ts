import type { BackendAccountStatus, BackendUser } from "@/lib/api/auth-api";
import { apiFetch } from "@/lib/api/client";

/**
 * Metrics the LGU dashboard is designed around but which have no backing
 * Django model yet. The backend sends these explicitly so the UI can show
 * an honest "not yet available" state instead of a fabricated number.
 */
export type UnavailableMetric = {
  key: string;
  label: string;
  reason: string;
};

export type LguDashboard = {
  farm: { name: string; location: string };
  farmers: {
    active: number;
    pending: number;
    rejected: number;
    suspended: number;
    total: number;
  };
  lgu_officers: number;
  /** Real plant totals across approved Farmers, from the Plant table. */
  plants: {
    total: number;
    growing: number;
    ready_for_harvest: number;
    harvested: number;
  } | null;
  /** Latest reading per plant, counted by level. Never estimated. */
  risk: { LOW: number; MEDIUM: number; HIGH: number; unassessed: number } | null;
  assessments: number | null;
  harvest: number | null;
  /** Real soil-recommendation totals across approved Farmers. */
  soil_recommendations: SoilRecommendationCounts | null;
  unavailable_metrics: UnavailableMetric[];
};

export type LguFarmerDetail = {
  farmer: BackendUser;
  plants: number | null;
  assessments: number | null;
  high_risk: number | null;
  upcoming_harvest: number | null;
  soil_recommendations: SoilRecommendationCounts | null;
  unavailable_metrics: UnavailableMetric[];
};

/**
 * Soil-recommendation totals. `pending_analysis` is a saved soil assessment
 * whose Gemini call failed — the Farmer's data was kept, the advice was not.
 */
export type SoilRecommendationCounts = {
  total: number;
  generated: number;
  pending_analysis: number;
};

/** One Farmer's soil assessment plus its AI result, as the LGU sees it. */
export type LguSoilRecommendation = {
  id: number;
  farmer_id: number;
  farmer_name: string;
  farmer_email: string;

  soil_type_label: string;
  soil_texture_label: string;
  drainage_label: string;
  soil_moisture_label: string;
  ph_level: string | null;
  nitrogen_label: string;
  phosphorus_label: string;
  potassium_label: string;
  organic_matter_label: string;
  notes: string;

  suitable_fruits: { id: string; name: string; emoji: string; reason: string }[];
  suitable_vegetables: { id: string; name: string; emoji: string; reason: string }[];
  suitable_crops: { id: string; name: string; emoji: string; reason: string }[];
  fertilizer_recommendations: { recommendation: string }[];
  soil_improvement_watering: { recommendation: string }[];
  important_warnings: { recommendation: string }[];

  ai_generated: boolean;
  created_at: string;
};

/** Read-only monitoring list, newest first. Optionally one Farmer's records. */
export function fetchLguSoilRecommendations(
  accessToken: string,
  farmerId?: number,
): Promise<LguSoilRecommendation[]> {
  const query = farmerId ? `?farmer=${farmerId}` : "";
  return apiFetch(`/lgu/soil-recommendations/${query}`, { accessToken });
}

/** One plant as the LGU sees it: the farmer record plus its latest reading. */
export type LguPlant = {
  id: number;
  crop: { id: string; name: string; emoji: string; category_label: string };
  display_name: string;
  planting_date: string;
  expected_harvest_start: string;
  expected_harvest_end: string;
  status: string;
  status_label: string;
  age_days: number;
  farmer: { id: number; full_name: string; email: string };
  latest_risk: {
    risk_level: "LOW" | "MEDIUM" | "HIGH" | null;
    assessment_id: number;
    assessment_date: string;
    has_evidence: boolean;
  } | null;
};

/** Plants across every approved Farmer. Backs the Plants and Harvest screens. */
export function fetchLguPlants(accessToken: string): Promise<LguPlant[]> {
  return apiFetch("/lgu/plants/", { accessToken });
}

export function fetchLguDashboard(accessToken: string): Promise<LguDashboard> {
  return apiFetch("/lgu/dashboard/", { accessToken });
}

export function fetchLguFarmers(
  accessToken: string,
  status?: BackendAccountStatus | "ALL",
): Promise<BackendUser[]> {
  const query = status ? `?status=${status}` : "";
  return apiFetch(`/lgu/farmers/${query}`, { accessToken });
}

export function fetchLguFarmerDetail(
  accessToken: string,
  farmerId: number,
): Promise<LguFarmerDetail> {
  return apiFetch(`/lgu/farmers/${farmerId}/`, { accessToken });
}

export function fetchLguFarmOverview(accessToken: string): Promise<{
  farm: { name: string; location: string };
  farmers: { active: number; total: number };
  plants: { total: number; growing: number; ready_for_harvest: number; harvested: number } | null;
  unavailable_metrics: UnavailableMetric[];
}> {
  return apiFetch("/lgu/farm/", { accessToken });
}

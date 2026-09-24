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
  /** Assessments per week, oldest first, empty weeks included as 0. */
  assessment_trend: { week_start: string; count: number }[];
  /** Non-archived plants per crop, most planted first. */
  crops: { name: string; emoji: string; count: number }[];
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

  // Soil detector readings. Decimals arrive as strings from DRF.
  soil_temperature: string | null;
  soil_moisture: string | null;
  soil_conductivity: number | null;
  soil_ph: string | null;
  nitrogen: number | null;
  phosphorus: number | null;
  potassium: number | null;
  soil_fertility: number | null;
  has_sensor_readings: boolean;
  notes: string;

  // Pre-detector categorical answers, with their display labels.
  legacy_soil_type_label: string;
  legacy_soil_texture_label: string;
  legacy_drainage_label: string;
  legacy_soil_moisture_label: string;
  legacy_nitrogen_label: string;
  legacy_phosphorus_label: string;
  legacy_potassium_label: string;
  legacy_organic_matter_label: string;

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
  /** A future planting date: the plant is not in the ground yet. */
  is_planned?: boolean;
  /** The same weekly schedule the Farmer sees; `can_assess` means a check is due. */
  assessment_eligibility?: { can_assess: boolean; days_remaining: number };
  farmer: { id: number; full_name: string; email: string };
  latest_risk: {
    risk_level: "LOW" | "MEDIUM" | "HIGH" | "INCONCLUSIVE" | null;
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

/** A Farmer as the LGU list shows them: the safe profile plus monitoring. */
export type LguFarmer = BackendUser & {
  plant_count: number;
  /** Plants whose latest assessment read HIGH. */
  high_risk_plants: number;
  /** Most recent weekly check (YYYY-MM-DD), or null if there has never been one. */
  last_assessment_date: string | null;
  /** Using BulanTanom right now, as decided by Django. */
  is_online: boolean;
  /** When they last used BulanTanom (ISO datetime), or null if never. */
  last_seen_at: string | null;
};

export function fetchLguFarmers(
  accessToken: string,
  status?: BackendAccountStatus | "ALL",
): Promise<LguFarmer[]> {
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

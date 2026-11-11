import type { BackendAccountStatus, BackendUser } from "@/lib/api/auth-api";
import { apiFetch } from "@/lib/api/client";
import type { HarvestReport, LossReport } from "@/lib/api/plants-api";

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
  /**
   * Minutes with BulanTanom open on screen: today, in the last 7 days and in
   * the last 30, counted from `since` (YYYY-MM-DD). Absent on older servers.
   */
  usage?: { today: number; week: number; month: number; since: string };
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
  farm: { name: string; location: string; latitude: number; longitude: number };
  farmers: { active: number; total: number };
  plants: { total: number; growing: number; ready_for_harvest: number; harvested: number } | null;
  unavailable_metrics: UnavailableMetric[];
}> {
  return apiFetch("/lgu/farm/", { accessToken });
}

/** One harvest report, as LGU Officers and Admins see it. */
export type HarvestOutcomeReport = HarvestReport & {
  farmer_name: string;
  plant_name: string;
  crop_name: string;
  crop_emoji: string;
};

type Breakdown = { value: string; label: string; count: number }[];

/** One loss report, as LGU Officers and Admins see it. */
export type LossOutcomeReport = LossReport & {
  farmer_name: string;
  plant_name: string;
  crop_name: string;
  crop_emoji: string;
};

/** How harvested plants turned out, from the Farmers' harvest reports. */
export type HarvestOutcomes = {
  total: number;
  /** Percentages; null while there are no reports. */
  healthy_rate: number | null;
  advice_helped_rate: number | null;
  on_time_rate: number | null;
  monitored_rate: number | null;
  reached_high_risk: number;
  recovered_healthy: number;
  quality: Breakdown;
  final_health: Breakdown;
  advice_helped: Breakdown;
  timing: Breakdown;
  by_crop: {
    crop: string;
    emoji: string;
    harvests: number;
    healthy_rate: number | null;
    good_quality_rate: number | null;
    on_time_rate: number | null;
    average_yield: { unit: string; unit_label: string; average: number; reports: number }[];
    average_days: number;
  }[];
  recent: HarvestOutcomeReport[];
  /** Plants reported dead before harvest. */
  lost_total: number;
  /** Harvested out of harvested + lost; null while there are neither. */
  survival_rate: number | null;
  /** Lost plants BulanTanom had read Medium or High risk for beforehand. */
  warned_before_loss: number;
  warned_before_loss_rate: number | null;
  causes: Breakdown;
  recent_losses: LossOutcomeReport[];
};

export function fetchLguHarvestOutcomes(accessToken: string): Promise<HarvestOutcomes> {
  return apiFetch("/lgu/harvest-outcomes/", { accessToken });
}

export function fetchAdminHarvestOutcomes(accessToken: string): Promise<HarvestOutcomes> {
  return apiFetch("/admin/harvest-outcomes/", { accessToken });
}

/**
 * The four cause groups: calamity; pests and disease; growing conditions
 * (nutrients, soil, water, temperature); farming practice and other.
 */
export type LossCauseGroup = "calamity" | "pest_disease" | "conditions" | "other";

/** One lost plant on the Plant Loss page. */
export type PlantLoss = LossOutcomeReport & {
  plant_id: number;
  farmer_id: number;
  planting_date: string;
  cause_group: LossCauseGroup;
  /** The Farmer said a calamity (typhoon, flood, drought, strong winds) killed it. */
  calamity: boolean;
  /** BulanTanom had read it as High risk, and it died anyway. */
  high_risk_not_saved: boolean;
};

/** Plants that died before harvest, from the Farmers' loss reports. */
export type PlantLosses = {
  total: number;
  calamity: number;
  high_risk_not_saved: number;
  pest_disease: number;
  conditions: number;
  other: number;
  warned_before: number;
  warned_before_rate: number | null;
  harvested: number;
  survival_rate: number | null;
  causes: { value: string; label: string; count: number; calamity: boolean; group: LossCauseGroup }[];
  crops: { crop: string; emoji: string; count: number }[];
  /** This month and the five before it, oldest first; `month` is YYYY-MM. */
  months: { month: string; count: number }[];
  losses: PlantLoss[];
};

export function fetchLguPlantLosses(accessToken: string): Promise<PlantLosses> {
  return apiFetch("/lgu/plant-losses/", { accessToken });
}

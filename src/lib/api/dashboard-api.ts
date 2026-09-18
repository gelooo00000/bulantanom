import { apiFetch } from "@/lib/api/client";

/**
 * The Farmer dashboard payload.
 *
 * One request, assembled by Django in `plants/dashboard_service.py` from
 * MySQL. Nothing here is computed in the browser and nothing is AI-generated
 * — including the overview sentence, which is arithmetic over counts.
 */

export type FarmOverview = {
  headline: string;
  detail: string;
  plant_count: number;
};

export type TrendDay = {
  /** ISO date. Every day in the range is present, quiet days included. */
  date: string;
  count: number;
};

export type AssessmentTrend = {
  days: TrendDay[];
  total: number;
  range_days: number;
  busiest_count: number;
};

export type SoilReadingHistory = {
  /**
   * The soil row's own id. The date does not identify a reading — a farmer
   * can record two on the same day — so this is what the UI keys on.
   */
  id: number;
  date: string;
  /** Null when the farmer did not know the pH — never substituted with 0. */
  ph: number | null;
  moisture: string | null;
  /** Soil moisture as 1–5, so it can be plotted. Null when unknown. */
  moisture_rank: number | null;
};

export type EnvironmentLatest = {
  recorded_on: string;
  soil_moisture: string | null;
  soil_moisture_label: string | null;
  ph_level: number | null;
  soil_type_label: string;
  drainage_label: string;
};

export type FarmEnvironment = {
  has_any: boolean;
  latest: EnvironmentLatest | null;
  history: SoilReadingHistory[];
  /**
   * Readings BulanTanom does not collect anywhere — currently temperature
   * and humidity. Named by the server so the UI can say so plainly instead
   * of rendering an empty gauge that reads as a broken sensor.
   */
  not_collected: string[];
};

export type UpcomingHarvest = {
  plant_id: number;
  name: string;
  crop_name: string;
  emoji: string;
  expected_harvest_start: string;
  days_away: number;
  in_window: boolean;
};

export type FarmAlert = {
  severity: "high" | "medium" | "info";
  message: string;
  href: string;
  action: string;
};

export type FarmerDashboard = {
  overview: FarmOverview;
  assessment_trend: AssessmentTrend;
  environment: FarmEnvironment;
  upcoming_harvests: UpcomingHarvest[];
  alerts: FarmAlert[];
};

export function fetchFarmerDashboard(accessToken: string): Promise<FarmerDashboard> {
  return apiFetch("/farmer/dashboard/", { accessToken });
}

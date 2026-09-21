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

/** One crop the AI suggested for this farm's soil. */
export type SuggestedCrop = {
  /** Catalog id, so the row can preselect it in the Add Plant flow. */
  id: string;
  name: string;
  emoji: string;
  reason: string;
  /**
   * Months this crop is normally planted at Layuan Farm, and the ones that
   * are workable with care. Travels with the suggestion so picking a date
   * needs no extra request — suiting the soil and being in season are
   * separate questions and the card answers both.
   */
  planting_months: number[];
  caution_months: number[];
};

export type CropSuggestions = {
  has_any: boolean;
  /** When the soil assessment behind these suggestions was taken. */
  recorded_on: string | null;
  crops: SuggestedCrop[];
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
  crop_suggestions: CropSuggestions;
  upcoming_harvests: UpcomingHarvest[];
  alerts: FarmAlert[];
};

export function fetchFarmerDashboard(accessToken: string): Promise<FarmerDashboard> {
  return apiFetch("/farmer/dashboard/", { accessToken });
}

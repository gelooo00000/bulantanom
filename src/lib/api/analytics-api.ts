import { apiFetch } from "@/lib/api/client";

/**
 * The global analytics filters, as the filter bar holds them. Empty strings
 * mean "all"; only the filters that are set are sent.
 */
export type AnalyticsFilters = {
  dateFrom: string;
  dateTo: string;
  season: "" | "wet" | "dry";
  soilType: string;
  crop: string;
  farmer: string;
};

export const EMPTY_FILTERS: AnalyticsFilters = {
  dateFrom: "",
  dateTo: "",
  season: "",
  soilType: "",
  crop: "",
  farmer: "",
};

/** Which filters an aggregation honours; the UI says when one does not apply. */
export type FilterKey = "date" | "season" | "soil_type" | "crop" | "farmer";

export function analyticsQuery(f: AnalyticsFilters): string {
  const p = new URLSearchParams();
  if (f.dateFrom) p.set("date_from", f.dateFrom);
  if (f.dateTo) p.set("date_to", f.dateTo);
  if (f.season) p.set("season", f.season);
  if (f.soilType) p.set("soil_type", f.soilType);
  if (f.crop) p.set("crop", f.crop);
  if (f.farmer) p.set("farmer", f.farmer);
  const q = p.toString();
  return q ? `?${q}` : "";
}

const get = <T>(path: string, f: AnalyticsFilters | null, accessToken: string) =>
  apiFetch(`${path}${f ? analyticsQuery(f) : ""}`, { accessToken }) as Promise<T>;

// --- Types ------------------------------------------------------------------

export type FilterOptions = {
  seasons: { key: "wet" | "dry"; label: string }[];
  soil_types: { key: string; label: string }[];
  crops: { id: string; name: string; emoji: string }[];
  farmers: { id: number; name: string }[];
};

export type Trend = {
  current: number;
  previous: number;
  period: { from: string; to: string };
  previous_period: { from: string; to: string };
};

type Kpi = { value: number; trend: Trend; applies: FilterKey[] };

export type AnalyticsSummary = {
  kpis: {
    farmers: Kpi;
    plants: Kpi;
    soil_records: Kpi;
    recommendations: Kpi;
    harvests: Kpi;
    most_recommended: {
      value: { id: string; name: string; emoji: string; count: number; of: number } | null;
      applies: FilterKey[];
    };
  };
};

export type AnalyticsOverview = {
  risk: { LOW: number; MEDIUM: number; HIGH: number; unassessed: number };
  assessment_trend: { week_start: string; count: number }[];
  crops: { name: string; emoji: string; count: number }[];
  farmers: { total: number; approved: number; rejected: number; suspended: number };
  applies: Record<"risk" | "assessment_trend" | "crops" | "farmers", FilterKey[]>;
};

export type CropRecommendationStat = {
  id: string;
  name: string;
  emoji: string;
  count: number;
  rate: number;
  by_soil: { label: string; count: number }[];
  by_season: { wet: number; dry: number };
};

export type CropRecommendations = {
  analysed_records: number;
  crops: CropRecommendationStat[];
  rows: {
    record_id: number;
    crop_id: string;
    crop: string;
    emoji: string;
    rate: number;
    soil_type: string;
    season: string;
    date: string;
    farmer: string;
    reason: string;
  }[];
  row_count: number;
  durations: {
    id: string;
    name: string;
    emoji: string;
    growing_days: number;
    harvest_window_days: number;
    total_days: number;
    planting_months: number[];
  }[];
  applies: FilterKey[];
};

export type RecommendedVsPlanted = {
  crops: { id: string; name: string; emoji: string; recommended: number; planted: number; followed: number }[];
  plants_with_advice: number;
  followed: number;
  follow_rate: number | null;
  applies: FilterKey[];
};

export type HarvestTrends = {
  months: string[];
  planted: number[];
  harvested: number[];
  by_crop: { id: string; name: string; data: number[] }[];
  table: {
    id: string;
    name: string;
    emoji: string;
    planted: number;
    harvested: number;
    ready: number;
    harvest_rate: number;
    avg_days_to_harvest: number | null;
    expected_days: number;
  }[];
  total_harvests: number;
  applies: FilterKey[];
  unit: "harvests";
};

export type Insight = { kind: "harvest" | "recommendation" | "risk" | "monitoring"; text: string };

export type SoilRecordRows = {
  count: number;
  rows: { id: number; farmer: string; location: string; soil_type: string; ph: number | null; moisture: string; date: string }[];
  applies: FilterKey[];
};

export type ReportHistoryEntry = {
  id: number;
  report: string;
  title: string;
  params: Record<string, string>;
  format: "pdf" | "csv";
  created_at: string;
  by: string | null;
};

// --- Fetchers ---------------------------------------------------------------

export const fetchFilterOptions = (t: string) => get<FilterOptions>("/analytics/filters/", null, t);
export const fetchSummary = (t: string, f: AnalyticsFilters) => get<AnalyticsSummary>("/analytics/summary/", f, t);
export const fetchOverview = (t: string, f: AnalyticsFilters) => get<AnalyticsOverview>("/analytics/overview/", f, t);
export const fetchCropRecommendations = (t: string, f: AnalyticsFilters) =>
  get<CropRecommendations>("/analytics/crop-recommendations/", f, t);
export const fetchRecommendedVsPlanted = (t: string, f: AnalyticsFilters) =>
  get<RecommendedVsPlanted>("/analytics/recommended-vs-planted/", f, t);
export const fetchHarvestTrends = (t: string, f: AnalyticsFilters) => get<HarvestTrends>("/analytics/harvest-trends/", f, t);
export const fetchInsights = (t: string, f: AnalyticsFilters) =>
  get<{ insights: Insight[] }>("/analytics/insights/", f, t);
export const fetchSoilRecords = (t: string, f: AnalyticsFilters) => get<SoilRecordRows>("/soil-records/", f, t);
export const fetchReportHistory = (t: string) => get<{ results: ReportHistoryEntry[] }>("/reports/", null, t);

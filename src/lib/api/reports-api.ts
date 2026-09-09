import { apiFetch, refreshAccessToken } from "@/lib/api/client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export type ReportPeriodKey =
  | "this_week"
  | "this_month"
  | "last_3_months"
  | "this_year"
  | "all_time"
  | "custom";

export type ReportSummaryItem = {
  slug: string;
  title: string;
  category: string;
  description: string;
  icon: string;
  supports: string[];
  /** ISO date of the newest record the report covers, or null when empty. */
  updated: string | null;
  latest?: boolean;
};

export type ReportStat = {
  label: string;
  value: number;
  tone?: "low" | "medium" | "high";
};

export type ReportTable = {
  title: string;
  columns: string[];
  keys: string[];
  rows: Record<string, string | number | boolean>[];
  /** Rendered in a horizontally scrollable frame and printed landscape. */
  wide?: boolean;
};

export type ReportDetail = {
  heading: string;
  analysed: boolean;
  unavailable: string;
  sections: { label: string; text: string }[];
};

export type ReportDocument = {
  slug: string;
  title: string;
  category: string;
  description: string;
  icon: string;
  supports: string[];
  farm: { name: string; location: string };
  period: {
    key: ReportPeriodKey;
    label: string;
    range: string;
    start: string | null;
    end: string | null;
  };
  generated_at: string;
  stats: ReportStat[];
  tables: ReportTable[];
  details: ReportDetail[];
};

export type ReportFilterOptions = {
  farmers: { id: number; name: string }[];
  crops: { id: string; name: string }[];
  periods: { key: ReportPeriodKey; label: string }[];
  risk_levels: { key: string; label: string }[];
};

export type ReportCatalog = {
  reports: ReportSummaryItem[];
  filters: ReportFilterOptions;
};

export type ReportQuery = {
  period: ReportPeriodKey;
  dateFrom?: string;
  dateTo?: string;
  farmer?: string;
  crop?: string;
  riskLevel?: string;
};

/** Only the filters a given report actually supports are sent. */
export function reportQueryString(query: ReportQuery, supports: string[]): string {
  const params = new URLSearchParams();
  params.set("period", query.period);
  if (query.period === "custom") {
    if (query.dateFrom) params.set("date_from", query.dateFrom);
    if (query.dateTo) params.set("date_to", query.dateTo);
  }
  if (supports.includes("farmer") && query.farmer && query.farmer !== "all") {
    params.set("farmer", query.farmer);
  }
  if (supports.includes("crop") && query.crop && query.crop !== "all") {
    params.set("crop", query.crop);
  }
  if (supports.includes("risk_level") && query.riskLevel && query.riskLevel !== "ALL") {
    params.set("risk_level", query.riskLevel);
  }
  return params.toString();
}

export function fetchReportCatalog(accessToken: string): Promise<ReportCatalog> {
  return apiFetch("/lgu/reports/", { accessToken });
}

export function fetchReport(
  accessToken: string,
  slug: string,
  query: ReportQuery,
  supports: string[],
): Promise<ReportDocument> {
  return apiFetch(`/lgu/reports/${slug}/?${reportQueryString(query, supports)}`, {
    accessToken,
  });
}

/**
 * Downloads the server-rendered PDF.
 *
 * `apiFetch` parses JSON, so this goes direct to keep the response as bytes.
 * The endpoint is Bearer-authorized like every other LGU route, which is why
 * the file cannot simply be linked to with an anchor.
 */
export async function downloadReportPdf(
  accessToken: string,
  slug: string,
  query: ReportQuery,
  supports: string[],
): Promise<void> {
  const path = `/lgu/reports/${slug}/pdf/?${reportQueryString(query, supports)}`;
  const send = (token: string) =>
    fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      headers: { Authorization: `Bearer ${token}` },
    });

  let response = await send(accessToken);
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await send(refreshed);
  }
  if (!response.ok) {
    throw new Error("Unable to generate the PDF. Please try again.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `bulantanom-${slug}-${query.period}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { EMPTY_FILTERS, type AnalyticsFilters, type FilterKey } from "@/lib/api/analytics-api";

const PARAM: Record<keyof AnalyticsFilters, string> = {
  dateFrom: "date_from",
  dateTo: "date_to",
  season: "season",
  soilType: "soil_type",
  crop: "crop",
  farmer: "farmer",
};

/**
 * The analytics filters, kept in the page address so a filtered view
 * survives a reload, can be shared as a link, and carries over when the
 * Officer follows a card's link to its full page.
 */
export function useAnalyticsFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo<AnalyticsFilters>(() => {
    const out = { ...EMPTY_FILTERS };
    for (const key of Object.keys(PARAM) as (keyof AnalyticsFilters)[]) {
      const value = params.get(PARAM[key]) ?? "";
      (out as Record<string, string>)[key] = value;
    }
    if (out.season !== "wet" && out.season !== "dry") out.season = "";
    return out;
  }, [params]);

  const setFilters = useCallback(
    (patch: Partial<AnalyticsFilters>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch) as [keyof AnalyticsFilters, string][]) {
        if (value) next.set(PARAM[key], value);
        else next.delete(PARAM[key]);
      }
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const reset = useCallback(() => router.replace(pathname, { scroll: false }), [pathname, router]);

  /** The query string to carry the filters to another analytics page. */
  const carry = params.toString() ? `?${params.toString()}` : "";

  return { filters, setFilters, reset, carry };
}

const FILTER_NAMES: Record<FilterKey, string> = {
  date: "date range",
  season: "season",
  soil_type: "soil type",
  crop: "crop",
  farmer: "farmer",
};

/** Active filters that a card does not honour, named for a short note. */
export function ignoredFilters(filters: AnalyticsFilters, applies: FilterKey[]): string[] {
  const active: FilterKey[] = [];
  if (filters.dateFrom || filters.dateTo) active.push("date");
  if (filters.season) active.push("season");
  if (filters.soilType) active.push("soil_type");
  if (filters.crop) active.push("crop");
  if (filters.farmer) active.push("farmer");
  return active.filter((k) => !applies.includes(k)).map((k) => FILTER_NAMES[k]);
}

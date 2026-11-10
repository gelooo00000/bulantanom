"use client";

import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";

import {
  Breadcrumbs,
  CardState,
  ChartCard,
  LiveDataNote,
} from "@/components/analytics/cards";
import { CROP_PAGE_SIZE, HorizontalBars, WeeklyColumns } from "@/components/lgu/dashboard-charts";
import { RiskOverview } from "@/components/lgu/risk-overview";
import { PageHeader } from "@/components/shared/page-header";
import {
  analyticsQuery,
  EMPTY_FILTERS,
  fetchOverview,
  type AnalyticsFilters,
} from "@/lib/api/analytics-api";
import { fetchLguPlants } from "@/lib/api/lgu-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { livePlants } from "@/lib/lgu-plant-stats";
import { cropColor } from "@/lib/crop-colors";

/** A query that refetches whenever the filters change. */
export function useFiltered<T>(fetcher: (token: string, f: AnalyticsFilters) => Promise<T>, filters: AnalyticsFilters) {
  return useAuthedQuery<T>((token) => fetcher(token, filters), [analyticsQuery(filters)]);
}

/**
 * The Agricultural Analytics System: the farm cards, always
 * across every record. The dashboard has no
 * filter bar, so it deliberately ignores any filters left in the address.
 * All figures come from /api/analytics/*, counted at request time.
 */
export function AnalyticsDashboard() {
  const filters = EMPTY_FILTERS;

  const overview = useFiltered(fetchOverview, filters);
  // The plant list behind the Plant risk card, the same one Risk Overview reads.
  const plantsQuery = useAuthedQuery(fetchLguPlants);

  const highRisk = overview.data?.risk.HIGH ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Breadcrumbs items={[{ label: "LGU" }, { label: "Agricultural Analytics" }]} />
        <PageHeader
          title="Agricultural Analytics System"
          description="Soil, crop, and farm analytics for Layuan Nature Integrated Farm, Bulan, Sorsogon."
        />
      </div>

      {highRisk > 0 && (
        <div role="alert" className="border-risk-high/40 bg-risk-high/10 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <TriangleAlert className="text-risk-high mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-heading text-risk-high text-sm font-medium">
                {highRisk} plant{highRisk === 1 ? "" : "s"} reading high risk
              </p>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {highRisk === 1 ? "This plant" : "These plants"} had a high-risk result on the latest
                weekly check. Review the AI reasoning and evidence photo before contacting the farmer.
              </p>
            </div>
          </div>
          <Link href="/lgu/high-risk" className="border-risk-high/40 text-risk-high hover:bg-risk-high/15 inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors sm:self-auto">
            Review cases
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}

      {/* Weekly assessments and Crops planted side by side; the plant risk,
          as on Risk Overview, across the full width below. */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Weekly assessments" description="Are farmers keeping up their weekly plant checks?">
          <CardState query={overview}>{(d) => <WeeklyColumns weeks={d.assessment_trend} />}</CardState>
        </ChartCard>

        <ChartCard title="Crops planted" description="Plants per crop at Layuan, most planted first." href="/lgu/plants" linkLabel="All plants">
          <CardState query={overview} isEmpty={(d) => d.crops.length === 0} emptyHint="No plants recorded yet.">
            {(d) => (
              <HorizontalBars
                rows={d.crops.map((c) => ({ key: c.name, label: c.name, emoji: c.emoji, value: c.count, color: cropColor(c.name) }))}
                unit="plant" label="Plants per crop" pageSize={CROP_PAGE_SIZE}
              />
            )}
          </CardState>
        </ChartCard>

        <ChartCard
          title="Plant risk"
          description="Latest AI reading for each plant — point at a level to see its crops."
          href="/lgu/risks"
          linkLabel="Risk overview"
          className="lg:col-span-2"
        >
          <CardState query={plantsQuery} isEmpty={(list) => livePlants(list).length === 0} emptyHint="No plants recorded yet.">
            {(list) => <RiskOverview plants={livePlants(list)} bare />}
          </CardState>
        </ChartCard>
      </div>

      <LiveDataNote />
    </div>
  );
}

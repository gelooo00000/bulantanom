"use client";

import Link from "next/link";
import { ArrowRight, CircleHelp, Leaf, OctagonAlert, Sprout, Star, TriangleAlert, Users } from "lucide-react";

import {
  Breadcrumbs,
  CardState,
  ChartCard,
  LiveDataNote,
  StatCard,
} from "@/components/analytics/cards";
import { CROP_PAGE_SIZE, HorizontalBars, WeeklyColumns, type BarRow } from "@/components/lgu/dashboard-charts";
import { RiskPie } from "@/components/lgu/risk-pie";
import { PageHeader } from "@/components/shared/page-header";
import {
  analyticsQuery,
  EMPTY_FILTERS,
  fetchOverview,
  fetchSummary,
  type AnalyticsFilters,
} from "@/lib/api/analytics-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";

/** A query that refetches whenever the filters change. */
export function useFiltered<T>(fetcher: (token: string, f: AnalyticsFilters) => Promise<T>, filters: AnalyticsFilters) {
  return useAuthedQuery<T>((token) => fetcher(token, filters), [analyticsQuery(filters)]);
}

/**
 * The Agricultural Analytics System: KPIs and the four farm cards, always
 * across every record. The dashboard has no
 * filter bar, so it deliberately ignores any filters left in the address.
 * All figures come from /api/analytics/*, counted at request time.
 */
export function AnalyticsDashboard() {
  const filters = EMPTY_FILTERS;

  const summary = useFiltered(fetchSummary, filters);
  const overview = useFiltered(fetchOverview, filters);

  const k = summary.data?.kpis;
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

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Total farmers" icon={Users} loading={!k} value={k?.farmers.value ?? 0} trend={k?.farmers.trend} />
        <StatCard label="Total plants" icon={Sprout} loading={!k} value={k?.plants.value ?? 0} trend={k?.plants.trend} />
        <StatCard
          label="Most recommended crop"
          icon={Star}
          loading={!k}
          value={k?.most_recommended.value ? `${k.most_recommended.value.emoji} ${k.most_recommended.value.name}` : "No data yet"}
          hint={k?.most_recommended.value ? `In ${k.most_recommended.value.count} of ${k.most_recommended.value.of} analysed records` : "No analysed soil records"}
        />
      </div>
      {summary.error && (
        <p className="text-risk-high text-xs">
          The figures could not load: {summary.error}{" "}
          <button type="button" className="underline" onClick={summary.refetch}>Try again</button>
        </p>
      )}

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

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Plant risk" description="Latest AI reading per plant across approved farmers." href="/lgu/risks" linkLabel="Risk overview">
          <CardState query={overview} isEmpty={(d) => d.risk.LOW + d.risk.MEDIUM + d.risk.HIGH + d.risk.unassessed === 0}
            emptyHint="No plants recorded yet.">
            {(d) => {
              const rows: BarRow[] = [
                { key: "HIGH", label: "High risk", value: d.risk.HIGH, color: "var(--risk-high)", icon: OctagonAlert },
                { key: "MEDIUM", label: "Medium risk", value: d.risk.MEDIUM, color: "var(--risk-medium)", icon: TriangleAlert },
                { key: "LOW", label: "Low risk", value: d.risk.LOW, color: "var(--risk-low)", icon: Leaf },
                { key: "none", label: "No reading yet", value: d.risk.unassessed, color: "var(--muted-foreground)", icon: CircleHelp },
              ];
              return (
                <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,180px)_1fr]">
                  <RiskPie rows={rows} />
                  <HorizontalBars rows={rows} unit="plant" label="Plants by risk level" />
                </div>
              );
            }}
          </CardState>
        </ChartCard>

        <ChartCard title="Weekly assessments" description="Are farmers keeping up their weekly plant checks?">
          <CardState query={overview}>{(d) => <WeeklyColumns weeks={d.assessment_trend} />}</CardState>
        </ChartCard>

        <ChartCard title="Crops planted" description="Plants per crop at Layuan, most planted first." href="/lgu/plants" linkLabel="All plants">
          <CardState query={overview} isEmpty={(d) => d.crops.length === 0} emptyHint="No plants recorded yet.">
            {(d) => (
              <HorizontalBars
                rows={d.crops.map((c) => ({ key: c.name, label: c.name, emoji: c.emoji, value: c.count, color: "var(--primary)" }))}
                unit="plant" label="Plants per crop" pageSize={CROP_PAGE_SIZE}
              />
            )}
          </CardState>
        </ChartCard>

        <ChartCard title="Farmer accounts" description="Farmer accounts by status." href="/lgu/farmers" linkLabel="Farmer records">
          <CardState query={overview} isEmpty={(d) => d.farmers.total === 0} emptyHint="No farmer accounts yet.">
            {(d) => (
              <HorizontalBars
                rows={[
                  { key: "approved", label: "Approved", value: d.farmers.approved, color: "var(--primary)" },
                  { key: "rejected", label: "Rejected", value: d.farmers.rejected, color: "var(--muted-foreground)" },
                  { key: "suspended", label: "Suspended", value: d.farmers.suspended, color: "var(--muted-foreground)" },
                ]}
                unit="farmer" label="Farmer accounts by status"
              />
            )}
          </CardState>
        </ChartCard>
      </div>

      <LiveDataNote />
    </div>
  );
}

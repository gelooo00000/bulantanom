"use client";

import Link from "next/link";
import {
  ArrowRight,
  CircleHelp,
  FlaskConical,
  Leaf,
  OctagonAlert,
  Sprout,
  Star,
  TriangleAlert,
  Users,
  Wheat,
} from "lucide-react";

import { AnalyticsChart } from "@/components/analytics/analytics-chart";
import {
  AdvisoryNote,
  Breadcrumbs,
  CardState,
  ChartCard,
  InsightCard,
  LiveDataNote,
  StatCard,
} from "@/components/analytics/cards";
import { FilterBar } from "@/components/analytics/filter-bar";
import { MapPanel } from "@/components/analytics/map-panel";
import { CROP_PAGE_SIZE, HorizontalBars, WeeklyColumns, type BarRow } from "@/components/lgu/dashboard-charts";
import { RiskPie } from "@/components/lgu/risk-pie";
import { PageHeader } from "@/components/shared/page-header";
import { ignoredFilters, useAnalyticsFilters } from "@/lib/analytics/use-analytics-filters";
import {
  analyticsQuery,
  fetchCropRecommendations,
  fetchHarvestTrends,
  fetchInsights,
  fetchOverview,
  fetchRecommendedVsPlanted,
  fetchSoilMap,
  fetchSummary,
  type AnalyticsFilters,
} from "@/lib/api/analytics-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";

/** A query that refetches whenever the filters change. */
export function useFiltered<T>(fetcher: (token: string, f: AnalyticsFilters) => Promise<T>, filters: AnalyticsFilters) {
  return useAuthedQuery<T>((token) => fetcher(token, filters), [analyticsQuery(filters)]);
}

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export const ANALYTICS_HOME = "/lgu/analytics";

/** Distinct series colours that hold up in both themes. */
export const CROP_COLORS = ["var(--primary)", "var(--chart-series-1)", "var(--risk-medium)", "var(--risk-high)", "var(--muted-foreground)"];

/**
 * The Agricultural Analytics System: KPIs, the global filter bar, and every
 * card, chart and the map reading those filters. All figures come from
 * /api/analytics/*, counted from the database at request time.
 */
export function AnalyticsDashboard() {
  const { filters, setFilters, reset, carry } = useAnalyticsFilters();

  const summary = useFiltered(fetchSummary, filters);
  const overview = useFiltered(fetchOverview, filters);
  const recs = useFiltered(fetchCropRecommendations, filters);
  const rvp = useFiltered(fetchRecommendedVsPlanted, filters);
  const harvest = useFiltered(fetchHarvestTrends, filters);
  const map = useFiltered(fetchSoilMap, filters);
  const insights = useFiltered(fetchInsights, filters);

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
      <AdvisoryNote />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total farmers" icon={Users} loading={!k} value={k?.farmers.value ?? 0} trend={k?.farmers.trend} />
        <StatCard label="Total plants" icon={Sprout} loading={!k} value={k?.plants.value ?? 0} trend={k?.plants.trend} />
        <StatCard label="Soil records submitted" icon={FlaskConical} loading={!k} value={k?.soil_records.value ?? 0} trend={k?.soil_records.trend} />
        <StatCard label="Crop recommendations" icon={Leaf} loading={!k} value={k?.recommendations.value ?? 0} trend={k?.recommendations.trend} />
        <StatCard label="Harvests recorded" icon={Wheat} loading={!k} value={k?.harvests.value ?? 0} trend={k?.harvests.trend} />
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

      <FilterBar filters={filters} onChange={setFilters} onReset={reset} />

      {highRisk > 0 && (
        <div role="alert" className="border-risk-high/40 bg-risk-high/10 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <TriangleAlert className="text-risk-high mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-heading text-risk-high text-sm font-medium">
                {highRisk} plant{highRisk === 1 ? "" : "s"} reading high risk
              </p>
              <p className="text-muted-foreground mt-0.5 text-sm">
                From the latest weekly check{highRisk === 1 ? "" : "s"} in this view. Review the AI
                reasoning and evidence photo before contacting the farmer.
              </p>
            </div>
          </div>
          <Link href="/lgu/high-risk" className="border-risk-high/40 text-risk-high hover:bg-risk-high/15 inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors sm:self-auto">
            Review cases
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}

      {/* The original four cards, now following the filters. */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Plant risk" description="Latest AI reading per plant across approved farmers." href="/lgu/risks" linkLabel="Risk overview"
          ignored={overview.data ? ignoredFilters(filters, overview.data.applies.risk) : []}>
          <CardState query={overview} isEmpty={(d) => d.risk.LOW + d.risk.MEDIUM + d.risk.HIGH + d.risk.unassessed === 0}
            emptyHint="No plants match these filters.">
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

        <ChartCard title="Weekly assessments" description="Are farmers keeping up their weekly plant checks?" href="/lgu/assessments" linkLabel="History"
          ignored={overview.data ? ignoredFilters(filters, overview.data.applies.assessment_trend) : []}>
          <CardState query={overview}>{(d) => <WeeklyColumns weeks={d.assessment_trend} />}</CardState>
        </ChartCard>

        <ChartCard title="Crops planted" description="Plants per crop at Layuan, most planted first." href="/lgu/plants" linkLabel="All plants"
          ignored={overview.data ? ignoredFilters(filters, overview.data.applies.crops) : []}>
          <CardState query={overview} isEmpty={(d) => d.crops.length === 0} emptyHint="No plants match these filters.">
            {(d) => (
              <HorizontalBars
                rows={d.crops.map((c) => ({ key: c.name, label: c.name, emoji: c.emoji, value: c.count, color: "var(--primary)" }))}
                unit="plant" label="Plants per crop" pageSize={CROP_PAGE_SIZE}
              />
            )}
          </CardState>
        </ChartCard>

        <ChartCard title="Farmer accounts" description="Farmer accounts by status." href="/lgu/farmers" linkLabel="Farmer records"
          ignored={overview.data ? ignoredFilters(filters, overview.data.applies.farmers) : []}>
          <CardState query={overview} isEmpty={(d) => d.farmers.total === 0} emptyHint="No farmer accounts match these filters.">
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

        {/* New cards */}
        <ChartCard title="Crop recommendations" description="Crops the system recommended most, by soil type and season."
          href={`/lgu/crop-recommendations${carry}`} linkLabel="All recommendations"
          ignored={recs.data ? ignoredFilters(filters, recs.data.applies) : []}>
          <CardState query={recs} isEmpty={(d) => d.crops.length === 0} emptyHint="No analysed soil records match these filters.">
            {(d) => {
              const top = d.crops.slice(0, 6);
              return (
                <div className="flex flex-col gap-3">
                  <AnalyticsChart
                    type="bar"
                    horizontal
                    stacked
                    height={Math.max(160, top.length * 40 + 50)}
                    categories={top.map((c) => `${c.emoji} ${c.name}`)}
                    series={[
                      { name: "Wet season", data: top.map((c) => c.by_season.wet), color: "var(--chart-series-1)" },
                      { name: "Dry season", data: top.map((c) => c.by_season.dry), color: "var(--risk-medium)" },
                    ]}
                    unit="recommendation"
                    label="Top recommended crops by season"
                  />
                  <ul className="text-muted-foreground flex flex-col gap-1 text-[11px]">
                    {top.slice(0, 3).map((c) => (
                      <li key={c.id}>
                        <span className="text-foreground font-medium">{c.name}</span> ({c.rate}% of records) on{" "}
                        {c.by_soil.map((s) => `${s.label} ${s.count}`).join(", ")}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }}
          </CardState>
        </ChartCard>

        <ChartCard title="Recommended vs. planted" description="How closely farmers plant what their soil records recommended."
          ignored={rvp.data ? ignoredFilters(filters, rvp.data.applies) : []}>
          <CardState query={rvp} isEmpty={(d) => d.crops.length === 0} emptyHint="No recommendations or plantings match these filters.">
            {(d) => {
              const top = d.crops.slice(0, 7);
              return (
                <div className="flex flex-col gap-3">
                  <p className="text-sm">
                    {d.follow_rate === null ? (
                      <span className="text-muted-foreground">No planting was made after a soil recommendation yet.</span>
                    ) : (
                      <>
                        <span className="font-heading text-primary text-2xl font-medium">{d.follow_rate}%</span>{" "}
                        <span className="text-muted-foreground">
                          of plantings after a recommendation used a recommended crop ({d.followed} of {d.plants_with_advice}).
                        </span>
                      </>
                    )}
                  </p>
                  <AnalyticsChart
                    type="bar"
                    height={240}
                    categories={top.map((c) => c.name)}
                    series={[
                      { name: "Recommended", data: top.map((c) => c.recommended), color: "var(--chart-series-1)" },
                      { name: "Planted", data: top.map((c) => c.planted), color: "var(--primary)" },
                      { name: "Planted as recommended", data: top.map((c) => c.followed), color: "var(--risk-low)" },
                    ]}
                    unit="record"
                    label="Recommended crops compared with crops planted"
                  />
                </div>
              );
            }}
          </CardState>
        </ChartCard>
      </div>

      <ChartCard title="Harvest and productivity trend" description="Plantings and harvests per month. Harvests are counted, not weighed: no yield in kilograms is recorded."
        href={`/lgu/harvest${carry}`} linkLabel="Harvest & monitoring"
        ignored={harvest.data ? ignoredFilters(filters, harvest.data.applies) : []}>
        <CardState query={harvest} isEmpty={(d) => d.planted.every((n) => n === 0) && d.harvested.every((n) => n === 0)}
          emptyHint="No plantings or harvests in this period.">
          {(d) => (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <AnalyticsChart
                type="area"
                height={260}
                categories={d.months.map(monthLabel)}
                series={[
                  { name: "Planted", data: d.planted, color: "var(--chart-series-1)" },
                  { name: "Harvested", data: d.harvested, color: "var(--primary)" },
                ]}
                unit="plant"
                label="Plantings and harvests per month"
              />
              {d.by_crop.length > 0 ? (
                <AnalyticsChart
                  type="bar"
                  stacked
                  height={260}
                  categories={d.months.map(monthLabel)}
                  series={d.by_crop.map((c, i) => ({ name: c.name, data: c.data, color: CROP_COLORS[i % CROP_COLORS.length] }))}
                  unit="harvest"
                  label="Harvests per crop per month"
                />
              ) : (
                <div className="border-border text-muted-foreground flex items-center justify-center rounded-xl border border-dashed p-6 text-center text-xs">
                  No harvest recorded in this period yet, so there is no per-crop breakdown.
                </div>
              )}
            </div>
          )}
        </CardState>
      </ChartCard>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ChartCard title="Soil distribution map" description="Soil records at Layuan, coloured by soil type. Records are not geotagged, so they sit under the farm's marker."
          href={`/lgu/soil-map${carry}`} linkLabel="Full map"
          ignored={map.data ? ignoredFilters(filters, map.data.applies) : []}>
          <CardState query={map} minHeight={320}>
            {(d) => <MapPanel data={d} height={320} selectedSoil={filters.soilType} onSelectSoil={(soilType) => setFilters({ soilType })} />}
          </CardState>
        </ChartCard>

        <ChartCard title="Analytics insights" description="Observations computed from the records in view.">
          <CardState query={insights} isEmpty={(d) => d.insights.length === 0} emptyHint="There is not enough data in this view for an observation.">
            {(d) => <InsightCard items={d.insights} />}
          </CardState>
        </ChartCard>
      </div>

      <LiveDataNote />
    </div>
  );
}

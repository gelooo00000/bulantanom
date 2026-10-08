"use client";

import { AnalyticsChart } from "@/components/analytics/analytics-chart";
import { CROP_COLORS, monthLabel, useFiltered } from "@/components/analytics/analytics-dashboard";
import { CardState, ChartCard } from "@/components/analytics/cards";
import { DataTable } from "@/components/analytics/data-table";
import { FilterBar } from "@/components/analytics/filter-bar";
import { ignoredFilters, useAnalyticsFilters } from "@/lib/analytics/use-analytics-filters";
import { fetchHarvestTrends, type HarvestTrends } from "@/lib/api/analytics-api";

/**
 * Productivity for Harvest & Monitoring: plantings and harvests per month,
 * harvests per crop, and a yield table. Harvests are counted - BulanTanom
 * records that a plant was harvested and when, not how much it yielded.
 */
export function HarvestProductivity() {
  const { filters, setFilters, reset } = useAnalyticsFilters();
  const query = useFiltered(fetchHarvestTrends, filters);
  const ignored = query.data ? ignoredFilters(filters, query.data.applies) : [];

  return (
    <section aria-labelledby="productivity-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="productivity-heading" className="font-heading text-lg font-medium">Productivity</h2>
        <p className="text-muted-foreground text-sm">
          Plantings and harvests over time, and how much of each crop reached harvest. Harvests are
          counted, not weighed.
        </p>
      </div>
      <FilterBar filters={filters} onChange={setFilters} onReset={reset} hide={["soilType"]} />

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Planting vs. harvest" description="Plants planted and harvested per month." ignored={ignored}>
          <CardState query={query} isEmpty={(d) => d.planted.every((n) => !n) && d.harvested.every((n) => !n)} emptyHint="No plantings or harvests in this period.">
            {(d) => (
              <AnalyticsChart
                type="line"
                height={260}
                categories={d.months.map(monthLabel)}
                series={[
                  { name: "Planted", data: d.planted, color: "var(--chart-series-1)" },
                  { name: "Harvested", data: d.harvested, color: "var(--primary)" },
                ]}
                unit="plant"
                label="Plants planted and harvested per month"
              />
            )}
          </CardState>
        </ChartCard>
        <ChartCard title="Harvests per crop" description="The five most harvested crops, per month." ignored={ignored}>
          <CardState query={query} isEmpty={(d) => d.by_crop.length === 0} emptyHint="No harvest recorded in this period yet.">
            {(d) => (
              <AnalyticsChart
                type="bar"
                stacked
                height={260}
                categories={d.months.map(monthLabel)}
                series={d.by_crop.map((c, i) => ({ name: c.name, data: c.data, color: CROP_COLORS[i % CROP_COLORS.length] }))}
                unit="harvest"
                label="Harvests per crop per month"
              />
            )}
          </CardState>
        </ChartCard>
      </div>

      <ChartCard title="Yield by crop" description="Planted, harvested and ready plants per crop, with the share harvested and the average days from planting to harvest." ignored={ignored}>
        <CardState query={query} isEmpty={(d) => d.table.length === 0} emptyHint="No plants match these filters.">
          {(d) => (
            <DataTable<HarvestTrends["table"][number]>
              caption="Yield by crop"
              rows={d.table}
              rowKey={(r) => r.id}
              columns={[
                { key: "name", header: "Crop", render: (r) => `${r.emoji} ${r.name}` },
                { key: "planted", header: "Planted", align: "right" },
                { key: "harvested", header: "Harvested", align: "right" },
                { key: "harvest_rate", header: "Harvest rate", align: "right", render: (r) => `${r.harvest_rate}%` },
                { key: "ready", header: "Ready now", align: "right" },
                {
                  key: "avg_days_to_harvest",
                  header: "Avg. days to harvest",
                  align: "right",
                  render: (r) => (r.avg_days_to_harvest != null ? r.avg_days_to_harvest : "No harvest yet"),
                },
                { key: "expected_days", header: "Expected days", align: "right" },
              ]}
            />
          )}
        </CardState>
      </ChartCard>
    </section>
  );
}

"use client";

import { Suspense } from "react";

import { AnalyticsChart } from "@/components/analytics/analytics-chart";
import { useFiltered } from "@/components/analytics/analytics-dashboard";
import { AnalyticsPage } from "@/components/analytics/analytics-page";
import { CardState, ChartCard, StatCard } from "@/components/analytics/cards";
import { DataTable } from "@/components/analytics/data-table";
import { ignoredFilters } from "@/lib/analytics/use-analytics-filters";
import { fetchCropRecommendations, type AnalyticsFilters, type CropRecommendations } from "@/lib/api/analytics-api";
import { CalendarClock, FlaskConical, Leaf } from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function RecommendationAnalytics({ filters }: { filters: AnalyticsFilters }) {
  const query = useFiltered(fetchCropRecommendations, filters);
  const ignored = query.data ? ignoredFilters(filters, query.data.applies) : [];
  const d = query.data;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Analysed soil records" icon={FlaskConical} loading={!d} value={d?.analysed_records ?? 0} hint="With a generated recommendation" />
        <StatCard label="Crops recommended" icon={Leaf} loading={!d} value={d?.crops.length ?? 0} hint="Distinct crops" />
        <StatCard label="Recommendations made" icon={CalendarClock} loading={!d} value={d?.row_count ?? 0} hint="Crop suggestions across records" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Most recommended crops" description="By season. The rate is the share of analysed soil records that recommended the crop." ignored={ignored}>
          <CardState query={query} isEmpty={(x) => x.crops.length === 0} emptyHint="No analysed soil records match these filters.">
            {(x) => {
              const top = x.crops.slice(0, 10);
              return (
                <AnalyticsChart
                  type="bar"
                  horizontal
                  stacked
                  height={Math.max(180, top.length * 34 + 60)}
                  categories={top.map((c) => `${c.emoji} ${c.name} (${c.rate}%)`)}
                  series={[
                    { name: "Wet season", data: top.map((c) => c.by_season.wet), color: "var(--chart-series-1)" },
                    { name: "Dry season", data: top.map((c) => c.by_season.dry), color: "var(--risk-medium)" },
                  ]}
                  unit="recommendation"
                  label="Most recommended crops by season"
                />
              );
            }}
          </CardState>
        </ChartCard>

        <ChartCard title="By soil type" description="How often each top crop was recommended on each recorded soil type." ignored={ignored}>
          <CardState query={query} isEmpty={(x) => x.crops.length === 0}>
            {(x) => {
              const top = x.crops.slice(0, 8);
              const soils = [...new Set(top.flatMap((c) => c.by_soil.map((s) => s.label)))];
              const palette = ["var(--primary)", "var(--chart-series-1)", "var(--risk-medium)", "var(--risk-high)", "var(--muted-foreground)", "var(--risk-low)"];
              return (
                <AnalyticsChart
                  type="bar"
                  stacked
                  height={280}
                  categories={top.map((c) => c.name)}
                  series={soils.map((label, i) => ({
                    name: label,
                    data: top.map((c) => c.by_soil.find((s) => s.label === label)?.count ?? 0),
                    color: palette[i % palette.length],
                  }))}
                  unit="recommendation"
                  label="Recommendations by soil type"
                />
              );
            }}
          </CardState>
        </ChartCard>
      </div>

      <ChartCard title="Recommendations" description="Each crop recommended in each analysed soil record." ignored={ignored}>
        <CardState query={query} isEmpty={(x) => x.rows.length === 0} emptyHint="No recommendations match these filters.">
          {(x) => (
            <DataTable<CropRecommendations["rows"][number]>
              caption="Crop recommendations"
              rows={x.rows}
              rowKey={(r) => `${r.record_id}-${r.crop_id}`}
              searchable
              searchLabel="Search recommendations"
              columns={[
                { key: "crop", header: "Crop", render: (r) => `${r.emoji} ${r.crop}` },
                { key: "rate", header: "Recommendation rate", align: "right", render: (r) => `${r.rate}%` },
                { key: "soil_type", header: "Soil type" },
                { key: "season", header: "Season" },
                { key: "date", header: "Date" },
                { key: "farmer", header: "Farmer" },
              ]}
            />
          )}
        </CardState>
      </ChartCard>

      <ChartCard title="Estimated planting and harvest duration" description="From the crop catalogue: days from planting to the start of harvest, and how long the harvest window lasts.">
        <CardState query={query} isEmpty={(x) => x.durations.length === 0}>
          {(x) => (
            <DataTable<CropRecommendations["durations"][number]>
              caption="Planting and harvest duration per crop"
              rows={x.durations}
              rowKey={(r) => r.id}
              columns={[
                { key: "name", header: "Crop", render: (r) => `${r.emoji} ${r.name}` },
                { key: "growing_days", header: "Planting to harvest (days)", align: "right" },
                { key: "harvest_window_days", header: "Harvest window (days)", align: "right" },
                { key: "total_days", header: "Total (days)", align: "right" },
                {
                  key: "planting_months",
                  header: "Usual planting months",
                  value: (r) => r.planting_months.map((m) => MONTHS[m - 1]).join(", "),
                  render: (r) => (r.planting_months.length ? r.planting_months.map((m) => MONTHS[m - 1]).join(", ") : "Not on record"),
                },
              ]}
            />
          )}
        </CardState>
      </ChartCard>
    </>
  );
}

export default function CropRecommendationsPage() {
  return (
    <Suspense>
      <AnalyticsPage
        title="Crop Recommendations"
        description="What the system recommended from farmers' soil records, and how long each crop takes."
        advisory
      >
        {(filters) => <RecommendationAnalytics filters={filters} />}
      </AnalyticsPage>
    </Suspense>
  );
}

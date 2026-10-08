"use client";

import { Suspense } from "react";

import { useFiltered } from "@/components/analytics/analytics-dashboard";
import { AnalyticsPage } from "@/components/analytics/analytics-page";
import { CardState, ChartCard } from "@/components/analytics/cards";
import { DataTable } from "@/components/analytics/data-table";
import { MapPanel, SOIL_COLORS } from "@/components/analytics/map-panel";
import { ignoredFilters } from "@/lib/analytics/use-analytics-filters";
import { fetchSoilMap, type AnalyticsFilters, type SoilMapRecord } from "@/lib/api/analytics-api";

function SoilMapView({ filters, setFilters }: { filters: AnalyticsFilters; setFilters: (p: Partial<AnalyticsFilters>) => void }) {
  const query = useFiltered(fetchSoilMap, filters);
  const ignored = query.data ? ignoredFilters(filters, query.data.applies) : [];
  return (
    <>
      <ChartCard
        title="Soil distribution"
        description="Soil records are not geotagged, so they are shown under the farm's marker, coloured by the most common recorded soil type. Pick a soil type in the legend to filter."
        ignored={ignored}
      >
        <CardState query={query} minHeight={520}>
          {(d) => (
            <MapPanel
              data={d}
              height={560}
              selectedSoil={filters.soilType}
              onSelectSoil={(soilType) => setFilters({ soilType })}
            />
          )}
        </CardState>
      </ChartCard>

      <ChartCard title="Records on the map" description="Soil type, pH, moisture, texture and recommended crops for each record." ignored={ignored}>
        <CardState query={query} isEmpty={(d) => d.records.length === 0} emptyHint="No soil records match these filters.">
          {(d) => (
            <DataTable<SoilMapRecord>
              caption="Soil records on the map"
              rows={d.records}
              rowKey={(r) => r.id}
              searchable
              searchLabel="Search records"
              columns={[
                {
                  key: "soil_type",
                  header: "Soil type",
                  render: (r) => (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ background: SOIL_COLORS[r.soil_key] ?? SOIL_COLORS.not_recorded }} aria-hidden="true" />
                      {r.soil_type}
                    </span>
                  ),
                },
                { key: "ph", header: "pH", align: "right", render: (r) => (r.ph != null ? r.ph.toFixed(1) : "Not recorded") },
                { key: "moisture", header: "Moisture" },
                { key: "texture", header: "Texture" },
                { key: "recommended", header: "Recommended crops", value: (r) => r.recommended.join(", "), render: (r) => r.recommended.join(", ") || "None" },
                { key: "farmer", header: "Farmer" },
                { key: "updated", header: "Last updated" },
              ]}
            />
          )}
        </CardState>
      </ChartCard>
    </>
  );
}

export default function SoilMapPage() {
  return (
    <Suspense>
      <AnalyticsPage title="Soil Map" description="Where Layuan's soil records sit, coloured by soil type.">
        {(filters, setFilters) => <SoilMapView filters={filters} setFilters={setFilters} />}
      </AnalyticsPage>
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";

import { useFiltered } from "@/components/analytics/analytics-dashboard";
import { AnalyticsPage } from "@/components/analytics/analytics-page";
import { CardState, ChartCard } from "@/components/analytics/cards";
import { DataTable } from "@/components/analytics/data-table";
import { SOIL_COLORS } from "@/components/analytics/map-panel";
import { ignoredFilters } from "@/lib/analytics/use-analytics-filters";
import { fetchSoilRecords, type AnalyticsFilters, type SoilRecordRows } from "@/lib/api/analytics-api";

type Row = SoilRecordRows["rows"][number];

function SoilRecordsTable({ filters }: { filters: AnalyticsFilters }) {
  const query = useFiltered(fetchSoilRecords, filters);
  return (
    <ChartCard
      title="Soil records"
      description={query.data ? `${query.data.count} record${query.data.count === 1 ? "" : "s"} submitted by approved farmers. Read-only.` : "Submitted by approved farmers. Read-only."}
      ignored={query.data ? ignoredFilters(filters, query.data.applies) : []}
    >
      <CardState query={query} isEmpty={(d) => d.rows.length === 0} emptyHint="No soil records match these filters.">
        {(d) => (
          <DataTable<Row>
            caption="Soil records"
            rows={d.rows}
            rowKey={(r) => r.id}
            searchable
            searchLabel="Search soil records"
            pageSize={20}
            columns={[
              { key: "farmer", header: "Farmer" },
              { key: "location", header: "Location" },
              {
                key: "soil_type",
                header: "Soil type",
                render: (r) => (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: SOIL_COLORS[r.soil_type.toLowerCase().replace(" ", "_")] ?? SOIL_COLORS.not_recorded }}
                      aria-hidden="true"
                    />
                    {r.soil_type}
                  </span>
                ),
              },
              { key: "ph", header: "pH", align: "right", render: (r) => (r.ph != null ? r.ph.toFixed(1) : "Not recorded") },
              { key: "moisture", header: "Moisture", align: "right" },
              { key: "date", header: "Date" },
            ]}
          />
        )}
      </CardState>
    </ChartCard>
  );
}

export default function SoilRecordsPage() {
  return (
    <Suspense>
      <AnalyticsPage
        title="Soil Records"
        description="Every soil record farmers have submitted, as a read-only table."
      >
        {(filters) => <SoilRecordsTable filters={filters} />}
      </AnalyticsPage>
    </Suspense>
  );
}

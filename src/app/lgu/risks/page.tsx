"use client";

import { Radar } from "lucide-react";

import { LguError, LguLoading } from "@/components/lgu/lgu-states";
import { AssessmentRow } from "@/components/risk/assessment-row";
import { RiskCountsRow } from "@/components/risk/risk-counts";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { fetchLguRiskOverview } from "@/lib/api/risk-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";

export default function LguRiskOverviewPage() {
  const { data, loading, error, refetch } = useAuthedQuery(fetchLguRiskOverview);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Risk Overview"
        description="AI risk readings across all tracked plants, read live from the database."
      />

      {loading ? (
        <LguLoading label="Loading risk readings…" />
      ) : error ? (
        <LguError message={error} onRetry={refetch} />
      ) : !data ? (
        <EmptyState
          icon={Radar}
          title="No risk data available"
          description="The database did not return risk figures for this farm."
        />
      ) : (
        <>
          <RiskCountsRow counts={data.counts} />
          {data.cases.length === 0 ? (
            <EmptyState
              icon={Radar}
              title="No assessments recorded yet"
              description="Risk readings appear here once approved Farmers submit weekly assessments for their plants."
            />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-muted-foreground text-sm">
                Latest reading for {data.cases.length}{" "}
                {data.cases.length === 1 ? "assessed plant" : "assessed plants"}
                {data.counts.unassessed > 0 &&
                  ` · ${data.counts.unassessed} plant${data.counts.unassessed === 1 ? "" : "s"} not yet assessed`}
              </p>
              {data.cases.map((assessment) => (
                <AssessmentRow key={assessment.id} assessment={assessment} showFarmer />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

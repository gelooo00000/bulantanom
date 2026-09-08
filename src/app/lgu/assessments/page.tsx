"use client";

import { ClipboardList } from "lucide-react";

import { LguError, LguLoading } from "@/components/lgu/lgu-states";
import { AssessmentRow } from "@/components/risk/assessment-row";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { fetchLguAssessmentHistory } from "@/lib/api/risk-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";

export default function LguAssessmentHistoryPage() {
  const { data, loading, error, refetch } = useAuthedQuery(fetchLguAssessmentHistory);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Assessment History"
        description="All weekly assessments submitted across every approved Farmer's plants."
      />

      {loading ? (
        <LguLoading label="Loading assessment records…" />
      ) : error ? (
        <LguError message={error} onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assessments recorded yet"
          description="Assessments appear here once Farmers start submitting their weekly plant reports."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            {data.length} {data.length === 1 ? "assessment" : "assessments"}
          </p>
          {data.map((assessment) => (
            <AssessmentRow key={assessment.id} assessment={assessment} showFarmer />
          ))}
        </div>
      )}
    </div>
  );
}

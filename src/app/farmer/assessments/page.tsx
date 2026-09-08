"use client";

import Link from "next/link";
import { ArrowRight, ClipboardList, LoaderCircle, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { AssessmentRow } from "@/components/risk/assessment-row";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { fetchFarmerRiskHistory } from "@/lib/api/risk-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { cn } from "@/lib/utils";

export default function AssessmentHistoryPage() {
  const { data, loading, error, refetch } = useAuthedQuery(fetchFarmerRiskHistory);
  const [riskFilter, setRiskFilter] = useState<"ALL" | "HIGH" | "MEDIUM" | "LOW">("ALL");

  // History only grows, so without this the readings worth revisiting sink
  // below weeks of routine low-risk entries.
  const shown = (data ?? []).filter(
    (a) => riskFilter === "ALL" || a.risk?.risk_level === riskFilter,
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Assessment History"
        description="All weekly assessments you have submitted, newest first."
      />

      {loading ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3">
          <LoaderCircle className="text-primary size-6 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading your assessments…</p>
        </div>
      ) : error ? (
        <div className="border-risk-high/30 bg-risk-high/5 flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center">
          <TriangleAlert className="text-risk-high size-5" />
          <p className="text-sm font-medium">Unable to connect to BulanTanom.</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button onClick={refetch}>Try again</Button>
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assessments submitted yet"
          description="Submit a weekly assessment for one of your plants to start building a history."
          action={
            <Button nativeButton={false} render={<Link href="/farmer/plants" />}>
              Go to My Plants
              <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">
              {shown.length === data.length
                ? `${data.length} ${data.length === 1 ? "assessment" : "assessments"}`
                : `${shown.length} of ${data.length} assessments`}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRiskFilter(value)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                    riskFilter === value
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {value === "ALL" ? "All" : `${value.charAt(0)}${value.slice(1).toLowerCase()} risk`}
                </button>
              ))}
            </div>
          </div>

          {shown.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No assessments at this risk level"
              description="Try a different filter to see your other readings."
            />
          ) : (
            shown.map((assessment) => (
              <AssessmentRow
                key={assessment.id}
                assessment={assessment}
                href={`/farmer/assessments/${assessment.id}`}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

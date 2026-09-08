"use client";

import { ShieldCheck } from "lucide-react";

import { HighRiskCaseCard } from "@/components/lgu/high-risk-case-card";
import { LguError, LguLoading } from "@/components/lgu/lgu-states";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { fetchLguHighRisk } from "@/lib/api/risk-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";

export default function LguHighRiskPage() {
  const { data, loading, error, refetch } = useAuthedQuery(fetchLguHighRisk);
  const highCount = data?.filter((a) => a.risk?.risk_level === "HIGH").length ?? 0;
  const mediumCount = data?.filter((a) => a.risk?.risk_level === "MEDIUM").length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="High-Risk Cases"
        description="Plants whose latest AI reading is medium or high risk, highest first."
      />

      {loading ? (
        <LguLoading label="Loading high-risk cases…" />
      ) : error ? (
        <LguError message={error} onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No medium or high-risk plants"
          description="Every plant with a recent assessment is currently reading low risk. Cases appear here as soon as one is flagged."
        />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">
            {data.length} {data.length === 1 ? "case" : "cases"} needing attention
            {highCount > 0 && <> · {highCount} high</>}
            {mediumCount > 0 && <> · {mediumCount} medium</>}
          </p>
          {data.map((assessment) => (
            <HighRiskCaseCard key={assessment.id} assessment={assessment} />
          ))}
        </div>
      )}
    </div>
  );
}

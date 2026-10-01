"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft, User } from "lucide-react";

import { LguError, LguLoading } from "@/components/lgu/lgu-states";
import { RiskResultCard } from "@/components/risk/risk-result-card";
import { fetchLguAssessment } from "@/lib/api/risk-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";

export default function LguAssessmentDetailPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = use(params);
  const {
    data: assessment,
    loading,
    error,
    refetch,
  } = useAuthedQuery((token) => fetchLguAssessment(token, assessmentId), [assessmentId]);

  const back = (
    <Link
      href="/lgu/assessments"
      className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm"
    >
      <ArrowLeft className="size-3.5" />
      Back to Assessment History
    </Link>
  );

  if (loading) {
    return <LguLoading label="Loading assessment…" />;
  }

  if (error || !assessment) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        {back}
        <LguError message={error ?? "This assessment could not be found."} onRetry={refetch} />
      </div>
    );
  }

  const farmer = assessment.farmer;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      {back}

      {farmer && (
        <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <User className="size-3.5 shrink-0" />
          Submitted by
          <span className="text-foreground font-medium">{farmer.full_name || farmer.email}</span>
        </p>
      )}

      {/* Officers read the result; re-running the analysis is the Farmer's. */}
      <RiskResultCard assessment={assessment} readOnly />
    </div>
  );
}

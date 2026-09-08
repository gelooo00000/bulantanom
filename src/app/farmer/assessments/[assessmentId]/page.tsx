"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft, LoaderCircle, TriangleAlert } from "lucide-react";

import { RiskInfoNote, RiskResultCard } from "@/components/risk/risk-result-card";
import { Button } from "@/components/ui/button";
import { fetchAssessment } from "@/lib/api/risk-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";

export default function AssessmentDetailPage({
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
  } = useAuthedQuery((token) => fetchAssessment(token, assessmentId), [assessmentId]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <LoaderCircle className="text-primary size-6 animate-spin" />
        <p className="text-muted-foreground text-sm">Loading assessment…</p>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="border-risk-high/30 bg-risk-high/5 flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center">
        <TriangleAlert className="text-risk-high size-5" />
        <p className="text-sm font-medium">Unable to load this assessment.</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          {error ?? "This assessment could not be found in your records."}
        </p>
        <div className="flex gap-2">
          <Button onClick={refetch}>Try again</Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/farmer/assessments" />}
          >
            Back to history
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Link
        href="/farmer/assessments"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-3.5" />
        Back to Assessment History
      </Link>

      <RiskResultCard assessment={assessment} />
      <RiskInfoNote />

      <Button
        variant="outline"
        className="self-start"
        nativeButton={false}
        render={<Link href={`/farmer/plants/${assessment.plant_id}`} />}
      >
        View {assessment.plant_display_name}
      </Button>
    </div>
  );
}

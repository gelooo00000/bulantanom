"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, LoaderCircle, TriangleAlert } from "lucide-react";

import { AssessmentForm } from "@/components/farmer/assessment-form";
import { AssessmentLockCard } from "@/components/farmer/assessment-lock-card";
import { Button } from "@/components/ui/button";
import { fetchPlant } from "@/lib/api/plants-api";
import type { AssessmentEligibility } from "@/lib/api/risk-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";

export default function AssessmentPage({
  params,
}: {
  params: Promise<{ plantId: string }>;
}) {
  const { plantId } = use(params);
  const { data: plant, loading, error, refetch } = useAuthedQuery(
    (token) => fetchPlant(token, plantId),
    [plantId],
  );
  // Set if the server rejects a submission because the week is already used —
  // it wins over whatever the page loaded with.
  const [lockedBySubmit, setLockedBySubmit] = useState<AssessmentEligibility | null>(
    null,
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <LoaderCircle className="text-primary size-6 animate-spin" />
        <p className="text-muted-foreground text-sm">Loading plant…</p>
      </div>
    );
  }

  if (error || !plant) {
    return (
      <div className="border-risk-high/30 bg-risk-high/5 flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center">
        <TriangleAlert className="text-risk-high size-5" />
        <p className="text-sm font-medium">Unable to load this plant.</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          {error ?? "This plant could not be found in your records."}
        </p>
        <div className="flex gap-2">
          <Button onClick={refetch}>Try again</Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/farmer/plants" />}>
            Back to My Plants
          </Button>
        </div>
      </div>
    );
  }

  const plantLabel = plant.display_name;
  // The backend is the only authority on eligibility — this is its answer,
  // never a date comparison done in the browser.
  const eligibility = lockedBySubmit ?? plant.assessment_eligibility;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <Link
          href={`/farmer/plants/${plant.id}`}
          className="text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-3.5" />
          Back to {plantLabel}
        </Link>
        <h1 className="text-2xl font-medium tracking-tight">Weekly Assessment</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {eligibility.can_assess
            ? `Answer a few questions about ${plantLabel} to get an AI risk reading.`
            : `${plantLabel} has already been assessed this week.`}
        </p>
      </div>

      {eligibility.can_assess ? (
        <AssessmentForm
          plantId={plant.id}
          plantLabel={plantLabel}
          cropName={plant.crop.name}
          onLocked={setLockedBySubmit}
        />
      ) : (
        <AssessmentLockCard
          eligibility={eligibility}
          plantLabel={plantLabel}
          plantId={plant.id}
        />
      )}
    </div>
  );
}

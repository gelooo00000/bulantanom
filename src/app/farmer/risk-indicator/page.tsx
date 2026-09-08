"use client";

import Link from "next/link";
import { ArrowRight, LoaderCircle, Sprout, TriangleAlert } from "lucide-react";

import { AssessmentRow } from "@/components/risk/assessment-row";
import { RiskCountsRow } from "@/components/risk/risk-counts";
import { RiskInfoNote } from "@/components/risk/risk-result-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchFarmerRisk } from "@/lib/api/risk-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";

export default function RiskIndicatorPage() {
  const { data, loading, error, refetch } = useAuthedQuery(fetchFarmerRisk);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Plant Risk Indicator"
        description="AI risk readings across all your plants at Layuan Farm."
      />

      {loading ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3">
          <LoaderCircle className="text-primary size-6 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading your risk readings…</p>
        </div>
      ) : error ? (
        <div className="border-risk-high/30 bg-risk-high/5 flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center">
          <TriangleAlert className="text-risk-high size-5" />
          <p className="text-sm font-medium">Unable to connect to BulanTanom.</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button onClick={refetch}>Try again</Button>
        </div>
      ) : !data || data.plants.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title="No plants yet"
          description="Add a plant, then submit a weekly assessment to get an AI risk reading for it."
          action={
            <Button nativeButton={false} render={<Link href="/farmer/plants/new" />}>
              Add a plant
              <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
            </Button>
          }
        />
      ) : (
        <>
          <RiskCountsRow counts={data.counts} />

          <div className="flex flex-col gap-3">
            {data.plants.map(({ plant, latest_assessment }) =>
              latest_assessment ? (
                <AssessmentRow
                  key={plant.id}
                  assessment={latest_assessment}
                  href={`/farmer/assessments/${latest_assessment.id}`}
                />
              ) : (
                <Card key={plant.id} className="gap-2 py-4">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 px-5">
                    <div>
                      <p className="text-sm font-medium">
                        {plant.crop.emoji} {plant.display_name}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        No assessment submitted yet — day {plant.age_days}.
                      </p>
                    </div>
                    {plant.assessment_eligibility.can_assess ? (
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href={`/farmer/plants/${plant.id}/assessment`} />}
                      >
                        Assess now
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        Next assessment in{" "}
                        {plant.assessment_eligibility.days_remaining} days
                      </span>
                    )}
                  </CardContent>
                </Card>
              ),
            )}
          </div>

          <RiskInfoNote />
        </>
      )}
    </div>
  );
}

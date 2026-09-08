"use client";

import Link from "next/link";
import { use } from "react";
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  Clock,
  LoaderCircle,
  Sprout,
  TriangleAlert,
} from "lucide-react";

import { AssessmentRow } from "@/components/risk/assessment-row";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDisplayDate } from "@/components/ui/date-picker";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { fetchPlant, type BackendPlant } from "@/lib/api/plants-api";
import { fetchPlantAssessments } from "@/lib/api/risk-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";

export default function PlantDetailPage({
  params,
}: {
  params: Promise<{ plantId: string }>;
}) {
  const { plantId } = use(params);
  const { data: plant, loading, error, refetch } = useAuthedQuery(
    (token) => fetchPlant(token, plantId),
    [plantId],
  );
  const { data: assessments, loading: assessmentsLoading } = useAuthedQuery(
    (token) => fetchPlantAssessments(token, plantId),
    [plantId],
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
    // A plant belonging to another Farmer 404s server-side, so this is also
    // the "not yours / not found" state.
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${plant.crop.emoji} ${plant.display_name}`}
        description={`${plant.crop.name} · Layuan Farm`}
        action={<AssessmentCta plant={plant} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <PlantStat icon={CalendarDays} label="Planting date" value={formatDisplayDate(plant.planting_date)} />
        <PlantStat icon={Clock} label="Current age" value={`${plant.age_days} days`} />
        <PlantStat icon={Sprout} label="Status" value={plant.status_label} />
        <PlantStat
          icon={CalendarDays}
          label="Harvest from"
          value={formatDisplayDate(plant.expected_harvest_start)}
        />
        <PlantStat
          icon={CalendarDays}
          label="Harvest until"
          value={formatDisplayDate(plant.expected_harvest_end)}
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTab value="overview">Overview</TabsTab>
          <TabsTab value="assessments">Assessments</TabsTab>
        </TabsList>

        <TabsPanel value="overview">
          <Card className="gap-3 py-5">
            <CardContent className="px-5">
              <h2 className="text-sm font-medium">About {plant.crop.name}</h2>
              <p className="text-muted-foreground mt-1.5 text-sm">{plant.crop.description}</p>
              <p className="text-muted-foreground mt-3 text-sm">
                Typical growing period {plant.crop.growing_duration_days} days, with a
                harvest window of about {plant.crop.harvest_window_days} days. Actual
                timing varies with variety, weather, soil and plant health.
              </p>
            </CardContent>
          </Card>
        </TabsPanel>

        <TabsPanel value="assessments">
          {assessmentsLoading ? (
            <div className="flex min-h-[20vh] items-center justify-center">
              <LoaderCircle className="text-primary size-5 animate-spin" />
            </div>
          ) : !assessments || assessments.length === 0 ? (
            <EmptyState
              icon={Sprout}
              title="No assessment yet"
              description="Start this plant's first weekly assessment to get an AI risk reading."
              action={
                <Button
                  nativeButton={false}
                  render={<Link href={`/farmer/plants/${plant.id}/assessment`} />}
                >
                  Start Weekly Assessment
                  <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              {assessments.map((assessment) => (
                <AssessmentRow
                  key={assessment.id}
                  assessment={assessment}
                  href={`/farmer/assessments/${assessment.id}`}
                />
              ))}
            </div>
          )}
        </TabsPanel>
      </Tabs>
    </div>
  );
}

/**
 * Start / locked state for the weekly assessment. The disabled state and its
 * countdown both come from the server's `assessment_eligibility`, so the
 * button reflects what the API will actually accept.
 */
function AssessmentCta({ plant }: { plant: BackendPlant }) {
  const { can_assess, days_remaining } = plant.assessment_eligibility;

  if (can_assess) {
    return (
      <Button
        nativeButton={false}
        render={<Link href={`/farmer/plants/${plant.id}/assessment`} />}
      >
        Start Weekly Assessment
        <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button disabled>
        <CalendarCheck className="size-4" />
        Assessment Completed
      </Button>
      <span className="text-muted-foreground text-xs">
        Next assessment in {days_remaining} {days_remaining === 1 ? "day" : "days"}
      </span>
    </div>
  );
}

function PlantStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <Card className="gap-1.5 py-3.5">
      <CardContent className="flex flex-col gap-1 px-3.5">
        <span className="text-muted-foreground flex items-center gap-1 text-[11px] tracking-wide uppercase">
          <Icon className="size-3" />
          {label}
        </span>
        <span className="text-sm font-medium">{value}</span>
      </CardContent>
    </Card>
  );
}

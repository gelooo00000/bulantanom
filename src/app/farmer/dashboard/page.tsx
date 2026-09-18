"use client";

import Link from "next/link";
import { ArrowRight, LoaderCircle, Sprout, TriangleAlert } from "lucide-react";

import { AssessmentTrendChart } from "@/components/farmer/assessment-trend-chart";
import { EnvironmentPanel } from "@/components/farmer/environment-panel";
import { FarmAlerts } from "@/components/farmer/farm-alerts";
import { HarvestSchedule } from "@/components/farmer/harvest-schedule";
import { RiskCountsRow } from "@/components/risk/risk-counts";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { fetchFarmerDashboard } from "@/lib/api/dashboard-api";
import { fetchFarmerRisk } from "@/lib/api/risk-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { useAuth } from "@/lib/auth/auth-context";

/**
 * The Farmer dashboard: an overview, not a second copy of the navigation.
 *
 * It answers three questions and stops — what is happening on my farm, what
 * needs my attention, and what trends should I know about. The plant list,
 * the assessment history, the soil recommendation and the harvest tracker
 * each have their own page, so none of them is duplicated here; the
 * sections that used to mirror them were removed rather than restyled.
 *
 * The risk breakdown is the existing `RiskCountsRow`, the same component the
 * Risk Indicators page uses. It is reused, not reimplemented, so there is
 * one definition of what a Low/Medium/High reading looks like.
 *
 * Everything on this page is read from MySQL by `/api/farmer/dashboard/`.
 * Nothing on it is AI-generated.
 */
export default function FarmerDashboardPage() {
  const { currentUser } = useAuth();
  const {
    data: dashboard,
    loading,
    error,
    refetch,
  } = useAuthedQuery(fetchFarmerDashboard);
  // The risk counts come from the endpoint that already feeds the Risk
  // Indicators page, so both screens can never disagree.
  const { data: risk } = useAuthedQuery(fetchFarmerRisk);

  const firstName = currentUser?.firstName ?? "Farmer";

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <LoaderCircle className="text-primary size-6 animate-spin" />
        <p className="text-muted-foreground text-sm">Loading your farm data…</p>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="border-risk-high/30 bg-risk-high/5 flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center">
        <TriangleAlert className="text-risk-high size-5" />
        <p className="text-sm font-medium">Unable to connect to BulanTanom.</p>
        <p className="text-muted-foreground max-w-sm text-sm">{error}</p>
        <Button onClick={refetch}>Try again</Button>
      </div>
    );
  }

  const { overview, assessment_trend, environment, upcoming_harvests, alerts } =
    dashboard;
  // `overview` is no longer rendered; its plant count still decides whether
  // this is a working farm or a first-run empty state.
  const hasPlants = overview.plant_count > 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p
          className="text-xs font-medium tracking-[0.2em] uppercase"
          style={{ color: "var(--landing-accent)" }}
        >
          Layuan Farm · AI Farm Intelligence
        </p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight">
          Welcome, {firstName}.
        </h1>
      </div>

      {!hasPlants ? (
        <EmptyState
          icon={Sprout}
          title="You haven't added any plants yet"
          description="Add your first plant to start tracking its growth, risk, and harvest window."
          action={
            <Button nativeButton={false} render={<Link href="/farmer/plants/new" />}>
              Add Your First Plant
              <ArrowRight className="size-4 transition-transform duration-[250ms] group-hover/button:translate-x-1" />
            </Button>
          }
        />
      ) : (
        <>
          <FarmAlerts alerts={alerts} hasPlants={hasPlants} />

          {/* The existing Low / Medium / High breakdown, reused as-is. */}
          {risk && (
            <section aria-label="Crop risk" className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">Crop risk</h2>
                <Link
                  href="/farmer/risk-indicator"
                  className="flex items-center gap-1 text-sm"
                  style={{ color: "var(--landing-accent)" }}
                >
                  Details
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
              <RiskCountsRow counts={risk.counts} />
            </section>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            <AssessmentTrendChart trend={assessment_trend} />
            <HarvestSchedule harvests={upcoming_harvests} />
          </div>

          <EnvironmentPanel environment={environment} />
        </>
      )}
    </div>
  );
}

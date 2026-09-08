"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  FlaskConical,
  LoaderCircle,
  Radar,
  Sparkles,
  Sprout,
  TriangleAlert,
  Wheat,
} from "lucide-react";
import type { ElementType, ReactNode } from "react";

import { PlantCard } from "@/components/farmer/plant-card";
import { SoilSummaryCard } from "@/components/farmer/soil-summary-card";
import { AssessmentRow } from "@/components/risk/assessment-row";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDisplayDate } from "@/components/ui/date-picker";
import { fetchPlants } from "@/lib/api/plants-api";
import { fetchLatestSoilRecommendation } from "@/lib/api/soil-api";
import { fetchFarmerRisk, fetchFarmerRiskHistory } from "@/lib/api/risk-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { useAuth } from "@/lib/auth/auth-context";
import { SOIL_STRINGS as t } from "@/lib/soil-options";

function KpiCard({
  icon: Icon,
  value,
  label,
  supporting,
}: {
  icon: ElementType;
  value: ReactNode;
  label: string;
  supporting: string;
}) {
  return (
    <Card className="hover:border-primary/40 gap-3 py-4 transition-all hover:-translate-y-0.5">
      <CardContent className="px-4">
        <span
          className="flex size-8 items-center justify-center rounded-lg border"
          style={{ borderColor: "var(--landing-accent)", color: "var(--landing-accent)" }}
        >
          <Icon className="size-4" />
        </span>
        <p className="mt-3 text-2xl font-medium tabular-nums">{value}</p>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-muted-foreground/70 mt-0.5 truncate text-[11px]">{supporting}</p>
      </CardContent>
    </Card>
  );
}

/** The four section headings were identical markup repeated inline. */
function SectionHeader({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-medium">{title}</h2>
      {href && linkLabel && (
        <Link
          href={href}
          className="flex items-center gap-1 text-sm"
          style={{ color: "var(--landing-accent)" }}
        >
          {linkLabel}
          <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

const QUICK_ACTIONS: { icon: ElementType; label: string; href: string }[] = [
  { icon: Sprout, label: "Add Plant", href: "/farmer/plants/new" },
  { icon: ClipboardList, label: "New Assessment", href: "/farmer/plants" },
  { icon: FlaskConical, label: "Soil Recommendation", href: "/farmer/soil-recommendation" },
  { icon: Radar, label: "Risk Indicators", href: "/farmer/risk-indicator" },
  { icon: Wheat, label: "Harvest Tracking", href: "/farmer/harvest" },
];

export default function FarmerDashboardPage() {
  const { currentUser } = useAuth();
  const { data: plants, loading, error, refetch } = useAuthedQuery(fetchPlants);
  // Risk and history load alongside the plants; a failure in either leaves
  // its tile blank rather than showing a made-up number.
  const { data: risk } = useAuthedQuery(fetchFarmerRisk);
  // Latest saved soil assessment. A plain database read — never Gemini.
  const { data: soil } = useAuthedQuery((token) =>
    fetchLatestSoilRecommendation(token),
  );

  const { data: history } = useAuthedQuery(fetchFarmerRiskHistory);

  const firstName = currentUser?.firstName ?? "Farmer";

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <LoaderCircle className="text-primary size-6 animate-spin" />
        <p className="text-muted-foreground text-sm">Loading your farm data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-risk-high/30 bg-risk-high/5 flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center">
        <TriangleAlert className="text-risk-high size-5" />
        <p className="text-sm font-medium">Unable to connect to BulanTanom.</p>
        <p className="text-muted-foreground max-w-sm text-sm">{error}</p>
        <Button onClick={refetch}>Try again</Button>
      </div>
    );
  }

  const owned = plants ?? [];
  const hasPlants = owned.length > 0;

  // Soonest upcoming harvest across this Farmer's own plants.
  const nextHarvest = [...owned].sort((a, b) =>
    a.expected_harvest_start.localeCompare(b.expected_harvest_start),
  )[0];

  // Soonest weekly assessment still on the clock. Null means at least one
  // plant can be assessed right now. Every date here is the server's.
  const lockedDates = owned
    .map((p) => p.assessment_eligibility)
    .filter((e) => !e.can_assess && e.next_assessment_date)
    .map((e) => e.next_assessment_date as string)
    .sort();
  const anyAssessableNow = owned.some((p) => p.assessment_eligibility.can_assess);
  const nextAssessmentDate = anyAssessableNow ? null : (lockedDates[0] ?? null);

  const highRisk = risk?.counts.HIGH ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p
          className="text-xs font-medium tracking-[0.2em] uppercase"
          style={{ color: "var(--landing-accent)" }}
        >
          Layuan Farm · AI Farm Intelligence
        </p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight">Welcome, {firstName}.</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {hasPlants
            ? "Here's the latest intelligence about your crops at Layuan Farm."
            : "Your BulanTanom farm workspace is ready. Start by adding your first plant."}
        </p>
      </div>

      {/* The Farmer is the person who can actually act on a high reading, yet
          this only existed on the LGU dashboard. Rendered solely when the
          database reports a HIGH plant, so its absence still means something. */}
      {highRisk > 0 && (
        <Link
          href="/farmer/risk-indicator"
          role="alert"
          className="border-risk-high/40 bg-risk-high/10 hover:bg-risk-high/15 flex flex-col gap-3 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <TriangleAlert className="text-risk-high mt-0.5 size-5 shrink-0" />
            <div>
              <p className="text-risk-high text-sm font-medium">
                {highRisk} plant{highRisk === 1 ? "" : "s"} reading high risk
              </p>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {highRisk === 1 ? "This plant" : "These plants"} had a high-risk result on{" "}
                {highRisk === 1 ? "its" : "their"} most recent weekly assessment. Review
                the reasoning and recommended actions.
              </p>
            </div>
          </div>
          <span className="border-risk-high/40 text-risk-high inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border px-3 py-1.5 text-sm font-medium sm:self-auto">
            Review
            <ArrowRight className="size-3.5" />
          </span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={Sprout}
          value={owned.length}
          label="Active Plants"
          supporting="Plants currently monitored"
        />
        <KpiCard
          icon={Wheat}
          value={nextHarvest ? formatDisplayDate(nextHarvest.expected_harvest_start) : "—"}
          label="Next Harvest"
          supporting={nextHarvest ? nextHarvest.display_name : "No harvests scheduled"}
        />
        <KpiCard
          icon={ClipboardList}
          value={history ? history.length : "—"}
          label="Assessments"
          supporting={
            history
              ? nextAssessmentDate
                ? `Next assessment: ${formatDisplayDate(nextAssessmentDate)}`
                : "A plant is ready to assess now"
              : "Loading…"
          }
        />
        <KpiCard
          icon={Radar}
          value={risk ? risk.counts.HIGH + risk.counts.MEDIUM : "—"}
          label="Plants Needing Attention"
          supporting={
            risk
              ? `${risk.counts.LOW} low risk · ${risk.counts.unassessed} not yet assessed`
              : "Loading…"
          }
        />
      </div>

      {/* Moved above the detail sections: these are the things a Farmer opens
          the dashboard to do, and they used to sit below a static explainer. */}
      <div>
        <SectionHeader title="Quick Actions" />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {QUICK_ACTIONS.map(({ icon: Icon, label, href }) => (
            <Link
              key={label}
              href={href}
              className="border-border bg-card hover:border-primary/40 flex flex-col items-start gap-2 rounded-xl border p-4 transition-all hover:-translate-y-0.5"
            >
              <span
                className="flex size-8 items-center justify-center rounded-lg border"
                style={{ borderColor: "var(--landing-accent)", color: "var(--landing-accent)" }}
              >
                <Icon className="size-4" />
              </span>
              <span className="text-sm font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <SectionHeader
          title="My Plants"
          href={hasPlants ? "/farmer/plants" : undefined}
          linkLabel="View all"
        />
        <div className="mt-3">
          {hasPlants ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {owned.slice(0, 4).map((plant) => (
                <PlantCard key={plant.id} plant={plant} />
              ))}
            </div>
          ) : (
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
          )}
        </div>
      </div>

      <div>
        <SectionHeader
          title={t.soilIntelligence}
          href={soil ? "/farmer/soil-recommendation" : undefined}
          linkLabel={t.viewRecommendation}
        />
        <div className="mt-3">
          <SoilSummaryCard soil={soil ?? null} />
        </div>
      </div>

      <div>
        <SectionHeader
          title="Recent assessments"
          href={history && history.length > 0 ? "/farmer/assessments" : undefined}
          linkLabel="View all"
        />
        <div className="mt-3">
          {history && history.length > 0 ? (
            <div className="flex flex-col gap-3">
              {history.slice(0, 3).map((assessment) => (
                <AssessmentRow
                  key={assessment.id}
                  assessment={assessment}
                  href={`/farmer/assessments/${assessment.id}`}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="No assessments yet"
              description="Submit a weekly assessment for one of your plants and its AI risk reading will appear here."
            />
          )}
        </div>
      </div>

      {/* Was a full card with its own icon badge and heading, sitting between
          My Plants and Quick Actions - a static explainer repeating the
          eyebrow above it. Kept as a footnote, which is what it is. */}
      <p className="text-muted-foreground/70 flex items-start gap-1.5 border-t border-border pt-3 text-xs">
        <Sparkles className="mt-0.5 size-3 shrink-0" />
        BulanTanom generates crop guidance when you add a plant, and compares your weekly
        assessment against the crop&apos;s expected development to produce a risk reading.
      </p>
    </div>
  );
}

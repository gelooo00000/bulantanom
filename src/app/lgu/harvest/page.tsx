"use client";

import { CircleHelp, Leaf, OctagonAlert, TriangleAlert, Wheat, X } from "lucide-react";
import { useState } from "react";

import { HorizontalBars, type BarRow } from "@/components/lgu/dashboard-charts";
import { LguError, LguLoading } from "@/components/lgu/lgu-states";
import { DonutChart } from "@/components/lgu/risk-pie";
import { RiskBadge, type BadgeLevel } from "@/components/risk/risk-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDisplayDate } from "@/components/ui/date-picker";
import { fetchLguPlants, type LguPlant } from "@/lib/api/lgu-api";
import { useLguQuery } from "@/lib/api/use-authed-query";
import { cn } from "@/lib/utils";

/**
 * Matches APPROACHING_WINDOW_DAYS in
 * notifications/management/commands/notify_harvest_windows.py, so a plant
 * shown as approaching here is the same one the system notifies about.
 */
const APPROACHING_WINDOW_DAYS = 7;

function daysUntil(iso: string): number {
  const target = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

type Phase = "harvested" | "open" | "approaching" | "growing" | "passed";

function phaseOf(plant: LguPlant): Phase {
  if (plant.status === "HARVESTED" || plant.status === "ARCHIVED") return "harvested";
  const toStart = daysUntil(plant.expected_harvest_start);
  const toEnd = daysUntil(plant.expected_harvest_end);
  if (toEnd < 0) return "passed";
  if (toStart <= 0) return "open";
  if (toStart <= APPROACHING_WINDOW_DAYS) return "approaching";
  return "growing";
}

const PHASE_STYLE: Record<Phase, string> = {
  open: "bg-risk-low/15 text-risk-low border-risk-low/30",
  approaching: "bg-risk-medium/15 text-risk-medium border-risk-medium/30",
  growing: "border-border text-muted-foreground",
  passed: "bg-risk-high/15 text-risk-high border-risk-high/30",
  harvested: "border-border text-muted-foreground",
};

/** Progress-bar fill: the phase's status hue, neutral while simply growing. */
const PHASE_FILL: Record<Phase, string> = {
  open: "var(--risk-low)",
  approaching: "var(--risk-medium)",
  growing: "var(--muted-foreground)",
  passed: "var(--risk-high)",
  harvested: "var(--muted-foreground)",
};

function phaseLabel(plant: LguPlant, phase: Phase): string {
  const toStart = daysUntil(plant.expected_harvest_start);
  const toEnd = daysUntil(plant.expected_harvest_end);
  switch (phase) {
    case "harvested":
      return plant.status_label;
    case "open":
      return toEnd === 0 ? "Last day" : `Ready now · ${toEnd}d left`;
    case "approaching":
      return toStart === 1 ? "Starts tomorrow" : `Starts in ${toStart} days`;
    case "passed":
      return `Harvest ended ${Math.abs(toEnd)}d ago`;
    default:
      return `${toStart} days to go`;
  }
}

type RiskKey = "HIGH" | "MEDIUM" | "LOW" | "none";

/**
 * The plant's latest reading, bucketed as the LGU dashboard buckets it: a
 * "too early to tell" reading counts as no reading yet, so the two screens
 * always agree.
 */
function riskOf(plant: LguPlant): RiskKey {
  const level = plant.latest_risk?.risk_level;
  return level === "HIGH" || level === "MEDIUM" || level === "LOW" ? level : "none";
}

const RISKS: { key: RiskKey; label: string; color: string; icon: typeof Wheat }[] = [
  { key: "HIGH", label: "High risk", color: "var(--risk-high)", icon: OctagonAlert },
  { key: "MEDIUM", label: "Medium risk", color: "var(--risk-medium)", icon: TriangleAlert },
  { key: "LOW", label: "Low risk", color: "var(--risk-low)", icon: Leaf },
  { key: "none", label: "No reading yet", color: "var(--muted-foreground)", icon: CircleHelp },
];

/** Still in the ground and being monitored: not harvested, not yet planted. */
function inField(plant: LguPlant): boolean {
  return phaseOf(plant) !== "harvested" && !plant.is_planned;
}

/** How far from planting to the start of harvest, 0–100. */
function progressToHarvest(plant: LguPlant): number {
  const span = daysUntil(plant.expected_harvest_start) - daysUntil(plant.planting_date);
  if (span <= 0) return 100;
  const done = -daysUntil(plant.planting_date);
  return Math.max(0, Math.min(100, Math.round((done / span) * 100)));
}

function PlantCard({ plant }: { plant: LguPlant }) {
  const phase = phaseOf(plant);
  const progress = progressToHarvest(plant);
  const level = plant.latest_risk?.risk_level;
  const checkDue = inField(plant) && plant.assessment_eligibility?.can_assess;

  return (
    <Card className="gap-2 py-4">
      <CardContent className="flex flex-col gap-3 px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">
              <span aria-hidden="true">{plant.crop.emoji}</span> {plant.display_name}
            </p>
            <p className="text-muted-foreground truncate text-sm">{plant.farmer.full_name}</p>
          </div>
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium",
              PHASE_STYLE[phase],
            )}
          >
            {phaseLabel(plant, phase)}
          </span>
        </div>

        {phase !== "harvested" && (
          <div className="flex flex-col gap-1.5">
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>Growth until harvest</span>
              <span className="tabular-nums">{progress}%</span>
            </div>
            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{ width: `${progress}%`, background: PHASE_FILL[phase] }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {level ? (
            <RiskBadge size="sm" level={level.toLowerCase() as BadgeLevel} />
          ) : (
            <span className="text-muted-foreground">No risk reading yet</span>
          )}
          {checkDue && (
            <span className="border-risk-medium/30 bg-risk-medium/10 text-risk-medium rounded-full border px-2 py-0.5 font-medium">
              Weekly check due
            </span>
          )}
          {plant.latest_risk && (
            <span className="text-muted-foreground">
              Last checked {formatDisplayDate(plant.latest_risk.assessment_date)}
            </span>
          )}
        </div>

        <div className="border-border grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground text-xs">Planted</p>
            <p className="text-sm">{formatDisplayDate(plant.planting_date)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Harvest starts</p>
            <p className="text-sm">{formatDisplayDate(plant.expected_harvest_start)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Harvest ends</p>
            <p className="text-sm">{formatDisplayDate(plant.expected_harvest_end)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Age</p>
            <p className="text-sm">{plant.age_days} days</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({ title, plants }: { title: string; plants: LguPlant[] }) {
  if (plants.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">
        {title} <span className="text-muted-foreground font-normal">({plants.length})</span>
      </h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {plants.map((plant) => (
          <PlantCard key={plant.id} plant={plant} />
        ))}
      </div>
    </section>
  );
}

export default function LguHarvestPage() {
  const { data, loading, error, refetch } = useLguQuery(fetchLguPlants);
  const [riskFilter, setRiskFilter] = useState<RiskKey | null>(null);

  const plants = data ?? [];
  const monitored = plants.filter(inField);
  const riskRows: BarRow[] = RISKS.map((risk) => ({
    key: risk.key,
    label: risk.label,
    value: monitored.filter((p) => riskOf(p) === risk.key).length,
    color: risk.color,
    icon: risk.icon,
  }));

  const pickRisk = (key: string) =>
    setRiskFilter((current) => (current === key ? null : (key as RiskKey)));

  const shown = riskFilter ? monitored.filter((p) => riskOf(p) === riskFilter) : plants;
  const shownIn = (phase: Phase) => shown.filter((p) => phaseOf(p) === phase);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Harvest & Monitoring"
        description="Expected harvest dates and the latest risk readings across all farmers at Layuan Farm, read live from the database."
      />

      {loading ? (
        <LguLoading label="Loading harvest dates…" />
      ) : error ? (
        <LguError message={error} onRetry={refetch} />
      ) : plants.length === 0 ? (
        <EmptyState
          icon={Wheat}
          title="No plants yet"
          description="Harvest dates appear here once approved Farmers start tracking their crops."
        />
      ) : (
        <>
          <Card className="gap-0 py-4">
            <CardContent className="px-4">
              <h2 className="text-sm font-medium">Monitoring</h2>
              <p className="text-muted-foreground mt-0.5 mb-4 text-xs">
                Latest AI risk reading for plants still in the field. Click a level to list
                only those plants.
              </p>
              {/* The donut shows the split at a glance; the rows beside it
                  name each level and its count, so colour is never the only cue. */}
              <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,180px)_minmax(0,28rem)]">
                <DonutChart
                  rows={riskRows}
                  unit="plant"
                  name="Plants in the field by latest risk"
                  onSelectKey={pickRisk}
                />
                <HorizontalBars
                  rows={riskRows}
                  unit="plant"
                  label="Plants in the field by latest risk"
                  selectedKey={riskFilter}
                  onSelect={pickRisk}
                />
              </div>
            </CardContent>
          </Card>

          {riskFilter && (
            <div
              role="status"
              className="border-border bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <span>
                Showing{" "}
                <span className="font-medium">
                  {RISKS.find((r) => r.key === riskFilter)?.label}
                </span>{" "}
                · {shown.length} plant{shown.length === 1 ? "" : "s"}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setRiskFilter(null)}>
                <X className="size-3.5" />
                Show all
              </Button>
            </div>
          )}

          <Section title="Ready to harvest" plants={shownIn("open")} />
          <Section
            title={`Harvest starts within ${APPROACHING_WINDOW_DAYS} days`}
            plants={shownIn("approaching")}
          />
          <Section title="Harvest time passed" plants={shownIn("passed")} />
          <Section title="Still growing" plants={shownIn("growing")} />
          <Section title="Harvested" plants={shownIn("harvested")} />
          {shown.length === 0 && (
            <p className="text-muted-foreground text-sm">No plants in this group.</p>
          )}

          <p className="text-muted-foreground text-xs">
            Harvest dates are calculated by BulanTanom from each crop&apos;s typical
            growing duration and the Farmer&apos;s planting date. They are estimates —
            real timing shifts with weather, soil and variety.
          </p>
        </>
      )}
    </div>
  );
}

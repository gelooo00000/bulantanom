"use client";

import Link from "next/link";
import {
  CalendarDays,
  Clock,
  LoaderCircle,
  Sprout,
  TriangleAlert,
  Wheat,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDisplayDate } from "@/components/ui/date-picker";
import { fetchPlants, type BackendPlant } from "@/lib/api/plants-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { cn } from "@/lib/utils";

/**
 * Matches APPROACHING_WINDOW_DAYS in
 * notifications/management/commands/notify_harvest_windows.py, so a plant
 * flagged "approaching" here is the same one the system emails about.
 */
const APPROACHING_WINDOW_DAYS = 7;

/** Whole days from today to an ISO date, negative once the date has passed. */
function daysUntil(iso: string): number {
  const target = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

type Phase = "harvested" | "open" | "approaching" | "growing" | "passed";

/**
 * Which stage a plant is at, derived only from its stored dates and status.
 * Nothing here is estimated beyond the harvest window Django already
 * calculated from the crop table.
 */
function phaseOf(plant: BackendPlant): Phase {
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

/** The single most useful sentence about this plant, right now. */
function phaseLabel(plant: BackendPlant, phase: Phase): string {
  const toStart = daysUntil(plant.expected_harvest_start);
  const toEnd = daysUntil(plant.expected_harvest_end);
  switch (phase) {
    case "harvested":
      return plant.status_label;
    case "open":
      return toEnd === 0
        ? "Last day of window"
        : `Ready now · ${toEnd} day${toEnd === 1 ? "" : "s"} left`;
    case "approaching":
      return toStart === 1 ? "Starts tomorrow" : `Starts in ${toStart} days`;
    case "passed":
      return `Window closed ${Math.abs(toEnd)} day${Math.abs(toEnd) === 1 ? "" : "s"} ago`;
    default:
      return `${toStart} days to go`;
  }
}

/** How far through the growing period this plant is, 0–100. */
function growthPercent(plant: BackendPlant): number {
  const total = plant.crop.growing_duration_days;
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((plant.age_days / total) * 100)));
}

function PlantHarvestCard({ plant }: { plant: BackendPlant }) {
  const phase = phaseOf(plant);
  const percent = growthPercent(plant);
  const windowDays = plant.crop.harvest_window_days;

  return (
    <Card className="gap-2 py-4">
      <CardContent className="flex flex-col gap-3 px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">
              <span aria-hidden="true">{plant.crop.emoji}</span> {plant.display_name}
            </p>
            <p className="text-muted-foreground text-sm">
              {plant.crop.name} · {plant.crop.category_label}
            </p>
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

        {/* Progress through the growing period, from the crop's own duration. */}
        {phase !== "harvested" && (
          <div className="flex flex-col gap-1.5">
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>
                Day {plant.age_days} of {plant.crop.growing_duration_days}
              </span>
              <span>{percent}%</span>
            </div>
            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  phase === "open" || phase === "passed"
                    ? "bg-risk-low"
                    : phase === "approaching"
                      ? "bg-risk-medium"
                      : "bg-primary",
                )}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        <div className="border-border grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground text-xs">Planted</p>
            <p className="text-sm">{formatDisplayDate(plant.planting_date)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Window opens</p>
            <p className="text-sm">
              {formatDisplayDate(plant.expected_harvest_start)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Window closes</p>
            <p className="text-sm">{formatDisplayDate(plant.expected_harvest_end)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Window length</p>
            <p className="text-sm">
              {windowDays} day{windowDays === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <Link
          href={`/farmer/plants/${plant.id}`}
          className="text-sm"
          style={{ color: "var(--landing-accent)" }}
        >
          View plant →
        </Link>
      </CardContent>
    </Card>
  );
}

function Section({ title, plants }: { title: string; plants: BackendPlant[] }) {
  if (plants.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">
        {title}{" "}
        <span className="text-muted-foreground font-normal">({plants.length})</span>
      </h2>
      {plants.map((plant) => (
        <PlantHarvestCard key={plant.id} plant={plant} />
      ))}
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Wheat;
  value: string | number;
  label: string;
  tone?: string;
}) {
  return (
    <Card className="gap-2 py-4">
      <CardContent className="flex items-center justify-between gap-3 px-5">
        <div>
          <p className={cn("text-2xl font-medium tabular-nums", tone)}>{value}</p>
          <p className="text-muted-foreground text-xs">{label}</p>
        </div>
        <Icon className="text-muted-foreground size-4 shrink-0" />
      </CardContent>
    </Card>
  );
}

export default function HarvestPage() {
  const { data: plants, loading, error, refetch } = useAuthedQuery(fetchPlants);

  const sorted = [...(plants ?? [])].sort((a, b) =>
    a.expected_harvest_start.localeCompare(b.expected_harvest_start),
  );

  const byPhase = (phase: Phase) => sorted.filter((p) => phaseOf(p) === phase);
  const open = byPhase("open");
  const approaching = byPhase("approaching");
  const growing = byPhase("growing");
  const passed = byPhase("passed");
  const harvested = byPhase("harvested");

  // Soonest window that has not already opened or closed.
  const next = approaching[0] ?? growing[0];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Harvest"
        description="Expected harvest windows for your plants at Layuan Farm."
      />

      {loading ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3">
          <LoaderCircle className="text-primary size-6 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading harvest windows…</p>
        </div>
      ) : error ? (
        <div className="border-risk-high/30 bg-risk-high/5 flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center">
          <TriangleAlert className="text-risk-high size-5" />
          <p className="text-sm font-medium">Unable to connect to BulanTanom.</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button onClick={refetch}>Try again</Button>
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Wheat}
          title="No plants yet"
          description="Add a plant to see its expected harvest window."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              icon={Wheat}
              value={open.length}
              label="Ready to harvest"
              tone={open.length > 0 ? "text-risk-low" : undefined}
            />
            <Stat
              icon={Clock}
              value={approaching.length}
              label={`Within ${APPROACHING_WINDOW_DAYS} days`}
              tone={approaching.length > 0 ? "text-risk-medium" : undefined}
            />
            <Stat icon={Sprout} value={growing.length} label="Still growing" />
            <Stat
              icon={CalendarDays}
              value={
                next ? formatDisplayDate(next.expected_harvest_start) : "—"
              }
              label={next ? `Next: ${next.crop.name}` : "No upcoming window"}
            />
          </div>

          <Section title="Ready to harvest" plants={open} />
          <Section title={`Approaching (${APPROACHING_WINDOW_DAYS} days)`} plants={approaching} />
          <Section title="Still growing" plants={growing} />
          <Section title="Window passed" plants={passed} />
          <Section title="Harvested" plants={harvested} />

          <p className="text-muted-foreground text-xs">
            Windows are calculated by BulanTanom from each crop&apos;s typical growing
            duration and your planting date. They are estimates — real timing shifts
            with weather, soil and variety, so check the plant before harvesting.
          </p>
        </>
      )}
    </div>
  );
}

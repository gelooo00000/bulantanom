"use client";

import { CalendarDays, Clock, Sprout, Wheat } from "lucide-react";

import { LguError, LguLoading } from "@/components/lgu/lgu-states";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
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
      return `Closed ${Math.abs(toEnd)}d ago`;
    default:
      return `${toStart} days to go`;
  }
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

function Section({ title, plants }: { title: string; plants: LguPlant[] }) {
  if (plants.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">
        {title}{" "}
        <span className="text-muted-foreground font-normal">({plants.length})</span>
      </h2>
      {plants.map((plant) => {
        const phase = phaseOf(plant);
        return (
          <Card key={plant.id} className="gap-2 py-4">
            <CardContent className="flex flex-col gap-3 px-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    <span aria-hidden="true">{plant.crop.emoji}</span>{" "}
                    {plant.display_name}
                  </p>
                  <p className="text-muted-foreground truncate text-sm">
                    {plant.farmer.full_name}
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
                  <p className="text-sm">
                    {formatDisplayDate(plant.expected_harvest_end)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Age</p>
                  <p className="text-sm">{plant.age_days} days</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function LguHarvestPage() {
  const { data, loading, error, refetch } = useLguQuery(fetchLguPlants);

  const plants = data ?? [];
  const byPhase = (phase: Phase) => plants.filter((p) => phaseOf(p) === phase);
  const open = byPhase("open");
  const approaching = byPhase("approaching");
  const growing = byPhase("growing");
  const passed = byPhase("passed");
  const harvested = byPhase("harvested");
  const next = approaching[0] ?? growing[0];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Harvest & Monitoring"
        description="Expected harvest windows across all farmers at Layuan Farm, read live from the database."
      />

      {loading ? (
        <LguLoading label="Loading harvest windows…" />
      ) : error ? (
        <LguError message={error} onRetry={refetch} />
      ) : plants.length === 0 ? (
        <EmptyState
          icon={Wheat}
          title="No plants yet"
          description="Harvest windows appear here once approved Farmers start tracking their crops."
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
              value={next ? formatDisplayDate(next.expected_harvest_start) : "—"}
              label={next ? `Next: ${next.crop.name}` : "No upcoming window"}
            />
          </div>

          <Section title="Ready to harvest" plants={open} />
          <Section
            title={`Approaching (${APPROACHING_WINDOW_DAYS} days)`}
            plants={approaching}
          />
          <Section title="Still growing" plants={growing} />
          <Section title="Window passed" plants={passed} />
          <Section title="Harvested" plants={harvested} />

          <p className="text-muted-foreground text-xs">
            Windows are calculated by BulanTanom from each crop&apos;s typical growing
            duration and the Farmer&apos;s planting date. They are estimates — real
            timing shifts with weather, soil and variety.
          </p>
        </>
      )}
    </div>
  );
}

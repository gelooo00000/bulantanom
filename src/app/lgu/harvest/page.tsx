"use client";

import {
  AlarmClock,
  Archive,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Info,
  Leaf,
  Sprout,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState } from "react";

import { LguError, LguLoading } from "@/components/lgu/lgu-states";
import { RiskBadge, type BadgeLevel } from "@/components/risk/risk-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { formatDisplayDate } from "@/components/ui/date-picker";
import { fetchLguPlants, type LguPlant } from "@/lib/api/lgu-api";
import { useLguQuery } from "@/lib/api/use-authed-query";
import { CROP_OUTLINE, cropVar } from "@/lib/crop-colors";
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
  growing: "bg-muted border-border text-muted-foreground",
  passed: "bg-risk-high/15 text-risk-high border-risk-high/30",
  harvested: "bg-muted border-border text-muted-foreground",
};

/** Progress fill: the phase's status hue, the app's green while simply growing. */
const PHASE_FILL: Record<Phase, string> = {
  open: "var(--risk-low)",
  approaching: "var(--risk-medium)",
  growing: "var(--primary)",
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

/** How far from planting to the start of harvest, 0–100. */
function progressToHarvest(plant: LguPlant): number {
  const span = daysUntil(plant.expected_harvest_start) - daysUntil(plant.planting_date);
  if (span <= 0) return 100;
  const done = -daysUntil(plant.planting_date);
  return Math.max(0, Math.min(100, Math.round((done / span) * 100)));
}

const tint = (color: string, percent: number) => `color-mix(in oklab, ${color} ${percent}%, transparent)`;

/** Up to two initials for the farmer's avatar. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

/** How far a point `daysFromToday` away sits between planting and harvest's end, 0–100. */
function along(plant: LguPlant, daysFromToday: number): number {
  const planted = daysUntil(plant.planting_date);
  const total = daysUntil(plant.expected_harvest_end) - planted;
  if (total <= 0) return 100;
  return Math.max(0, Math.min(100, ((daysFromToday - planted) / total) * 100));
}

/**
 * The plant's season as one track: grown so far in the phase's colour, the
 * harvest period hatched in green, and a marker for today.
 */
function SeasonTrack({ plant, phase }: { plant: LguPlant; phase: Phase }) {
  const start = along(plant, daysUntil(plant.expected_harvest_start));
  const now = phase === "harvested" ? 100 : along(plant, 0);
  const fill = PHASE_FILL[phase];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative mx-1.5 h-6" aria-hidden="true">
        <div className="bg-muted absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full">
          <span
            className="absolute inset-y-0 right-0"
            style={{
              left: `${start}%`,
              backgroundImage: `repeating-linear-gradient(135deg, ${tint("var(--risk-low)", 32)} 0 5px, ${tint("var(--risk-low)", 14)} 5px 10px)`,
            }}
          />
          <span
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
            style={{ width: `${now}%`, backgroundImage: `linear-gradient(90deg, ${tint(fill, 45)}, ${fill})` }}
          />
        </div>
        <span
          className="bg-card absolute top-1/2 left-0 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          style={{ borderColor: fill }}
        />
        <span
          className="bg-card absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          style={{ left: `${start}%`, borderColor: "var(--risk-low)" }}
        />
        <span
          className="bg-card absolute top-1/2 left-full size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          style={{ borderColor: "var(--risk-low)" }}
        />
        {phase !== "harvested" && (
          <span
            className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{ left: `${now}%` }}
          >
            <span
              className="absolute size-5 rounded-full opacity-40 motion-safe:animate-ping"
              style={{ backgroundColor: fill }}
            />
            <span
              className="border-card relative size-4 rounded-full border-[3px] shadow"
              style={{ backgroundColor: fill }}
            />
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Planted</p>
          <p className="font-heading mt-0.5 text-[13px] font-medium">{formatDisplayDate(plant.planting_date)}</p>
        </div>
        <div className="text-center">
          <p className="text-muted-foreground">Harvest starts</p>
          <p className="font-heading mt-0.5 text-[13px] font-medium">
            {formatDisplayDate(plant.expected_harvest_start)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">Harvest ends</p>
          <p className="font-heading mt-0.5 text-[13px] font-medium">
            {formatDisplayDate(plant.expected_harvest_end)}
          </p>
        </div>
      </div>
    </div>
  );
}

function PlantCard({ plant }: { plant: LguPlant }) {
  const phase = phaseOf(plant);
  const progress = progressToHarvest(plant);
  const level = plant.latest_risk?.risk_level;
  const accent = PHASE_FILL[phase];

  return (
    // Outlined in the crop's colour when pointed at or tapped, as on the
    // farmer's cards.
    <Card
      tabIndex={0}
      className={cn(
        "relative isolate gap-0 overflow-hidden rounded-3xl py-0 transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5",
        CROP_OUTLINE,
      )}
      style={cropVar(plant.crop.name)}
    >
      {/* A wash in the crop's colour behind the header, the crop faded in the corner. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-28"
        style={{
          backgroundImage: "linear-gradient(160deg, color-mix(in oklab, var(--crop) 20%, transparent), transparent 85%)",
        }}
      />
      <span
        aria-hidden="true"
        className="absolute -top-3 -right-2 -z-10 text-8xl leading-none opacity-[0.12] select-none"
      >
        {plant.crop.emoji}
      </span>

      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-3.5">
          <span
            aria-hidden="true"
            className="bg-card flex size-14 shrink-0 items-center justify-center rounded-2xl border text-3xl"
            style={{ boxShadow: "0 10px 22px -14px var(--crop)" }}
          >
            {plant.crop.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading truncate text-lg leading-tight font-semibold">{plant.display_name}</p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="font-heading flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold"
                style={{ color: "var(--primary)", backgroundColor: tint("var(--primary)", 14) }}
              >
                {initials(plant.farmer.full_name)}
              </span>
              <span className="text-muted-foreground truncate text-sm">{plant.farmer.full_name}</span>
            </div>
          </div>
          <span
            className={cn(
              "font-heading shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold",
              PHASE_STYLE[phase],
            )}
          >
            {phaseLabel(plant, phase)}
          </span>
        </div>

        <SeasonTrack plant={plant} phase={phase} />

        <div className="border-border/70 flex flex-wrap items-center gap-2 border-t pt-3.5 text-xs">
          {level && <RiskBadge size="sm" level={level.toLowerCase() as BadgeLevel} />}
          {plant.latest_risk && (
            <span className="text-muted-foreground">
              Last checked {formatDisplayDate(plant.latest_risk.assessment_date)}
            </span>
          )}
          <span className="text-muted-foreground ml-auto inline-flex items-center gap-2">
            <span className="tabular-nums">{plant.age_days} days old</span>
            {phase !== "harvested" && (
              <span
                className="font-heading rounded-full px-2 py-0.5 font-semibold tabular-nums"
                style={{ color: accent, backgroundColor: tint(accent, 14) }}
              >
                {progress}% grown
              </span>
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/** Each stage's heading: an icon and a short hint. */
const SECTION_LOOK: Record<Phase, { icon: LucideIcon; hint: string }> = {
  open: { icon: Sprout, hint: "Ready for picking now" },
  approaching: { icon: CalendarClock, hint: "Get ready for harvest" },
  passed: { icon: AlarmClock, hint: "Check in with the farmer" },
  growing: { icon: Leaf, hint: "Still maturing in the field" },
  harvested: { icon: Wheat, hint: "Done for this season" },
};

/**
 * A stage's plants, `perPage` at a time. Pages sit side by side in one strip
 * that slides when the officer moves between them (or swipes, on a phone).
 */
function Section({
  title,
  phase,
  plants,
  perPage,
}: {
  title: string;
  phase: Phase;
  plants: LguPlant[];
  perPage: number;
}) {
  const [page, setPage] = useState(0);
  const touchX = useRef<number | null>(null);
  if (plants.length === 0) return null;
  const { icon: Icon, hint } = SECTION_LOOK[phase];
  const color = phase === "harvested" ? "var(--primary)" : PHASE_FILL[phase];
  const pages: LguPlant[][] = [];
  for (let i = 0; i < plants.length; i += perPage) pages.push(plants.slice(i, i + perPage));
  // The list can shrink under the current page after a refetch.
  const current = Math.min(page, pages.length - 1);
  const go = (to: number) => setPage(Math.max(0, Math.min(pages.length - 1, to)));
  const first = current * perPage + 1;
  const last = Math.min(plants.length, first + perPage - 1);

  return (
    <section className="flex flex-col gap-3.5" aria-label={title}>
      <div className="flex items-center gap-3">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-xl"
          style={{ color, backgroundColor: tint(color, 15) }}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        <span
          className="font-heading rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
          style={{ color, backgroundColor: tint(color, 14) }}
        >
          {plants.length}
        </span>
        <span className="text-muted-foreground hidden text-sm md:inline">· {hint}</span>
        <span
          className="h-px flex-1"
          style={{ backgroundImage: `linear-gradient(90deg, ${tint(color, 35)}, transparent)` }}
        />
      </div>
      {/* Room for the cards' hover lift and outline inside the clipped strip. */}
      <div
        className="-m-2 overflow-hidden p-2"
        onTouchStart={(e) => (touchX.current = e.touches[0]!.clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const moved = e.changedTouches[0]!.clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(moved) > 50) go(current + (moved < 0 ? 1 : -1));
        }}
      >
        <div
          className="flex items-start transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(calc(-${current * 100}% - ${current} * 1rem))`, gap: "1rem" }}
        >
          {pages.map((group, index) => (
            <div
              key={index}
              className={cn(
                "grid w-full shrink-0 gap-4 transition-opacity duration-500 lg:grid-cols-2",
                index === current ? "opacity-100" : "opacity-0",
              )}
              inert={index !== current}
              aria-hidden={index !== current}
            >
              {group.map((plant) => (
                <PlantCard key={plant.id} plant={plant} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {pages.length > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
            {first}–{last} of {plants.length}
          </p>
          <div className="flex items-center gap-1.5">
            {pages.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Page ${index + 1}`}
                aria-current={index === current ? "page" : undefined}
                onClick={() => go(index)}
                className="flex h-6 items-center"
              >
                <span
                  className={cn(
                    "block h-2 rounded-full transition-all duration-300",
                    index === current ? "w-6" : "bg-border hover:bg-muted-foreground/40 w-2",
                  )}
                  style={index === current ? { backgroundColor: color } : undefined}
                />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <PageButton label="Previous page" disabled={current === 0} onClick={() => go(current - 1)}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </PageButton>
            <PageButton
              label="Next page"
              disabled={current === pages.length - 1}
              onClick={() => go(current + 1)}
              color={color}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </PageButton>
          </div>
        </div>
      )}
    </section>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
  color,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="border-border bg-card hover:bg-muted flex size-9 items-center justify-center rounded-full border shadow-sm transition-all hover:-translate-y-px disabled:pointer-events-none disabled:opacity-40"
      style={color && !disabled ? { color, borderColor: tint(color, 40) } : undefined}
    >
      {children}
    </button>
  );
}

export default function LguHarvestPage() {
  const { data, loading, error, refetch } = useLguQuery(fetchLguPlants);
  // Lost plants have no harvest coming.
  const plants = (data ?? []).filter((p) => p.status !== "LOST");
  const shownIn = (phase: Phase) => plants.filter((p) => phaseOf(p) === phase);
  const [view, setView] = useState<"field" | "archive">("field");
  const archived = shownIn("harvested");
  const inFieldCount = plants.length - archived.length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Harvest & Monitoring"
        description="Expected harvest dates and the latest risk readings across all farmers at Layuan Farm, read live from the database."
      />

      {!loading && !error && plants.length > 0 && (
        <div className="bg-muted/60 inline-flex self-start rounded-2xl p-1" role="tablist" aria-label="Plants to show">
          {(
            [
              { value: "field", label: "In the field", count: inFieldCount, icon: Sprout },
              { value: "archive", label: "Archive", count: archived.length, icon: Archive },
            ] as const
          ).map((tab) => {
            const active = view === tab.value;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(tab.value)}
                className={cn(
                  "font-heading flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all",
                  active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <TabIcon className="size-4" aria-hidden="true" />
                {tab.label}
                <span
                  className="rounded-full px-1.5 py-px text-xs tabular-nums"
                  style={
                    active
                      ? { color: "var(--primary)", backgroundColor: tint("var(--primary)", 15) }
                      : { backgroundColor: "var(--border)" }
                  }
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

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
          {view === "field" ? (
            inFieldCount === 0 ? (
              <EmptyState
                icon={Sprout}
                title="Nothing in the field"
                description="Every plant has been harvested. Past harvests are in the Archive."
              />
            ) : (
              <div className="flex flex-col gap-8">
                <Section title="Ready to harvest" phase="open" plants={shownIn("open")} perPage={4} />
                <Section
                  title={`Harvest starts within ${APPROACHING_WINDOW_DAYS} days`}
                  phase="approaching"
                  plants={shownIn("approaching")}
                  perPage={4}
                />
                <Section title="Harvest time passed" phase="passed" plants={shownIn("passed")} perPage={4} />
                <Section title="Still growing" phase="growing" plants={shownIn("growing")} perPage={6} />
              </div>
            )
          ) : archived.length === 0 ? (
            <EmptyState
              icon={Archive}
              title="The archive is empty"
              description="Plants move here once their Farmer marks them harvested."
            />
          ) : (
            <Section title="Harvested" phase="harvested" plants={archived} perPage={6} />
          )}

          <p className="bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-2xl px-4 py-3 text-xs">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Harvest dates are calculated by BulanTanom from each crop&apos;s typical growing duration and the
              Farmer&apos;s planting date. They are estimates — real timing shifts with weather, soil and variety.
            </span>
          </p>
        </>
      )}
    </div>
  );
}

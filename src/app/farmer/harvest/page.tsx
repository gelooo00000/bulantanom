"use client";

import { LoaderCircle, TriangleAlert, Wheat } from "lucide-react";

import { HarvestCalendar } from "@/components/farmer/harvest-calendar";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDisplayDate } from "@/components/ui/date-picker";
import { fetchPlants, type BackendPlant } from "@/lib/api/plants-api";
import { useAuthedQuery } from "@/lib/api/use-authed-query";
import { CROP_OUTLINE, cropTint, cropVar } from "@/lib/crop-colors";
import { humanDuration } from "@/lib/duration";
import { useLanguage, type Translate } from "@/lib/i18n";
import { plantStatusLabel } from "@/lib/plant-summary";
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
function phaseLabel(plant: BackendPlant, phase: Phase, t: Translate): string {
  const toStart = daysUntil(plant.expected_harvest_start);
  const toEnd = daysUntil(plant.expected_harvest_end);
  switch (phase) {
    case "harvested":
      return plantStatusLabel(plant, t);
    case "open":
      return toEnd === 0
        ? t("phase.lastDay")
        : t("harvestCard.readyLeft", { time: humanDuration(toEnd, t) });
    case "approaching":
      return toStart === 1
        ? t("phase.startsTomorrow")
        : t("harvestCard.startsIn", { time: humanDuration(toStart, t) });
    case "passed":
      return t("harvestCard.closedAgo", { time: humanDuration(Math.abs(toEnd), t) });
    default:
      // A tree crop is years away; "1460 days to go" is not an answer.
      return t("harvestCard.toGo", { time: humanDuration(toStart, t) });
  }
}

/** Whole days from one ISO date to another. */
function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000,
  );
}

/**
 * Read from the plant's own saved dates, not `plant.crop`: a variety has its
 * own durations (Oyster Mushroom's harvest window is 21 days, the generic
 * Mushroom's shorter), and those are what Django used for the dates.
 */
function growingDays(plant: BackendPlant): number {
  return daysBetween(plant.planting_date, plant.expected_harvest_start);
}

function harvestWindowDays(plant: BackendPlant): number {
  return daysBetween(plant.expected_harvest_start, plant.expected_harvest_end);
}

/** How far through the growing period this plant is, 0–100. */
function growthPercent(plant: BackendPlant): number {
  const total = growingDays(plant);
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((plant.age_days / total) * 100)));
}

function PlantHarvestCard({ plant }: { plant: BackendPlant }) {
  const { t, dateLocale } = useLanguage();
  const date = (iso: string) => formatDisplayDate(iso, dateLocale);
  const phase = phaseOf(plant);
  const percent = growthPercent(plant);
  const windowDays = harvestWindowDays(plant);

  return (
    // Outlined in the crop's own colour on hover or tap, as on My Plants.
    <Card
      tabIndex={0}
      style={cropVar(plant.crop.name)}
      className={cn("h-full min-w-0 gap-2 py-4 transition-all", CROP_OUTLINE)}
    >
      <CardContent className="flex h-full flex-col gap-3 px-4 sm:px-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl text-2xl leading-none"
              style={{ backgroundColor: cropTint(plant.crop.name) }}
            >
              {plant.crop.emoji}
            </span>
            <div className="min-w-0">
              <p className="font-heading line-clamp-2 text-[17px] leading-snug break-words">
                {plant.display_name}
              </p>
              <p className="text-muted-foreground mt-0.5 truncate text-sm">
                {plant.crop.name} ·{" "}
                {plant.crop.category === "fruit"
                  ? t("category.fruit")
                  : plant.crop.category === "vegetable"
                    ? t("category.vegetable")
                    : plant.crop.category_label}
              </p>
            </div>
          </div>
          <span
            className={cn(
              // May wrap rather than push the card past a phone's edge.
              "font-heading max-w-[55%] rounded-2xl border px-2.5 py-0.5 text-center text-xs font-medium tracking-wide",
              PHASE_STYLE[phase],
            )}
          >
            {phaseLabel(plant, phase, t)}
          </span>
        </div>

        {/* Progress through the growing period, from the plant's own dates. */}
        {phase !== "harvested" && (
          <div className="flex flex-col gap-1.5">
            <div className="text-foreground/75 flex items-baseline justify-between text-[13px]">
              <span>
                {t("harvestCard.grown", {
                  done: humanDuration(plant.age_days, t),
                  total: humanDuration(growingDays(plant), t),
                })}
              </span>
              <span className="font-heading text-foreground text-sm tabular-nums">{percent}%</span>
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

        {/* Two by two: the cards sit side by side, so four across no longer
            fits. Pinned to the bottom so the dates line up across a row. */}
        <div className="border-border mt-auto grid grid-cols-2 gap-x-3 gap-y-2.5 border-t pt-3">
          <div>
            <p className="text-muted-foreground text-xs">{t("harvestCard.planted")}</p>
            <p className="font-heading text-[15px] font-medium">{date(plant.planting_date)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t("harvestCard.readyFrom")}</p>
            <p className="font-heading text-[15px] font-medium">{date(plant.expected_harvest_start)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t("harvestCard.readyUntil")}</p>
            <p className="font-heading text-[15px] font-medium">{date(plant.expected_harvest_end)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t("harvestCard.lasts")}</p>
            <p className="font-heading text-[15px] font-medium">{humanDuration(windowDays, t)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({ title, plants }: { title: string; plants: BackendPlant[] }) {
  if (plants.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg">
        {title}{" "}
        <span className="text-muted-foreground font-sans text-sm font-normal">({plants.length})</span>
      </h2>
      {/* Side by side from tablet width up; one per row on a phone, where
          half the screen is too narrow for four dates. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {plants.map((plant) => (
          <PlantHarvestCard key={plant.id} plant={plant} />
        ))}
      </div>
    </div>
  );
}

export default function HarvestPage() {
  const { data: plants, loading, error, refetch } = useAuthedQuery(fetchPlants);
  const { t } = useLanguage();

  const sorted = [...(plants ?? [])].sort((a, b) =>
    a.expected_harvest_start.localeCompare(b.expected_harvest_start),
  );

  const byPhase = (phase: Phase) => sorted.filter((p) => phaseOf(p) === phase);
  const open = byPhase("open");
  const approaching = byPhase("approaching");
  const growing = byPhase("growing");
  const passed = byPhase("passed");
  const harvested = byPhase("harvested");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("harvestPage.title")}
        description={t("harvestPage.description")}
      />

      {loading ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3">
          <LoaderCircle className="text-primary size-6 animate-spin" />
          <p className="text-muted-foreground text-sm">{t("harvestPage.loading")}</p>
        </div>
      ) : error ? (
        <div className="border-risk-high/30 bg-risk-high/5 flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center">
          <TriangleAlert className="text-risk-high size-5" />
          <p className="font-heading text-sm font-medium">{t("dash.cantConnect")}</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button onClick={refetch}>{t("common.tryAgain")}</Button>
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Wheat}
          title={t("riskPage.emptyTitle")}
          description={t("harvestPage.emptyText")}
        />
      ) : (
        <>
          <HarvestCalendar plants={sorted} />

          <Section title={t("harvestPage.ready")} plants={open} />
          <Section
            title={t("harvestPage.approaching", { n: APPROACHING_WINDOW_DAYS })}
            plants={approaching}
          />
          <Section title={t("harvestPage.growing")} plants={growing} />
          <Section title={t("harvestPage.passed")} plants={passed} />
          <Section title={t("harvestPage.harvested")} plants={harvested} />

          <p className="text-muted-foreground text-xs">
            {t("harvestPage.note")}
          </p>
        </>
      )}
    </div>
  );
}

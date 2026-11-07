"use client";

import { Popover } from "@base-ui/react/popover";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CircleCheck,
  Hourglass,
  Lightbulb,
  LoaderCircle,
  Sprout,
  TriangleAlert,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDisplayDate } from "@/components/ui/date-picker";
import type { BackendPlant } from "@/lib/api/plants-api";
import { CROP_OUTLINE, cropTint, cropVar } from "@/lib/crop-colors";
import { humanDuration } from "@/lib/duration";
import {
  daysUntil,
  growingDays,
  growthPercent,
  harvestWindowDays,
  phaseOf,
  timeline,
  type HarvestPhase,
} from "@/lib/harvest";
import { useLanguage, type MessageKey, type Translate } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const PHASE_STYLE: Record<
  HarvestPhase,
  { pill: string; text: string; bar: string; icon: LucideIcon }
> = {
  open: {
    pill: "bg-risk-low/15 text-risk-low border-risk-low/30",
    text: "text-risk-low",
    bar: "bg-risk-low",
    icon: CircleCheck,
  },
  approaching: {
    pill: "bg-risk-medium/15 text-risk-medium border-risk-medium/30",
    text: "text-risk-medium",
    bar: "bg-risk-medium",
    icon: CalendarClock,
  },
  growing: {
    pill: "border-border text-muted-foreground",
    text: "text-foreground",
    bar: "bg-primary",
    icon: Sprout,
  },
  passed: {
    pill: "bg-risk-high/15 text-risk-high border-risk-high/30",
    text: "text-risk-high",
    bar: "bg-risk-high",
    icon: TriangleAlert,
  },
  harvested: {
    pill: "border-border text-muted-foreground",
    text: "text-muted-foreground",
    bar: "bg-muted-foreground",
    icon: CircleCheck,
  },
};

/** The short status in the corner pill. */
function phaseLabel(plant: BackendPlant, phase: HarvestPhase, t: Translate): string {
  const toStart = daysUntil(plant.expected_harvest_start);
  const toEnd = daysUntil(plant.expected_harvest_end);
  switch (phase) {
    case "harvested":
      return t("harvestCard.headlineHarvested");
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

/** The one sentence a farmer should read first. */
function headline(plant: BackendPlant, phase: HarvestPhase, t: Translate, date: (iso: string) => string) {
  switch (phase) {
    case "open":
      return t("harvestCard.headlineOpen", { date: date(plant.expected_harvest_end) });
    case "passed":
      return t("harvestCard.headlinePassed", { date: date(plant.expected_harvest_end) });
    case "harvested":
      return plant.harvested_at
        ? t("harvestCard.harvestedOn", { date: date(plant.harvested_at.slice(0, 10)) })
        : t("harvestCard.headlineHarvested");
    default:
      return t("harvestCard.headlineSoon", { date: date(plant.expected_harvest_start) });
  }
}

/** Planting to the end of the harvest window, with today marked on it. */
function Timeline({ plant, phase }: { plant: BackendPlant; phase: HarvestPhase }) {
  const { t, dateLocale } = useLanguage();
  const date = (iso: string) => formatDisplayDate(iso, dateLocale);
  const { windowStart, windowWidth, todayAt } = timeline(plant);
  const style = PHASE_STYLE[phase];
  const fullyGrown = phase === "open" || phase === "passed";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-foreground/75 flex items-baseline justify-between gap-2 text-[13px]">
        <span>
          {fullyGrown
            ? t("harvestCard.fullyGrown")
            : t("harvestCard.grown", {
                done: humanDuration(plant.age_days, t),
                total: humanDuration(growingDays(plant), t),
              })}
        </span>
        {!fullyGrown && (
          <span className="font-heading text-foreground text-sm tabular-nums">
            {growthPercent(plant)}%
          </span>
        )}
      </div>

      {/* Growing part (light) then the harvest window (green); the dark
          fill shows how far along today is. */}
      <div className="relative mt-5 h-2.5 w-full rounded-full" aria-hidden="true">
        <div className="bg-muted absolute inset-y-0 left-0 rounded-l-full" style={{ width: `${windowStart}%` }} />
        <div
          className="bg-risk-low/30 absolute inset-y-0 rounded-r-full"
          style={{ left: `${windowStart}%`, width: `${windowWidth}%` }}
        />
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full opacity-80", style.bar)}
          style={{ width: `${todayAt}%` }}
        />
        <div
          className="absolute -top-5 flex -translate-x-1/2 flex-col items-center"
          style={{ left: `${Math.min(96, Math.max(4, todayAt))}%` }}
        >
          <span className="text-foreground text-[10px] leading-none font-medium">
            {t("harvestCard.today")}
          </span>
          <span className="bg-foreground mt-0.5 h-5 w-0.5 rounded-full" />
        </div>
      </div>

      <div className="text-muted-foreground grid grid-cols-3 gap-2 text-[11px] leading-tight">
        <div>
          <p>{t("harvestCard.planted")}</p>
          <p className="text-foreground font-medium">{date(plant.planting_date)}</p>
        </div>
        <div className="text-center">
          <p>{t("harvestCard.readyFrom")}</p>
          <p className="text-foreground font-medium">{date(plant.expected_harvest_start)}</p>
        </div>
        <div className="text-right">
          <p>{t("harvestCard.readyUntil")}</p>
          <p className="text-foreground font-medium">{date(plant.expected_harvest_end)}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * "How to tell it is ready", behind a light bulb so it takes no room on
 * the card: it pops up when pointed at, or when tapped on a phone.
 */
function ReadyTip({ tip }: { tip: string }) {
  const { t } = useLanguage();
  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={100}
        aria-label={t("harvestCard.tipTitle")}
        className="text-risk-medium hover:bg-risk-medium/15 data-[popup-open]:bg-risk-medium/15 flex size-6 shrink-0 items-center justify-center rounded-full transition-colors"
      >
        <Lightbulb className="size-4" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" align="end" sideOffset={6} className="z-50">
          <Popover.Popup className="bg-popover text-popover-foreground border-border max-w-64 rounded-lg border px-3 py-2.5 text-[13px] shadow-lg">
            <p className="flex items-center gap-1.5 font-medium">
              <Lightbulb className="text-risk-medium size-3.5" aria-hidden="true" />
              {t("harvestCard.tipTitle")}
            </p>
            <p className="text-muted-foreground mt-1">{tip}</p>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function HarvestPlantCard({
  plant,
  onStatusChange,
}: {
  plant: BackendPlant;
  /** Saves the new status; resolves once Django has it. */
  onStatusChange?: (plant: BackendPlant, status: "GROWING" | "HARVESTED") => Promise<void>;
}) {
  const { t, dateLocale } = useLanguage();
  const date = (iso: string) => formatDisplayDate(iso, dateLocale);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const phase = phaseOf(plant);
  const style = PHASE_STYLE[phase];
  const Icon = style.icon;
  const tipKey = `harvestTip.${plant.crop.id}` as MessageKey;
  const tip = t(tipKey);
  const hasTip = tip !== tipKey;
  const canMark = phase === "open" || phase === "passed";

  async function change(status: "GROWING" | "HARVESTED") {
    if (!onStatusChange || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await onStatusChange(plant, status);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    // Outlined in the crop's own colour on hover or tap, as on My Plants.
    <Card
      style={cropVar(plant.crop.name)}
      className={cn(
        "h-full min-w-0 gap-2 py-4 transition-all",
        CROP_OUTLINE,
        phase === "harvested" && "opacity-75",
      )}
      data-phase={phase}
    >
      <CardContent className="flex h-full flex-col gap-3.5 px-4 sm:px-5">
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
              <p className="text-muted-foreground mt-0.5 text-sm">
                {plant.crop.name} ·{" "}
                {plant.crop.category === "fruit"
                  ? t("category.fruit")
                  : plant.crop.category === "vegetable"
                    ? t("category.vegetable")
                    : plant.crop.category_label}
              </p>
            </div>
          </div>
          <div className="flex max-w-[55%] shrink-0 items-start gap-1.5">
            <span
              className={cn(
                // May wrap rather than push the card past a phone's edge.
                "font-heading rounded-2xl border px-2.5 py-0.5 text-center text-xs font-medium tracking-wide",
                style.pill,
              )}
            >
              {phaseLabel(plant, phase, t)}
            </span>
            {hasTip && phase !== "harvested" && <ReadyTip tip={tip} />}
          </div>
        </div>

        {/* The answer first, in one plain sentence. */}
        <div className="flex flex-col gap-0.5">
          <p className={cn("font-heading flex items-center gap-1.5 text-[15px] font-medium", style.text)}>
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {headline(plant, phase, t, date)}
          </p>
          {/* Not on a missed harvest: "you can harvest for" is over. */}
          {phase !== "harvested" && phase !== "passed" && (
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Hourglass className="size-3 shrink-0" aria-hidden="true" />
              {/* The dates are on the timeline below; this adds how long. */}
              {t("harvestCard.lasts")} {humanDuration(harvestWindowDays(plant), t)}
            </p>
          )}
          {phase === "passed" && (
            <p className="text-risk-high mt-1 text-xs">{t("harvestCard.passedHelp")}</p>
          )}
        </div>

        {phase !== "harvested" && <Timeline plant={plant} phase={phase} />}


        <div className="border-border mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
          {onStatusChange && canMark && (
            <Button size="sm" onClick={() => change("HARVESTED")} disabled={saving}>
              {saving ? (
                <>
                  <LoaderCircle className="size-3.5 animate-spin" />
                  {t("harvestCard.saving")}
                </>
              ) : (
                <>
                  <CircleCheck className="size-3.5" />
                  {t("harvestCard.markHarvested")}
                </>
              )}
            </Button>
          )}
          {onStatusChange && plant.status === "HARVESTED" && (
            <Button size="sm" variant="outline" onClick={() => change("GROWING")} disabled={saving}>
              {saving ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <Undo2 className="size-3.5" />
              )}
              {t("harvestCard.restore")}
            </Button>
          )}
          <Link
            href={`/farmer/plants/${plant.id}`}
            className="ml-auto flex items-center gap-1 text-sm"
            style={{ color: "var(--landing-accent)" }}
          >
            {t("harvestCard.viewPlant")}
            <ArrowRight className="size-3.5" />
          </Link>
          {failed && (
            <p className="text-risk-high w-full text-xs" role="alert">
              {t("harvestCard.saveFailed")}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

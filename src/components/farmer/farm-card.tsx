"use client";

import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { Card } from "@/components/ui/card";
import type { BackendPlant } from "@/lib/api/plants-api";
import type { BackendAssessment } from "@/lib/api/risk-api";
import { CROP_OUTLINE, cropTint, cropVar } from "@/lib/crop-colors";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The plant card look shared by the farmer pages (Risk Indicator, My Plants,
 * Harvest): a soft wash of the card's accent colour across the top, the crop
 * tile with a ring and status dot, a pill with an icon, and a lift on hover.
 */

/** Whole days from an ISO date (YYYY-MM-DD) to today, in local time. */
export function daysSince(iso: string): number {
  const then = new Date(`${iso}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((now.getTime() - then.getTime()) / 86_400_000);
}

/** An ISO date (YYYY-MM-DD) moved by whole days. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The first weekly check opens when a plant is this many days old. */
export const FIRST_CHECK_AGE_DAYS = 7;

/** Days a due weekly check has been waiting (0 when not late, or an early re-check). */
export function overdueDays(plant: BackendPlant): number {
  const e = plant.assessment_eligibility;
  if (!e.can_assess || e.early_recheck) return 0;
  if (e.next_assessment_date) return Math.max(0, daysSince(e.next_assessment_date));
  // Never checked: the first check was due a week after planting.
  if (!e.last_assessment_date) return Math.max(0, plant.age_days - FIRST_CHECK_AGE_DAYS);
  return 0;
}

/** The card itself: crop outline on hover, a lift, and the accent wash on top. */
export function FarmCard({
  cropName,
  accent,
  strong = false,
  className,
  style,
  children,
  ...props
}: ComponentProps<typeof Card> & {
  cropName: string;
  /** A CSS colour, e.g. "var(--risk-high)". */
  accent: string;
  /** A stronger wash, for a card that needs attention. */
  strong?: boolean;
}) {
  return (
    <Card
      style={{ ...cropVar(cropName), ...style }}
      className={cn(
        "relative isolate h-full min-w-0 gap-2 overflow-hidden py-4 transition-all hover:-translate-y-0.5 hover:shadow-lg",
        CROP_OUTLINE,
        className,
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-28"
        style={{
          background: `radial-gradient(120% 100% at 0% 0%, color-mix(in oklch, ${accent}, transparent ${
            strong ? 78 : 88
          }%), transparent 70%)`,
        }}
      />
      {children}
    </Card>
  );
}

/** The crop's emoji in its tile, ringed in the accent, with an optional status dot. */
export function CropTile({
  cropName,
  emoji,
  accent,
  ring = false,
  dot = false,
  pulse = false,
  className,
}: {
  cropName: string;
  emoji: string;
  accent: string;
  ring?: boolean;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span className="relative shrink-0">
      <span
        aria-hidden="true"
        className={cn(
          "ring-offset-card flex size-11 items-center justify-center rounded-xl text-2xl leading-none",
          ring && "ring-2 ring-offset-2",
          className,
        )}
        style={{
          backgroundColor: cropTint(cropName),
          ...(ring ? { "--tw-ring-color": `color-mix(in oklch, ${accent}, transparent 55%)` } : {}),
        }}
      >
        {emoji}
      </span>
      {dot && (
        <span aria-hidden="true" className="absolute -top-1 -right-1 flex size-3">
          {pulse && (
            <span
              className="absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:hidden"
              style={{ backgroundColor: accent }}
            />
          )}
          <span className="ring-card relative size-3 rounded-full ring-2" style={{ backgroundColor: accent }} />
        </span>
      )}
    </span>
  );
}

/** The status pill in a card's corner, with its icon. */
export function CardPill({
  icon: Icon,
  className,
  children,
}: {
  icon?: LucideIcon;
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        // May wrap rather than push the card past a phone's edge.
        "font-heading flex items-center gap-1 rounded-2xl border px-2.5 py-0.5 text-center text-xs font-medium tracking-wide",
        className,
      )}
    >
      {Icon && <Icon className="size-3 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * The weekly check as a timeline, the twin of the Harvest card's: the last
 * check (or planting) on the left, the next check on the right, and today
 * marked between them. Full and red once the check is overdue.
 */
export function CheckTimeline({
  plant,
  latest,
  accent,
}: {
  plant: BackendPlant;
  latest?: BackendAssessment | null;
  accent: string;
}) {
  const { t, dateLocale } = useLanguage();
  const e = plant.assessment_eligibility;
  const short = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(dateLocale, { month: "short", day: "numeric" });

  const overdue = overdueDays(plant);
  const checked = latest?.assessment_date ?? e.last_assessment_date;
  const start = checked ?? plant.planting_date;
  const next =
    e.next_assessment_date ?? addDays(start, checked ? e.interval_days || 7 : FIRST_CHECK_AGE_DAYS);
  const span = Math.max(1, daysSince(start) - daysSince(next));
  const due = e.can_assess && !e.early_recheck;
  const todayAt = due ? 100 : Math.min(100, Math.max(0, (daysSince(start) / span) * 100));
  const daysLeft = Math.max(0, -daysSince(next));
  const fill = overdue > 0 ? "var(--risk-high)" : due ? "var(--primary)" : accent;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-foreground/75 flex items-baseline justify-between gap-2 text-[13px]">
        <span>{t("riskTimeline.title")}</span>
        <span
          className={cn(
            "font-heading text-sm tabular-nums",
            overdue > 0 ? "text-risk-high" : due ? "text-primary" : "text-foreground",
          )}
        >
          {due
            ? t("riskPage.dueNow")
            : daysLeft === 1
              ? t("riskPage.nextInOne")
              : t("riskPage.nextIn", { n: daysLeft })}
        </span>
      </div>

      <TimelineBar todayAt={todayAt} fill={fill} />

      <div className="text-muted-foreground grid grid-cols-2 gap-2 text-[11px] leading-tight">
        <div>
          <p>{checked ? t("riskTimeline.lastCheck") : t("harvestCard.planted")}</p>
          <p className="text-foreground font-medium">{short(start)}</p>
        </div>
        <div className="text-right">
          <p>{checked ? t("riskTimeline.nextCheck") : t("riskTimeline.firstCheck")}</p>
          <p className={cn("font-medium", overdue > 0 ? "text-risk-high" : "text-foreground")}>
            {short(next)}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The bar both timelines draw: a muted track, a fill that fades in from the
 * left, and "Today" marked above it. `children` paints extra bands (the
 * Harvest window) under the fill.
 */
export function TimelineBar({
  todayAt,
  fill,
  children,
}: {
  todayAt: number;
  fill: string;
  children?: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <div className="relative mt-5 h-2.5 w-full rounded-full" aria-hidden="true">
      <div className="bg-muted absolute inset-0 rounded-full" />
      {children}
      <div
        className="absolute inset-y-0 left-0 rounded-full opacity-85 transition-[width] duration-700"
        style={{
          width: `${todayAt}%`,
          background: `linear-gradient(90deg, color-mix(in oklch, ${fill}, transparent 55%), ${fill})`,
        }}
      />
      <div
        className="absolute -top-5 flex -translate-x-1/2 flex-col items-center"
        style={{ left: `${Math.min(96, Math.max(4, todayAt))}%` }}
      >
        <span className="text-foreground text-[10px] leading-none font-medium">{t("harvestCard.today")}</span>
        <span className="bg-foreground mt-0.5 h-5 w-0.5 rounded-full" />
      </div>
    </div>
  );
}

/** The line along the bottom of every card, above its actions. */
export const CARD_FOOTER = "border-border mt-auto flex flex-wrap items-center gap-2 border-t pt-3";

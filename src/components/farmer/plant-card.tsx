"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Check,
  CircleCheck,
  ClipboardList,
  Sprout,
  type LucideIcon,
} from "lucide-react";

import { CARD_FOOTER, CardPill, CheckTimeline, CropTile, FarmCard, overdueDays } from "@/components/farmer/farm-card";
import { PHASE_STYLE, phaseLabel } from "@/components/farmer/harvest-plant-card";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { formatDisplayDate } from "@/components/ui/date-picker";
import type { BackendPlant } from "@/lib/api/plants-api";
import { phaseOf } from "@/lib/harvest";
import { useLanguage } from "@/lib/i18n";
import { plantSubtitle, plantTitle } from "@/lib/plant-summary";
import { cn } from "@/lib/utils";

/**
 * Card for a real, database-backed plant owned by the authenticated Farmer,
 * in the same design as the Risk Indicator and Harvest cards: the crop and
 * name with its harvest status as a pill, the weekly check in one sentence,
 * the weekly-check timeline, and "Assess now" along the bottom when due.
 *
 * In selection mode (`onToggle` given) the whole card becomes a checkbox,
 * so tapping it selects the plant, and the footer action is left out.
 */
export function PlantCard({
  plant,
  selected = false,
  highlighted = false,
  onToggle,
}: {
  plant: BackendPlant;
  selected?: boolean;
  /** The plant just added, or opened from the Harvest page: marked to stand out. */
  highlighted?: boolean;
  /** Selection mode: tapping the card toggles it instead of opening it. */
  onToggle?: () => void;
}) {
  const selecting = onToggle !== undefined;
  const { t, dateLocale } = useLanguage();
  const date = (iso: string) => formatDisplayDate(iso, dateLocale);
  const e = plant.assessment_eligibility;
  const phase = phaseOf(plant);
  const phaseStyle = PHASE_STYLE[phase];
  const overdue = overdueDays(plant);

  // The weekly assessment is the Farmer's recurring job: where this plant
  // stands with it, in one sentence, and the colour the card takes from it.
  let status: { icon: LucideIcon; text: string; tone: string; accent: string } | null = null;
  if (plant.is_planned) {
    status = {
      icon: CalendarClock,
      text: t("card.plannedAssess", { date: date(plant.planting_date) }),
      tone: "text-muted-foreground",
      accent: "var(--risk-early)",
    };
  } else if (e.too_young && e.next_assessment_date) {
    // Planted, but not yet worth judging: the first check has a date.
    status = {
      icon: CalendarClock,
      text: t("young.first", { date: date(e.next_assessment_date) }),
      tone: "text-muted-foreground",
      accent: "var(--risk-early)",
    };
  } else if (e.can_assess) {
    status = {
      icon: ClipboardList,
      text: t("card.ready"),
      tone: overdue > 0 ? "text-risk-high" : "text-primary",
      accent: overdue > 0 ? "var(--risk-high)" : "var(--primary)",
    };
  } else if (e.next_assessment_date) {
    status = {
      icon: CircleCheck,
      text: t("card.assessedNext", { date: date(e.next_assessment_date) }),
      tone: "text-risk-low",
      accent: "var(--risk-low)",
    };
  }
  const accent = status?.accent ?? "var(--primary)";
  const StatusIcon = status?.icon;

  const card = (
    <FarmCard
      // Focusable so a tap on a phone, where there is no hover, leaves the
      // crop-coloured outline on the plant touched.
      tabIndex={selecting ? undefined : 0}
      // The anchor "View plant" on the Harvest page scrolls to.
      id={`plant-${plant.id}`}
      cropName={plant.crop.name}
      accent={accent}
      strong={e.can_assess}
      className={cn(
        "scroll-mt-24",
        selecting &&
          (selected ? "border-primary ring-primary/30 ring-2" : "hover:border-primary/50"),
        highlighted && !selecting && "border-risk-low ring-risk-low/30 ring-2",
      )}
    >
      {selecting && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-3 right-3 z-10 flex size-5 items-center justify-center rounded-md border-2 transition-colors",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/50 bg-background",
          )}
        >
          {selected && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      )}
      <CardContent className="flex h-full flex-col gap-3.5 px-4 sm:px-5">
        <div className={cn("flex items-start justify-between gap-2", selecting && "pr-7")}>
          <div className="flex min-w-0 items-start gap-3">
            <CropTile
              cropName={plant.crop.name}
              emoji={plant.crop.emoji}
              accent={accent}
              ring={e.can_assess}
              dot={e.can_assess}
              pulse={overdue > 0}
            />
            <div className="min-w-0">
              <p className="font-heading line-clamp-2 text-[17px] leading-snug break-words">
                {plantTitle(plant)}
              </p>
              <p className="text-muted-foreground mt-0.5 text-sm">{plantSubtitle(plant, t)}</p>
            </div>
          </div>
          <div className="flex max-w-[55%] shrink-0 items-start">
            <CardPill icon={phaseStyle.icon} className={phaseStyle.pill}>
              {phaseLabel(plant, phase, t)}
            </CardPill>
          </div>
        </div>

        {/* Where the weekly check stands, then when it went in the ground. */}
        <div className="flex flex-col gap-1">
          {status && StatusIcon && (
            <p className={cn("font-heading flex items-center gap-1.5 text-[15px] font-medium", status.tone)}>
              <StatusIcon className="size-4 shrink-0" aria-hidden="true" />
              {status.text}
            </p>
          )}
          {/* Only the planting date: the harvest date is on the Harvest page. */}
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Sprout className="size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {t(plant.is_planned ? "card.plantingOn" : "card.planted", {
                date: date(plant.planting_date),
              })}
            </span>
          </p>
        </div>

        {!plant.is_planned && <CheckTimeline plant={plant} accent={accent} />}

        {!selecting && e.can_assess && (
          <div className={CARD_FOOTER}>
            <Button
              size="sm"
              className="h-7 px-2.5 text-xs"
              nativeButton={false}
              render={<Link href={`/farmer/plants/${plant.id}/assessment`} />}
            >
              {e.early_recheck ? t("riskCard.early") : t("riskPage.assessNow")}
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </FarmCard>
  );

  if (selecting) {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={t("card.select", { name: plantTitle(plant) })}
        onClick={onToggle}
        // A button is only as wide as its content; block + full width keeps
        // the card filling its grid cell exactly as it does outside Select.
        className="focus-visible:ring-ring/50 block h-full w-full rounded-xl text-left outline-none focus-visible:ring-3"
      >
        {card}
      </button>
    );
  }

  // Not a link: the card already shows everything the farmer needs about
  // the plant, so there is no separate plant page to open.
  return card;
}

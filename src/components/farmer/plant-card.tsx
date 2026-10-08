"use client";

import { CalendarClock, Check, CircleCheck, ClipboardList } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatDisplayDate } from "@/components/ui/date-picker";
import type { BackendPlant } from "@/lib/api/plants-api";
import { cropColor, cropTint } from "@/lib/crop-colors";
import { useLanguage } from "@/lib/i18n";
import { plantSubtitle, plantTitle } from "@/lib/plant-summary";
import { cn } from "@/lib/utils";

/**
 * Card for a real, database-backed plant owned by the authenticated Farmer.
 *
 * Display only. In selection mode (`onToggle` given) the whole card
 * becomes a checkbox, so tapping it selects the plant.
 */
export function PlantCard({
  plant,
  selected = false,
  highlighted = false,
  onToggle,
}: {
  plant: BackendPlant;
  selected?: boolean;
  /** The plant the farmer just added, marked so it is easy to spot. */
  highlighted?: boolean;
  /** Selection mode: tapping the card toggles it instead of opening it. */
  onToggle?: () => void;
}) {
  const selecting = onToggle !== undefined;
  const { t, dateLocale } = useLanguage();
  const date = (iso: string) => formatDisplayDate(iso, dateLocale);

  const card = (
    <Card
      // Outlined in the crop's own colour (ginger brown, eggplant purple)
      // while pointed at, pressed, or tapped. Focusable so a tap on a phone,
      // where there is no hover, leaves the outline on the plant touched.
      tabIndex={selecting ? undefined : 0}
      style={{ "--crop": cropColor(plant.crop.name) } as React.CSSProperties}
      className={cn(
        "relative h-full gap-0 py-4 transition-all outline-none",
        !selecting &&
          "hover:border-(--crop) hover:ring-(--crop)/25 focus:border-(--crop) focus:ring-(--crop)/25 active:border-(--crop) active:ring-(--crop)/25 focus:ring-3 hover:ring-3 active:ring-3",
        selecting &&
          (selected ? "border-primary ring-primary/30 ring-2" : "hover:border-primary/50"),
        highlighted && !selecting && "border-risk-low ring-risk-low/30 ring-2",
      )}
    >
      {selecting && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-3 right-3 flex size-5 items-center justify-center rounded-md border-2 transition-colors",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/50 bg-background",
          )}
        >
          {selected && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      )}
      {/* One row: the emoji in its own chip, and every line of text in a
          single column beside it, so nothing wraps back under the emoji and
          leaves a gap on narrow phone screens. */}
      <CardContent className={cn("flex items-start gap-3 px-4", selecting && "pr-10")}>
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-xl text-[28px] leading-none"
          style={{ backgroundColor: cropTint(plant.crop.name) }}
        >
          {plant.crop.emoji}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-heading truncate text-lg leading-tight font-medium">{plantTitle(plant)}</p>
          <p className="text-muted-foreground truncate text-sm">{plantSubtitle(plant, t)}</p>
          {/* Only the planting date: the harvest date is on the Harvest page. */}
          <span className="text-foreground/75 mt-1 text-[13px]">
            {t(plant.is_planned ? "card.plantingOn" : "card.planted", {
              date: date(plant.planting_date),
            })}
          </span>

          {/* The weekly assessment is the Farmer's recurring job, and the lock
              state was already on every plant - it just was not shown, so the
              only way to find an assessable plant was to open each one. */}
          {plant.is_planned ? (
            <span className="font-heading text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide">
              <CalendarClock className="size-3.5 shrink-0" />
              {t("card.plannedAssess", { date: date(plant.planting_date) })}
            </span>
          ) : plant.assessment_eligibility.too_young &&
            plant.assessment_eligibility.next_assessment_date ? (
            // Planted, but not yet worth judging: the first check has a date.
            <span className="font-heading text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide">
              <CalendarClock className="size-3.5 shrink-0" />
              {t("young.first", {
                date: date(plant.assessment_eligibility.next_assessment_date),
              })}
            </span>
          ) : plant.assessment_eligibility.can_assess ? (
            <span className="font-heading text-primary flex items-center gap-1.5 text-xs font-medium tracking-wide">
              <ClipboardList className="size-3.5 shrink-0" />
              {t("card.ready")}
            </span>
          ) : plant.assessment_eligibility.next_assessment_date ? (
            <span className="font-heading text-muted-foreground/70 flex items-center gap-1.5 text-xs font-medium tracking-wide">
              <CircleCheck className="size-3.5 shrink-0" />
              {t("card.assessedNext", {
                date: date(plant.assessment_eligibility.next_assessment_date),
              })}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

  if (selecting) {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={t("card.select", { name: plantTitle(plant) })}
        onClick={onToggle}
        className="focus-visible:ring-ring/50 h-full rounded-xl text-left outline-none focus-visible:ring-3"
      >
        {card}
      </button>
    );
  }

  // Not a link: the card already shows everything the farmer needs about
  // the plant, so there is no separate plant page to open.
  return card;
}

"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, Check, CircleCheck, ClipboardList } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatDisplayDate } from "@/components/ui/date-picker";
import type { BackendPlant } from "@/lib/api/plants-api";
import { useLanguage } from "@/lib/i18n";
import { plantAgeLabel, plantSubtitle, plantTitle } from "@/lib/plant-summary";
import { cn } from "@/lib/utils";

/**
 * Card for a real, database-backed plant owned by the authenticated Farmer.
 *
 * Normally a link to the plant. In selection mode (`onToggle` given) the
 * whole card becomes a checkbox instead, so tapping it selects the plant
 * rather than opening it — a card that did both would open a plant the
 * farmer only meant to tick.
 */
export function PlantCard({
  plant,
  selected = false,
  onToggle,
}: {
  plant: BackendPlant;
  selected?: boolean;
  /** Selection mode: tapping the card toggles it instead of opening it. */
  onToggle?: () => void;
}) {
  const selecting = onToggle !== undefined;
  const { t, dateLocale } = useLanguage();
  const date = (iso: string) => formatDisplayDate(iso, dateLocale);

  const card = (
    <Card
      className={cn(
        "relative h-full gap-4 py-5 transition-all",
        selecting
          ? selected
            ? "border-primary ring-primary/30 ring-2"
            : "hover:border-primary/50"
          : "hover:border-primary/50 hover:shadow-primary/10 hover:-translate-y-0.5 hover:shadow-lg",
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
      <CardContent className="flex flex-col gap-3 px-5">
        <div className={cn("min-w-0", selecting && "pr-7")}>
          <p className="truncate font-medium">
            <span aria-hidden="true">{plant.crop.emoji}</span> {plantTitle(plant)}
          </p>
          <p className="text-muted-foreground truncate text-sm">{plantSubtitle(plant, t)}</p>
        </div>
        <div className="text-muted-foreground flex flex-col gap-1 text-xs">
          <span>
            {t(plant.is_planned ? "card.plantingOn" : "card.planted", {
              date: date(plant.planting_date),
            })}
          </span>
          <span className="flex items-center gap-1">
            {t("card.expected", { date: date(plant.expected_harvest_start) })}
            <ArrowRight className="size-3" />
          </span>
          {!plant.is_planned && <span>{plantAgeLabel(plant.age_days, t)}</span>}
        </div>

        {/* The weekly assessment is the Farmer's recurring job, and the lock
            state was already on every plant - it just was not shown, so the
            only way to find an assessable plant was to open each one. */}
        {plant.is_planned ? (
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
            <CalendarClock className="size-3.5 shrink-0" />
            {t("card.plannedAssess", { date: date(plant.planting_date) })}
          </span>
        ) : plant.assessment_eligibility.can_assess ? (
          <span className="text-primary flex items-center gap-1.5 text-xs font-medium">
            <ClipboardList className="size-3.5 shrink-0" />
            {t("card.ready")}
          </span>
        ) : plant.assessment_eligibility.next_assessment_date ? (
          <span className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <CircleCheck className="size-3.5 shrink-0" />
            {t("card.assessedNext", {
              date: date(plant.assessment_eligibility.next_assessment_date),
            })}
          </span>
        ) : null}
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

  return <Link href={`/farmer/plants/${plant.id}`}>{card}</Link>;
}

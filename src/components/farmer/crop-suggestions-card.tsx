"use client";

import Link from "next/link";
import { ArrowRight, Sprout } from "lucide-react";
import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { DatePicker, formatDisplayDate } from "@/components/ui/date-picker";
import type { BackendPlant } from "@/lib/api/plants-api";
import { useLanguage } from "@/lib/i18n";

/**
 * The plants a farmer put in the ground on a date they pick.
 *
 * Picking a date shows only what was planted that day — or, for a future
 * day, what is planned for it — or says plainly that nothing is. It opens on
 * today, the earliest day the calendar offers.
 */

function todayIso(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function CropSuggestionsCard({ plants = [] }: { plants?: BackendPlant[] }) {
  const [plantingDate, setPlantingDate] = useState(todayIso());
  const { t, dateLocale } = useLanguage();

  // Archived plants were removed by the farmer, so they are not "planted".
  const livePlants = plants.filter((plant) => plant.status !== "ARCHIVED");
  const plantedOn = livePlants.filter((plant) => plant.planting_date === plantingDate);
  const hasPlants = livePlants.length > 0;
  const future = plantingDate > todayIso();

  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-1.5 pt-1.5 text-sm font-medium">
            <Sprout
              className="size-4 shrink-0"
              style={{ color: "var(--landing-accent)" }}
              aria-hidden="true"
            />
            {t("suited.title")}
          </h2>

          {hasPlants ? (
            // The shared picker is full-width, so the slot sets the width.
            <div className="w-32 shrink-0">
              <DatePicker
                id="suggestion-date"
                value={plantingDate}
                onChange={setPlantingDate}
                placeholder={t("suited.pickDate")}
                compact
                // The trigger sits at the card's right edge, so the calendar
                // opens leftwards and stays inside the card.
                align="end"
              />
            </div>
          ) : (
            <Link
              href="/farmer/plants/new"
              className="shrink-0 pt-1.5 text-xs underline underline-offset-2"
              style={{ color: "var(--landing-accent)" }}
            >
              {t("suited.addPlant")}
            </Link>
          )}
        </div>

        {!hasPlants ? (
          <p className="text-muted-foreground mt-2 text-sm">
            {t("suited.empty")}
          </p>
        ) : (
          // One live region, so a new date is announced as one answer.
          <div role="status">
            <p className="text-muted-foreground mt-1 text-xs">
              {plantedOn.length === 0
                ? t(future ? "suited.nothingPlanned" : "suited.nothingPlanted", {
                    date: formatDisplayDate(plantingDate, dateLocale),
                  })
                : t(future ? "suited.plannedFor" : "suited.plantedOn", {
                    date: formatDisplayDate(plantingDate, dateLocale),
                    count:
                      plantedOn.length === 1
                        ? t("plants.one")
                        : t("plants.many", { n: plantedOn.length }),
                  })}
            </p>

            {plantedOn.length > 0 && (
              <ul className="mt-2 flex flex-col" aria-label={t("suited.listLabel")}>
                {plantedOn.map((plant) => (
                  <li key={plant.id} className="border-border/60 border-t first:border-t-0">
                    <Link
                      href={`/farmer/plants/${plant.id}`}
                      className="hover:bg-accent/40 -mx-1 flex items-center gap-2.5 rounded-lg px-1 py-2 transition-colors"
                    >
                      <span aria-hidden="true" className="text-base">
                        {plant.crop.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{plant.display_name}</span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {plant.is_planned ? t("plant.planned") : plant.status_label}
                        </span>
                      </span>
                      <ArrowRight className="text-muted-foreground size-3.5 shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

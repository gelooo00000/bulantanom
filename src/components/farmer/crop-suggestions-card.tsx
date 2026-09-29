"use client";

import Link from "next/link";
import { Sprout } from "lucide-react";
import { useState } from "react";

import { SlidePager } from "@/components/shared/slide-pager";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker, formatDisplayDate } from "@/components/ui/date-picker";
import type { BackendPlant } from "@/lib/api/plants-api";
import { useLanguage } from "@/lib/i18n";

/**
 * The plants a farmer put in the ground on a date they pick.
 *
 * Picking a date shows only what was planted that day — or, for a future
 * day, what is planned for it — or says plainly that nothing is. It opens on
 * today, and reaches back to the start of the month of the first planting.
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

  // Back as far as the month of the farm's first planting, and no further:
  // a farm whose records start in September can open any September day,
  // even from October, but not August, where there is nothing to find.
  const plantingDays = [...new Set(livePlants.map((plant) => plant.planting_date))].sort();
  const firstPlanting = plantingDays[0] ?? todayIso();
  const earliest = `${(firstPlanting < todayIso() ? firstPlanting : todayIso()).slice(0, 7)}-01`;

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
                min={earliest}
                // A dot on every day something was planted, so they are
                // easy to find.
                marked={plantingDays}
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
              // Four at a time; the rows are information only, not links.
              // Keyed by date, so a new date starts on its first page.
              <SlidePager
                key={plantingDate}
                className="mt-2"
                items={plantedOn}
                listLabel={t("suited.listLabel")}
                getKey={(plant) => plant.id}
                renderItem={(plant) => (
                  <div className="flex items-center gap-2.5 py-2">
                    <span aria-hidden="true" className="text-base">
                      {plant.crop.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{plant.display_name}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {plant.is_planned ? t("plant.planned") : plant.status_label}
                      </span>
                    </span>
                  </div>
                )}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { DatePicker, formatDisplayDate } from "@/components/ui/date-picker";
import type { CropSuggestions, SuggestedCrop } from "@/lib/api/dashboard-api";
import type { BackendPlant } from "@/lib/api/plants-api";
import { monthFromIsoDate, monthName } from "@/lib/planting-season";

/**
 * Crops that suit this farm's soil, for a date the farmer picks.
 *
 * Suiting the soil and being in season are different questions, and a crop
 * needs both before it is worth planting. The AI recommendation answers the
 * first from the readings the farmer took; each crop's planting window
 * answers the second. The calendar is what puts a date between them.
 *
 * Only the crops worth planting on that date are listed. Showing the rest
 * greyed out would make the card longer without making it more useful —
 * a farmer picking a date wants the answer for that date.
 *
 * The same date also looks backwards: the plants the farmer actually put in
 * the ground that day are listed first, so picking the 19th shows the
 * Pineapple planted on the 19th before anything they could still plant.
 */

function plantableOn(crop: SuggestedCrop, month: number): boolean {
  return (
    crop.planting_months.includes(month) || crop.caution_months.includes(month)
  );
}

function todayIso(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function CropSuggestionsCard({
  suggestions,
  plants = [],
}: {
  suggestions: CropSuggestions;
  /** The farmer's plants, matched against the picked date by planting day. */
  plants?: BackendPlant[];
}) {
  const [plantingDate, setPlantingDate] = useState(todayIso());
  const { has_any: hasAny, recorded_on: recordedOn, crops } = suggestions;

  const month = monthFromIsoDate(plantingDate);
  const forDate = crops.filter((crop) => plantableOn(crop, month));
  // Archived plants were removed by the farmer, so they are not "planted".
  const livePlants = plants.filter((plant) => plant.status !== "ARCHIVED");
  const plantedOn = livePlants.filter(
    (plant) => plant.planting_date === plantingDate,
  );
  // The calendar is worth showing once there is anything to look up by date.
  const showPicker = hasAny || livePlants.length > 0;

  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-1.5 pt-1.5 text-sm font-medium">
            <Sparkles
              className="size-4 shrink-0"
              style={{ color: "var(--landing-accent)" }}
              aria-hidden="true"
            />
            Suited to your soil
          </h2>

          {showPicker ? (
            // Sits where the "Full recommendation" link used to. The shared
            // picker is full-width, so the slot sets the width instead of
            // the component growing a variant only this card would use.
            <div className="w-32 shrink-0">
              <DatePicker
                id="suggestion-date"
                value={plantingDate}
                onChange={setPlantingDate}
                placeholder="Pick a date"
                compact
              />
            </div>
          ) : (
            <Link
              href="/farmer/soil-recommendation"
              className="shrink-0 pt-1.5 text-xs underline underline-offset-2"
              style={{ color: "var(--landing-accent)" }}
            >
              Get recommendation
            </Link>
          )}
        </div>

        {!showPicker ? (
          <p className="text-muted-foreground mt-2 text-sm">
            Enter your soil detector readings and BulanTanom will suggest crops
            that suit your soil.
          </p>
        ) : (
          <>
            {hasAny && (
              <p className="text-muted-foreground mt-1 text-xs">
                From your soil reading on {formatDisplayDate(recordedOn ?? "")}{" "}
                · tap one to add it
              </p>
            )}

            {/* One live region, so a new date is announced as one answer. */}
            <div role="status">
              {plantedOn.length > 0 && (
                <section aria-label="Planted on this date">
                  <h3 className="text-muted-foreground mt-3 text-xs font-medium">
                    Planted on {formatDisplayDate(plantingDate)}
                  </h3>
                  <ul className="mt-1 flex flex-col">
                    {plantedOn.map((plant) => (
                      <li
                        key={plant.id}
                        className="border-border/60 border-t first:border-t-0"
                      >
                        <Link
                          href={`/farmer/plants/${plant.id}`}
                          className="hover:bg-accent/40 -mx-1 flex items-center gap-2.5 rounded-lg px-1 py-2 transition-colors"
                        >
                          <span aria-hidden="true" className="text-base">
                            {plant.crop.emoji}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">
                              {plant.display_name}
                            </span>
                            <span className="text-muted-foreground block truncate text-xs">
                              {plant.status_label}
                            </span>
                          </span>
                          <ArrowRight className="text-muted-foreground size-3.5 shrink-0" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {!hasAny ? (
                <p className="text-muted-foreground mt-3 text-sm">
                  {plantedOn.length === 0 &&
                    `Nothing was planted on ${formatDisplayDate(plantingDate)}. `}
                  Enter your soil detector readings and BulanTanom will suggest
                  crops that suit your soil.
                </p>
              ) : forDate.length === 0 ? (
                <p className="text-muted-foreground mt-3 text-sm">
                  None of your soil&apos;s crops are in season in{" "}
                  {monthName(month)}. Pick another date to see when they come
                  back.
                </p>
              ) : (
                <section aria-label="Suited to plant on this date">
                  {plantedOn.length > 0 && (
                    <h3 className="text-muted-foreground mt-3 text-xs font-medium">
                      Suited to plant in {monthName(month)}
                    </h3>
                  )}
                  <ul className="mt-3 flex flex-col">
                    {forDate.map((crop) => (
                      <li
                        key={`${crop.id}-${crop.name}`}
                        className="border-border/60 border-t first:border-t-0"
                      >
                        <Link
                          href={`/farmer/plants/new?crop=${encodeURIComponent(crop.id)}&date=${plantingDate}`}
                          className="hover:bg-accent/40 -mx-1 flex items-center gap-2.5 rounded-lg px-1 py-2 transition-colors"
                        >
                          <span aria-hidden="true" className="text-base">
                            {crop.emoji}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">
                              {crop.name}
                            </span>
                            {crop.reason && (
                              <span className="text-muted-foreground block truncate text-xs">
                                {crop.reason}
                              </span>
                            )}
                          </span>
                          <ArrowRight className="text-muted-foreground size-3.5 shrink-0" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {hasAny ? (
              <p className="text-muted-foreground/70 mt-3 text-[11px]">
                AI suggestions based on the soil you recorded, shown for the
                date you picked. They do not replace advice from your LGU
                agriculturist.
              </p>
            ) : (
              <Link
                href="/farmer/soil-recommendation"
                className="mt-2 inline-block text-xs underline underline-offset-2"
                style={{ color: "var(--landing-accent)" }}
              >
                Get recommendation
              </Link>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

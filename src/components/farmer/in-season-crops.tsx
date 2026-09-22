"use client";

import { CalendarCheck, CloudRain } from "lucide-react";
import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { BackendCrop } from "@/lib/api/plants-api";
import { useLanguage } from "@/lib/i18n";
import { adviseForMonth, monthName } from "@/lib/planting-season";

/**
 * What is worth planting in a given month at Layuan Farm.
 *
 * NOT A WEATHER FORECAST. BulanTanom has no weather feed and no sensors, so
 * this cannot and does not say what the sky is doing today. It reads the
 * seasonal window each crop carries — derived from Bulan's PAGASA Type II
 * climate and the region's typhoon exposure, documented in
 * `plants/crop_calendar.py` — and answers the narrower, answerable question:
 * is this a month people plant this crop here.
 *
 * WHY IT ALSO SHOWS THE LEAN MONTHS HONESTLY
 * ------------------------------------------
 * Bulan's September-January is the rainfall peak and the typhoon peak at
 * once, and the catalog reflects that: one crop is in season in September
 * against seventeen in March. A panel that only listed the good months would
 * be an empty box for a third of the year. So when the list is short it says
 * so, offers what is workable with care, and names the month things pick up
 * again — which is the actually useful answer to "what can I plant now".
 *
 * Everything here is computed from `planting_window`, which already travels
 * on each crop. No extra request.
 */

/** Below this, the month is treated as lean and the panel explains itself. */
const SPARSE_THRESHOLD = 3;
/** A month needs at least this many to be worth pointing a farmer toward. */
const HEALTHY_THRESHOLD = 5;
/**
 * Chips shown before collapsing behind a toggle. Seventeen crops are in
 * season in March, which is about nine rows on a phone — enough to push the
 * crop picker, the date and the submit button off the screen. The shortlist
 * is an aid to the form, not a replacement for it.
 */
const COLLAPSED_LIMIT = 8;

type InSeasonCropsProps = {
  crops: BackendCrop[];
  month: number;
  selectedCropId: string | null;
  onSelect: (cropId: string) => void;
};

function countGood(crops: BackendCrop[], month: number): number {
  return crops.filter(
    (crop) => adviseForMonth(crop.planting_window, month)?.status === "good",
  ).length;
}

export function InSeasonCrops({
  crops,
  month,
  selectedCropId,
  onSelect,
}: InSeasonCropsProps) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLanguage();

  if (crops.length === 0) return null;

  const good = crops.filter(
    (crop) => adviseForMonth(crop.planting_window, month)?.status === "good",
  );
  const caution = crops.filter(
    (crop) => adviseForMonth(crop.planting_window, month)?.status === "caution",
  );

  const sparse = good.length < SPARSE_THRESHOLD;

  // The next month worth waiting for, searched forward a year so December
  // rolls into January rather than falling off the end.
  let nextGoodMonth: number | null = null;
  if (sparse) {
    for (let step = 1; step <= 12; step += 1) {
      const candidate = ((month - 1 + step) % 12) + 1;
      if (countGood(crops, candidate) >= HEALTHY_THRESHOLD) {
        nextGoodMonth = candidate;
        break;
      }
    }
  }

  const Icon = sparse ? CloudRain : CalendarCheck;

  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <h2 className="flex items-center gap-1.5 text-sm font-medium">
          <Icon
            className={sparse ? "text-risk-medium size-4" : "text-risk-low size-4"}
            aria-hidden="true"
          />
          {t("inSeason.title", { month: monthName(month, t) })}
        </h2>

        {good.length > 0 ? (
          <>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {good.length === 1
                ? t("inSeason.countOne")
                : t("inSeason.count", { n: good.length })}
            </p>
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {(expanded ? good : good.slice(0, COLLAPSED_LIMIT)).map((crop) => (
                <li key={crop.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(crop.id)}
                    aria-pressed={selectedCropId === crop.id}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${
                      selectedCropId === crop.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 hover:bg-accent"
                    }`}
                  >
                    <span aria-hidden="true">{crop.emoji}</span>
                    {crop.name}
                  </button>
                </li>
              ))}
            </ul>
            {good.length > COLLAPSED_LIMIT && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="text-muted-foreground hover:text-foreground mt-2 text-xs underline underline-offset-2"
              >
                {expanded ? t("inSeason.fewer") : t("inSeason.all", { n: good.length })}
              </button>
            )}
          </>
        ) : (
          <p className="text-muted-foreground mt-1 text-sm">
            {t("inSeason.none", { month: monthName(month, t) })}
          </p>
        )}

        {sparse && (
          <div className="border-border/60 mt-3 border-t pt-2.5">
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t("inSeason.wet", { month: monthName(month, t) })}
              {nextGoodMonth && (
                <>
                  {" "}
                  {t("inSeason.picksUp")}{" "}
                  <span className="text-foreground font-medium">
                    {monthName(nextGoodMonth, t)}
                  </span>
                  .
                </>
              )}
            </p>
            {caution.length > 0 && (
              <>
                <p className="text-muted-foreground mt-2.5 text-xs font-medium">
                  {t("inSeason.workable")}
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {caution.map((crop) => (
                    <li key={crop.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(crop.id)}
                        aria-pressed={selectedCropId === crop.id}
                        className={`flex items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5 text-sm transition-colors ${
                          selectedCropId === crop.id
                            ? "border-primary bg-primary/10"
                            : "border-border text-muted-foreground hover:border-primary/50 hover:bg-accent"
                        }`}
                      >
                        <span aria-hidden="true">{crop.emoji}</span>
                        {crop.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <p className="text-muted-foreground/70 mt-3 text-[11px]">
          {t("inSeason.note")}
        </p>
      </CardContent>
    </Card>
  );
}

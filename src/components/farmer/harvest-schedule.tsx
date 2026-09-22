"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatDisplayDate } from "@/components/ui/date-picker";
import type { UpcomingHarvest } from "@/lib/api/dashboard-api";
import { useLanguage, type Translate } from "@/lib/i18n";

/**
 * The next few harvest windows to open.
 *
 * Deliberately a compact list and not a tracker: the Harvest page already
 * has progress, countdowns and history. This answers "what is coming" in
 * one glance and links away for the rest.
 *
 * Dates are Django's, calculated from the crop or variety duration — never
 * recomputed here from the browser clock.
 */

function whenLabel(harvest: UpcomingHarvest, t: Translate): string {
  if (harvest.in_window) return t("when.readyNow");
  if (harvest.days_away === 0) return t("when.today");
  if (harvest.days_away === 1) return t("when.tomorrow");
  if (harvest.days_away < 30) return t("when.days", { n: harvest.days_away });
  const months = Math.round(harvest.days_away / 30);
  if (months < 12) return months === 1 ? t("when.month") : t("when.months", { n: months });
  const years = Math.round(harvest.days_away / 365);
  return years === 1 ? t("when.year") : t("when.years", { n: years });
}

type HarvestScheduleProps = {
  harvests: UpcomingHarvest[];
};

export function HarvestSchedule({ harvests }: HarvestScheduleProps) {
  const { t, dateLocale } = useLanguage();
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium">{t("harvest.title")}</h2>
          {harvests.length > 0 && (
            <Link
              href="/farmer/harvest"
              className="flex shrink-0 items-center gap-1 text-xs"
              style={{ color: "var(--landing-accent)" }}
            >
              {t("harvest.all")}
              <ArrowRight className="size-3" />
            </Link>
          )}
        </div>

        {harvests.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            {t("harvest.none")}
          </p>
        ) : (
          <ul className="mt-2 flex flex-col">
            {harvests.map((h) => (
              <li key={h.plant_id} className="border-border/60 border-t first:border-t-0">
                <Link
                  href={`/farmer/plants/${h.plant_id}`}
                  className="hover:bg-accent/40 -mx-1 flex items-center gap-2.5 rounded-lg px-1 py-2 transition-colors"
                >
                  <span aria-hidden="true" className="text-base">
                    {h.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{h.name}</span>
                    <span className="text-muted-foreground block text-xs">
                      {formatDisplayDate(h.expected_harvest_start, dateLocale)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-xs ${
                      h.in_window ? "text-risk-low font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {whenLabel(h, t)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

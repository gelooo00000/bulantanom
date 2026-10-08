"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { SlidePager } from "@/components/shared/slide-pager";
import { Card, CardContent } from "@/components/ui/card";
import { formatDisplayDate } from "@/components/ui/date-picker";
import type { BackendPlant } from "@/lib/api/plants-api";
import { cropTint } from "@/lib/crop-colors";
import { useLanguage } from "@/lib/i18n";
import { plantAgeLabel } from "@/lib/plant-summary";

/**
 * What is in the ground right now, newest planting first.
 *
 * A compact list, not a tracker: My Plants has the full cards. Planned
 * plantings (not in the ground yet) and harvested or archived plants are
 * left out, so every row is a crop actually growing on the farm.
 */
export function PlantedCrops({ plants }: { plants: BackendPlant[] }) {
  const { t, dateLocale } = useLanguage();
  const planted = plants
    .filter((p) => !p.is_planned && (p.status === "GROWING" || p.status === "READY_FOR_HARVEST"))
    .sort((a, b) => b.planting_date.localeCompare(a.planting_date) || b.id - a.id);

  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium">
            {t("planted.title")}
            {planted.length > 0 && (
              <span className="bg-muted text-muted-foreground ml-2 rounded-full px-1.5 text-xs tabular-nums">
                {planted.length}
              </span>
            )}
          </h2>
          {planted.length > 0 && (
            <Link
              href="/farmer/plants"
              className="flex shrink-0 items-center gap-1 text-xs"
              style={{ color: "var(--landing-accent)" }}
            >
              {t("planted.all")}
              <ArrowRight className="size-3" />
            </Link>
          )}
        </div>

        {planted.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">{t("planted.none")}</p>
        ) : (
          // Four at a time; the rows are information only, not links.
          <SlidePager
            className="mt-2"
            items={planted}
            getKey={(p) => p.id}
            renderItem={(p) => (
              <div className="flex items-center gap-2.5 py-2">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-base leading-none"
                  style={{ backgroundColor: cropTint(p.crop.name) }}
                >
                  {p.crop.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-heading block truncate text-sm font-medium">{p.display_name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {t("card.planted", { date: formatDisplayDate(p.planting_date, dateLocale) })}
                  </span>
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {plantAgeLabel(p.age_days, t)}
                </span>
              </div>
            )}
          />
        )}
      </CardContent>
    </Card>
  );
}

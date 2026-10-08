"use client";

import { useMemo } from "react";

import type { BackendPlant } from "@/lib/api/plants-api";
import { useLanguage } from "@/lib/i18n";

/**
 * How many plants become ready to harvest each month, for the next twelve.
 *
 * A plain bar graph on purpose: one bar per month, the count at its end and
 * the crops' emojis beside it, so it reads at a glance with no tapping or
 * hovering (a phone has no hover). A plant whose window is already open
 * counts in this month.
 *
 * Plants further away than twelve months (tree crops take years) are
 * counted in a line underneath rather than drawn.
 */

const MONTHS_AHEAD = 12;

function parseIso(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

export function HarvestCalendar({
  plants,
  today = new Date(),
}: {
  plants: BackendPlant[];
  /** Injected by tests; the page always renders with the real date. */
  today?: Date;
}) {
  const { t, dateLocale } = useLanguage();

  const { buckets, total, later, max } = useMemo(() => {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const buckets = Array.from({ length: MONTHS_AHEAD }, (_, i) => ({
      month: new Date(first.getFullYear(), first.getMonth() + i, 1),
      plants: [] as BackendPlant[],
    }));

    let later = 0;
    for (const plant of plants) {
      if (plant.status === "HARVESTED" || plant.status === "ARCHIVED") continue;
      const start = parseIso(plant.expected_harvest_start);
      if (parseIso(plant.expected_harvest_end) < today) continue; // window passed
      const index = Math.max(
        0,
        (start.getFullYear() - first.getFullYear()) * 12 + (start.getMonth() - first.getMonth()),
      );
      if (index < MONTHS_AHEAD) buckets[index].plants.push(plant);
      else later += 1;
    }

    const total = buckets.reduce((sum, b) => sum + b.plants.length, 0);
    const max = Math.max(1, ...buckets.map((b) => b.plants.length));
    return { buckets, total, later, max };
    // `today` only varies in tests; the page passes the real date once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plants]);

  const monthLabel = (month: Date, i: number) =>
    month.toLocaleDateString(dateLocale, {
      month: "short",
      // The year only where it changes, so the column stays narrow.
      ...(i === 0 || month.getMonth() === 0 ? { year: "numeric" } : {}),
    });

  return (
    <section
      aria-label={t("calendarChart.title")}
      className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-4 sm:p-5"
    >
      <header>
        <h2 className="font-heading text-base font-medium">{t("calendarChart.title")}</h2>
        <p className="text-muted-foreground text-xs">
          {total === 0
            ? t("calendarChart.summaryNone")
            : total === 1
              ? t("calendarChart.summaryOne")
              : t("calendarChart.summary", { n: total })}
        </p>
      </header>

      <ul className="flex flex-col gap-1.5">
        {buckets.map((bucket, i) => {
          const n = bucket.plants.length;
          return (
            <li
              key={bucket.month.toISOString()}
              className="grid grid-cols-[4.5rem_1fr] items-center gap-2 text-sm"
              aria-label={`${bucket.month.toLocaleDateString(dateLocale, { month: "long", year: "numeric" })}: ${n}`}
            >
              <span className="text-muted-foreground text-xs whitespace-nowrap">
                {monthLabel(bucket.month, i)}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                {n > 0 && (
                  <span
                    aria-hidden="true"
                    className="bg-primary h-5 shrink-0 rounded-r-[4px]"
                    style={{ width: `${(n / max) * 45}%` }}
                  />
                )}
                <span
                  className={
                    n > 0
                      ? "font-heading shrink-0 font-medium tabular-nums"
                      : "text-muted-foreground/60 shrink-0 text-xs tabular-nums"
                  }
                >
                  {n}
                </span>
                {n > 0 && (
                  <span aria-hidden="true" className="truncate text-sm leading-none">
                    {bucket.plants.map((p) => p.crop.emoji).join("")}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {later > 0 && (
        <p className="text-muted-foreground border-border border-t pt-2.5 text-xs">
          {t("calendarChart.later", { n: later })}
        </p>
      )}
    </section>
  );
}

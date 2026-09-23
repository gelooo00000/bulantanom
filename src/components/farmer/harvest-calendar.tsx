"use client";

import { useMemo, useState } from "react";

import { ColumnChart } from "@/components/lgu/dashboard-charts";
import { formatDisplayDate } from "@/components/ui/date-picker";
import type { BackendPlant } from "@/lib/api/plants-api";
import { useLanguage } from "@/lib/i18n";
import { plantTitle } from "@/lib/plant-summary";

/**
 * When this farm's plants become ready, month by month.
 *
 * The cards below answer "what about this plant"; a farmer also needs the
 * other direction — "what am I harvesting in December" — and reading that
 * off a list of dates is exactly the work a chart saves.
 *
 * Twelve months, because past that the answer is a tree crop measured in
 * years (a Cardinal avocado is ready in 2030) and stretching the axis to
 * reach it would squash the months that matter into nothing. Those are
 * counted once, underneath, rather than drawn.
 *
 * Pointing at a month reveals its plants in a fixed-height panel — the same
 * pattern, and the same fixed height, as the LGU charts, so revealing a
 * month cannot resize the page under the pointer.
 */

const MONTHS_AHEAD = 12;

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

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
  const [hovered, setHovered] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const shownIndex = hovered ?? pinned;

  const { buckets, total, later, readyNow, peak } = useMemo(() => {
    const first = startOfMonth(today);
    const buckets = Array.from({ length: MONTHS_AHEAD }, (_, i) => ({
      month: new Date(first.getFullYear(), first.getMonth() + i, 1),
      plants: [] as BackendPlant[],
    }));

    let later = 0;
    let readyNow = 0;
    for (const plant of plants) {
      if (plant.status === "HARVESTED" || plant.status === "ARCHIVED") continue;
      const start = parseIso(plant.expected_harvest_start);
      const end = parseIso(plant.expected_harvest_end);
      if (end < today) continue; // window already passed
      if (start <= today) readyNow += 1;

      // A window already open belongs to this month, not to a past one.
      const due = start < first ? first : startOfMonth(start);
      const index =
        (due.getFullYear() - first.getFullYear()) * 12 + (due.getMonth() - first.getMonth());
      if (index < MONTHS_AHEAD) buckets[index].plants.push(plant);
      else later += 1;
    }

    const total = buckets.reduce((sum, b) => sum + b.plants.length, 0);
    const peak = buckets.reduce(
      (best, b, i) => (b.plants.length > buckets[best].plants.length ? i : best),
      0,
    );
    return { buckets, total, later, readyNow, peak };
    // `today` only varies in tests; the page passes the real date once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plants]);

  const monthLabel = (month: Date, long: boolean) =>
    month.toLocaleDateString(dateLocale, {
      month: long ? "long" : "short",
      ...(long ? { year: "numeric" } : {}),
    });

  const shown = shownIndex !== null ? buckets[shownIndex] : null;
  const count = (n: number) =>
    n === 1 ? t("plants.one") : t("plants.many", { n });

  return (
    <div>
      <h2 className="mb-2 text-sm font-medium">{t("calendarChart.title")}</h2>
      <ColumnChart
        columns={buckets.map((bucket) => ({
          key: bucket.month.toISOString(),
          axisLabel: monthLabel(bucket.month, false),
          title: monthLabel(bucket.month, true),
          tableLabel: monthLabel(bucket.month, true),
          count: bucket.plants.length,
        }))}
        unit={t("calendarChart.unit")}
        tableHeading={t("calendarChart.month")}
        summary={
          total === 0
            ? t("calendarChart.summaryNone")
            : t("calendarChart.summary", {
                n: count(total),
                ready: readyNow,
                later: later > 0 ? t("calendarChart.later", { n: later }) : "",
              })
        }
        name={t("calendarChart.name")}
        labelIndex={total > 0 ? peak : undefined}
        axisEvery={2}
        onHoverIndex={setHovered}
        onSelectIndex={(i) => setPinned((current) => (current === i ? null : i))}
        selectedIndex={pinned}
      />

      {/* Fixed height: a month revealed under the pointer must not move the
          page, or the pointer leaves the column it just entered. */}
      <div className="border-border mt-4 flex h-40 flex-col border-t pt-3" aria-live="polite">
        {shown ? (
          <>
            <p className="mb-2 shrink-0 text-xs font-medium">
              {t("calendarChart.due", {
                month: monthLabel(shown.month, true),
                n: count(shown.plants.length),
              })}
            </p>
            {shown.plants.length === 0 ? (
              <p className="text-muted-foreground text-xs">{t("calendarChart.none")}</p>
            ) : (
              <ul className="-mr-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-2 text-sm">
                {shown.plants.map((plant) => (
                  <li key={plant.id} className="flex items-center gap-2">
                    <span aria-hidden="true">{plant.crop.emoji}</span>
                    <span className="truncate">{plantTitle(plant)}</span>
                    <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                      {formatDisplayDate(plant.expected_harvest_start, dateLocale)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-xs">{t("calendarChart.hint")}</p>
        )}
      </div>

      {later > 0 && (
        <p className="text-muted-foreground/70 mt-2 text-xs">
          {later === 1
            ? t("calendarChart.laterNoteOne")
            : t("calendarChart.laterNote", { n: later })}
        </p>
      )}
    </div>
  );
}

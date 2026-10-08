"use client";

import { useMemo, useState } from "react";

import { formatDisplayDate } from "@/components/ui/date-picker";
import type { BackendPlant } from "@/lib/api/plants-api";
import { cropColor, cropTint } from "@/lib/crop-colors";
import { humanDuration } from "@/lib/duration";
import { useLanguage, type Translate } from "@/lib/i18n";
import { plantTitle } from "@/lib/plant-summary";
import { cn } from "@/lib/utils";

/**
 * When each plant can be harvested, as a timeline.
 *
 * One row per plant, one bar per harvest window, months across the top and
 * a line for today. It replaces a per-month count chart, which answered
 * "how many in December" but hid "which ones" behind a hover — and on a
 * phone there is no hover. Here every row names its plant, so the answer to
 * "what am I harvesting in January" is read straight off the page.
 *
 * The farmer picks how far ahead to look (3, 6 or 12 months). Plants that
 * open later than that — tree crops measured in years — are listed by name
 * and date underneath rather than drawn, since stretching the axis to 2030
 * would squash the months that matter into nothing.
 *
 * Bars wear the crop's own colour, as the plant cards do; the colour is
 * decoration only, since every row is labelled with its emoji and name.
 */

const RANGES = [3, 6, 12] as const;
type Range = (typeof RANGES)[number];
const DAY = 86_400_000;

function parseIso(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** "Ready now", "Tomorrow", "in 11 days", "in about 3 months". */
function whenLabel(start: Date, today: Date, t: Translate): string {
  const days = Math.round((start.getTime() - today.getTime()) / DAY);
  if (days <= 0) return t("timeline.readyNow");
  if (days === 1) return t("timeline.tomorrow");
  return t("timeline.in", { time: humanDuration(days, t) });
}

export function HarvestCalendar({
  plants,
  today: now = new Date(),
}: {
  plants: BackendPlant[];
  /** Injected by tests; the page always renders with the real date. */
  today?: Date;
}) {
  const { t, dateLocale } = useLanguage();
  const [range, setRange] = useState<Range>(6);
  const [openId, setOpenId] = useState<number | null>(null);
  const today = startOfDay(now);

  const { from, to, months, rows, later, readyNow } = useMemo(() => {
    // The axis starts at the first of this month so the gridlines sit on
    // month boundaries, and runs `range` whole months on.
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    const to = new Date(today.getFullYear(), today.getMonth() + range, 1);
    const months = Array.from(
      { length: range },
      (_, i) => new Date(from.getFullYear(), from.getMonth() + i, 1),
    );

    const active = plants
      .filter((p) => p.status !== "HARVESTED" && p.status !== "ARCHIVED")
      .map((p) => ({
        plant: p,
        start: parseIso(p.expected_harvest_start),
        end: parseIso(p.expected_harvest_end),
      }))
      .filter((r) => r.end >= today) // a window that already closed
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    return {
      from,
      to,
      months,
      rows: active.filter((r) => r.start < to),
      later: active.filter((r) => r.start >= to),
      readyNow: active.filter((r) => r.start <= today).length,
    };
    // `today` only varies in tests; the page passes the real date once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plants, range]);

  const span = to.getTime() - from.getTime();
  const pct = (date: Date) =>
    Math.max(0, Math.min(100, ((date.getTime() - from.getTime()) / span) * 100));
  const todayPct = pct(today);
  const date = (d: Date) =>
    d.toLocaleDateString(dateLocale, { month: "short", day: "numeric" });
  const monthShort = (d: Date) => d.toLocaleDateString(dateLocale, { month: "short" });
  // A year label on January, and on the first month, so a range that
  // crosses New Year still reads unambiguously.
  const showYear = (d: Date, i: number) => i === 0 || d.getMonth() === 0;

  return (
    <section
      aria-label={t("timeline.title")}
      className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-4 sm:p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-medium">{t("timeline.title")}</h2>
          <p className="text-muted-foreground text-xs">
            {rows.length === 0
              ? t("timeline.summaryNone", { months: range })
              : t("timeline.summary", { n: rows.length, months: range, ready: readyNow })}
          </p>
        </div>
        <div
          role="group"
          aria-label={t("timeline.rangeLabel")}
          className="bg-muted flex shrink-0 rounded-lg p-0.5"
        >
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                range === r
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("timeline.range", { n: r })}
            </button>
          ))}
        </div>
      </header>

      {rows.length > 0 && (
        // On a phone each plant's name sits above a full-width bar; from
        // `sm` up, names and bars share a row.
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-[minmax(0,13rem)_1fr]">
          {/* Month axis, over the bars only. */}
          <div className="max-sm:hidden" />
          <div className="text-muted-foreground relative h-5 text-[11px]">
            {months.map((m, i) => (
              <span
                key={m.toISOString()}
                className={cn(
                  "absolute bottom-1 pl-1 leading-tight whitespace-nowrap",
                  // Twelve labels do not fit a phone; every other one does.
                  range === 12 && i % 2 === 1 && "max-sm:hidden",
                )}
                style={{ left: `${pct(m)}%` }}
              >
                {monthShort(m)}
                {showYear(m, i) && (
                  <span className="text-muted-foreground/70"> &rsquo;{String(m.getFullYear()).slice(2)}</span>
                )}
              </span>
            ))}
          </div>

          <ul className="col-span-2 flex flex-col">
            {rows.map(({ plant, start, end }) => {
              const open = openId === plant.id;
              const left = pct(start);
              const right = pct(end);
              const clippedEnd = end > to;
              const ready = start <= today;
              return (
                <li key={plant.id} className="border-border/60 border-t first:border-t-0">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : plant.id)}
                    className="hover:bg-muted/40 grid w-full grid-cols-1 items-center gap-x-3 gap-y-1.5 rounded-md py-2 text-left transition-colors sm:grid-cols-[minmax(0,13rem)_1fr]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="flex size-7 shrink-0 items-center justify-center rounded-md text-sm leading-none"
                        style={{ backgroundColor: cropTint(plant.crop.name) }}
                      >
                        {plant.crop.emoji}
                      </span>
                      <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2 sm:block">
                        <span className="block truncate text-sm leading-tight font-medium">
                          {plantTitle(plant)}
                        </span>
                        <span
                          className={cn(
                            "block shrink-0 truncate text-[11px]",
                            ready ? "text-risk-low font-medium" : "text-muted-foreground",
                          )}
                        >
                          {whenLabel(start, today, t)}
                        </span>
                      </span>
                    </span>

                    {/* The track: month gridlines, today, and the window. */}
                    <span className="relative block h-6" aria-hidden="true">
                      {months.slice(1).map((m) => (
                        <span
                          key={m.toISOString()}
                          className="bg-border/70 absolute inset-y-0 w-px"
                          style={{ left: `${pct(m)}%` }}
                        />
                      ))}
                      <span
                        className="bg-primary/60 absolute inset-y-0 w-0.5"
                        style={{ left: `${todayPct}%` }}
                      />
                      <span
                        className={cn(
                          "absolute top-1/2 h-2.5 -translate-y-1/2 rounded-l-[4px]",
                          !clippedEnd && "rounded-r-[4px]",
                          open && "ring-foreground/30 ring-2",
                        )}
                        style={{
                          left: `${left}%`,
                          // A window of a few days still shows as a mark.
                          width: `max(6px, ${right - left}%)`,
                          backgroundColor: cropColor(plant.crop.name),
                          // Fades out where the window carries on past the range.
                          ...(clippedEnd && {
                            maskImage: "linear-gradient(to right, black 70%, transparent)",
                          }),
                        }}
                      />
                    </span>
                  </button>

                  {open && (
                    <p className="text-muted-foreground pb-2 pl-9 text-xs">
                      {t("timeline.window", {
                        from: formatDisplayDate(plant.expected_harvest_start, dateLocale),
                        to: formatDisplayDate(plant.expected_harvest_end, dateLocale),
                        time: humanDuration(
                          Math.round((end.getTime() - start.getTime()) / DAY),
                          t,
                        ),
                      })}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
          <span aria-hidden="true" className="bg-primary/60 inline-block h-3 w-0.5" />
          {t("timeline.todayKey", { date: date(today) })}
          <span aria-hidden="true">·</span>
          {t("timeline.hint")}
        </p>
      )}

      {later.length > 0 && (
        <div className="border-border border-t pt-3">
          <p className="text-muted-foreground mb-2 text-xs">
            {t("timeline.later", { n: later.length, months: range })}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {later.map(({ plant, start }) => (
              <li
                key={plant.id}
                className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs"
                style={{ borderColor: cropTint(plant.crop.name, 45) }}
              >
                <span aria-hidden="true">{plant.crop.emoji}</span>
                <span className="font-medium">{plantTitle(plant)}</span>
                <span className="text-muted-foreground">
                  {start.toLocaleDateString(dateLocale, { month: "short", year: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useLanguage, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6].map((day) => `weekday.${day}` as MessageKey);
// How far ahead of the current month the calendar can be browsed.
const BROWSE_AHEAD_MONTHS = 12;
const MONTHS = Array.from({ length: 12 }, (_, month) => `month.${month}` as MessageKey);

/** Local-time YYYY-MM-DD — avoids the UTC shift `toISOString()` introduces. */
function toIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  // Rejects impossible dates like 2026-02-31, which would otherwise roll over.
  if (
    date.getFullYear() !== Number(y) ||
    date.getMonth() !== Number(m) - 1 ||
    date.getDate() !== Number(d)
  ) {
    return null;
  }
  return date;
}

/** `locale` comes from `useLanguage().dateLocale` on translated screens. */
export function formatDisplayDate(value: string, locale = "en-PH"): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Short form for chart axes, where a full "February 14, 2026" would collide
 * with its neighbour. The full date is still what tooltips and tables show.
 */
export function formatShortDate(value: string, locale = "en-PH"): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

type DatePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** ISO date; days after this are disabled. */
  max?: string;
  placeholder?: string;
  /**
   * Shows "Sep 19" instead of "September 19, 2026". For a trigger sitting in
   * a card header, where the full date wraps to two lines and pushes the
   * heading around.
   */
  compact?: boolean;
  /**
   * Which edge of the trigger the calendar lines up with. "start" (the
   * default) opens it rightwards from the trigger's left edge; "end" opens
   * it leftwards from the right edge — for a trigger at the right of a card,
   * where opening rightwards pushes the calendar off the card and the screen
   * (and the page shifts sideways to make room).
   */
  align?: "start" | "end";
};

export function DatePicker({
  id,
  value,
  onChange,
  max,
  placeholder,
  compact = false,
  align = "start",
}: DatePickerProps) {
  const { t, dateLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value);
  const maxDate = max ? parseIsoDate(max) : null;
  const [viewDate, setViewDate] = useState(() => selected ?? new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // The calendar never goes back before the current month: it opens on this
  // month at the earliest, and "Previous", the month list and the year list
  // all stop there. Worked out from today's date on every render, so the
  // limit moves forward on its own when the month changes.
  const today = new Date();
  const earliest = new Date(today.getFullYear(), today.getMonth(), 1);
  // Browsing forward is allowed for a year — September on to January and
  // beyond. `max` does not stop the browsing; it only greys out the days
  // after it.
  const latest = new Date(earliest.getFullYear(), earliest.getMonth() + BROWSE_AHEAD_MONTHS, 1);

  /** Any month, pulled back inside earliest..latest. */
  function clampMonth(date: Date): Date {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    if (first < earliest) return earliest;
    if (first > latest) return latest;
    return first;
  }

  const shownMonth = clampMonth(viewDate);
  const canGoBack = shownMonth > earliest;
  const canGoForward = shownMonth < latest;
  const shownYear = shownMonth.getFullYear();
  const shownMonthIndex = shownMonth.getMonth();

  // At most 42 cells, so it is simply built each render.
  const firstWeekday = new Date(shownYear, shownMonthIndex, 1).getDay();
  const daysInMonth = new Date(shownYear, shownMonthIndex + 1, 0).getDate();
  const grid: (Date | null)[] = Array(firstWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    grid.push(new Date(shownYear, shownMonthIndex, day));
  }

  const years = Array.from(
    { length: latest.getFullYear() - earliest.getFullYear() + 1 },
    (_, i) => earliest.getFullYear() + i,
  );

  function monthOutOfRange(month: number): boolean {
    const first = new Date(shownMonth.getFullYear(), month, 1);
    return first < earliest || first > latest;
  }

  // The first day that can be picked is today: tomorrow, today's date greys
  // out on its own. Days after `max`, when a caller passes one, are also out.
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  function isDisabled(date: Date) {
    if (date < startOfToday) return true;
    return maxDate ? date > maxDate : false;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "border-border bg-background focus-visible:border-ring focus-visible:ring-ring/50",
          "flex h-9 w-full items-center gap-2 rounded-lg border px-3 text-left text-sm",
          "outline-none transition-colors focus-visible:ring-3",
        )}
      >
        <CalendarDays className="text-muted-foreground size-4 shrink-0" />
        <span className={cn("truncate", !value && "text-muted-foreground")}>
          {value
            ? compact
              ? formatShortDate(value, dateLocale)
              : formatDisplayDate(value, dateLocale)
            : (placeholder ?? t("calendar.placeholder"))}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t("calendar.dialog")}
          className={cn(
            "border-border bg-popover absolute z-50 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] rounded-xl border p-3 shadow-lg",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={t("calendar.previous")}
              disabled={!canGoBack}
              onClick={() => setViewDate(clampMonth(new Date(shownYear, shownMonthIndex - 1, 1)))}
              className="hover:bg-accent text-muted-foreground hover:text-foreground rounded-md p-1.5 disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>

            <select
              aria-label={t("calendar.month")}
              value={shownMonthIndex}
              onChange={(e) => setViewDate(clampMonth(new Date(shownYear, Number(e.target.value), 1)))}
              className="border-border bg-background flex-1 rounded-md border px-2 py-1 text-sm outline-none"
            >
              {/* Only the months that can be shown: in the current year that
                  starts at this month, so earlier ones are not listed at all. */}
              {MONTHS.map((label, index) =>
                monthOutOfRange(index) ? null : (
                  <option key={label} value={index}>
                    {t(label)}
                  </option>
                ),
              )}
            </select>

            <select
              aria-label={t("calendar.year")}
              value={shownYear}
              onChange={(e) =>
                // A month that does not exist in the new year's range (e.g.
                // July of the current year) is pulled back inside it.
                setViewDate(clampMonth(new Date(Number(e.target.value), shownMonthIndex, 1)))
              }
              className="border-border bg-background rounded-md border px-2 py-1 text-sm outline-none"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            <button
              type="button"
              aria-label={t("calendar.next")}
              disabled={!canGoForward}
              onClick={() => setViewDate(clampMonth(new Date(shownYear, shownMonthIndex + 1, 1)))}
              className="hover:bg-accent text-muted-foreground hover:text-foreground rounded-md p-1.5 disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="text-muted-foreground py-1 text-center text-[11px] font-medium"
              >
                {t(day)}
              </div>
            ))}
            {grid.map((date, index) => {
              if (!date) return <div key={`empty-${index}`} />;
              const iso = toIsoDate(date);
              const isSelected = iso === value;
              const disabled = isDisabled(date);
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-md py-1.5 text-sm transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground font-medium"
                      : "hover:bg-accent",
                    disabled && "text-muted-foreground/40 cursor-not-allowed hover:bg-transparent",
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              onChange(toIsoDate(new Date()));
              setOpen(false);
            }}
            className="text-primary mt-2 w-full rounded-md py-1.5 text-sm hover:underline"
          >
            {t("common.today")}
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

export function formatDisplayDate(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type DatePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** ISO date; days after this are disabled. */
  max?: string;
  placeholder?: string;
};

export function DatePicker({
  id,
  value,
  onChange,
  max,
  placeholder = "Select a date",
}: DatePickerProps) {
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

  const grid = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = Array(firstWeekday).fill(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(year, month, day));
    }
    return cells;
  }, [viewDate]);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 30 }, (_, i) => current - i);
  }, []);

  function isDisabled(date: Date) {
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
        <span className={cn(!value && "text-muted-foreground")}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose planting date"
          className="border-border bg-popover absolute z-50 mt-2 w-[19rem] rounded-xl border p-3 shadow-lg"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() =>
                setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
              }
              className="hover:bg-accent text-muted-foreground hover:text-foreground rounded-md p-1.5"
            >
              <ChevronLeft className="size-4" />
            </button>

            <select
              aria-label="Month"
              value={viewDate.getMonth()}
              onChange={(e) =>
                setViewDate(new Date(viewDate.getFullYear(), Number(e.target.value), 1))
              }
              className="border-border bg-background flex-1 rounded-md border px-2 py-1 text-sm outline-none"
            >
              {MONTHS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>

            <select
              aria-label="Year"
              value={viewDate.getFullYear()}
              onChange={(e) =>
                setViewDate(new Date(Number(e.target.value), viewDate.getMonth(), 1))
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
              aria-label="Next month"
              onClick={() =>
                setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
              }
              className="hover:bg-accent text-muted-foreground hover:text-foreground rounded-md p-1.5"
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
                {day}
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
            Today
          </button>
        </div>
      )}
    </div>
  );
}

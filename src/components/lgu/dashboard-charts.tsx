"use client";

import type { ElementType } from "react";
import { useEffect, useRef, useState } from "react";

import { formatDisplayDate, formatShortDate } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";

/**
 * Charts for the LGU dashboard, drawn as plain HTML and SVG like the rest of
 * the app's charts rather than through a chart library.
 *
 * Every chart here is a bar chart on purpose. The risk levels use the app's
 * red / amber / green status colours, and amber against green is nearly
 * indistinguishable to a colour-blind reader — as touching pie slices they
 * would have to be told apart by colour alone. As labelled bars, each row
 * names itself (with an icon) and the colour only reinforces it.
 */

export type BarRow = {
  key: string;
  label: string;
  value: number;
  /** A CSS colour, usually a theme token such as `var(--risk-high)`. */
  color: string;
  icon?: ElementType;
  /** Shown before the label in place of an icon — a crop's emoji. */
  emoji?: string;
};

/**
 * Horizontal bars sharing one scale, each with its label and value always
 * visible, so the chart doubles as its own table.
 */
export function HorizontalBars({
  rows,
  unit,
  label,
  onSelect,
  selectedKey,
  onHoverKey,
}: {
  rows: BarRow[];
  /** Singular noun for the tooltip, e.g. "plant". */
  unit: string;
  /** Accessible name for the whole chart. */
  label: string;
  /** Makes each row a toggle button, e.g. to filter a list by that row. */
  onSelect?: (key: string) => void;
  /** The row currently selected through `onSelect`, if any. */
  selectedKey?: string | null;
  /** Called with a row key as the pointer or focus enters it, null as it leaves. */
  onHoverKey?: (key: string | null) => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  // Never divide by zero; an all-zero chart keeps its labels and empty tracks.
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <ul aria-label={label} className="flex flex-col gap-2.5">
      {rows.map((row) => {
        const share = total > 0 ? Math.round((row.value / total) * 100) : 0;
        const isActive = active === row.key || selectedKey === row.key;
        const dimmed = (active || selectedKey) && !isActive;
        const name = `${row.label}: ${row.value} ${plural(unit, row.value)}, ${share}%`;
        const hover = {
          onMouseEnter: () => {
            setActive(row.key);
            onHoverKey?.(row.key);
          },
          onMouseLeave: () => {
            setActive(null);
            onHoverKey?.(null);
          },
          onFocus: () => {
            setActive(row.key);
            onHoverKey?.(row.key);
          },
          onBlur: () => {
            setActive(null);
            onHoverKey?.(null);
          },
        };
        const content = (
          <>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-1.5">
                {row.icon && (
                  <row.icon
                    className="size-3.5 shrink-0"
                    style={{ color: row.color }}
                    aria-hidden="true"
                  />
                )}
                {row.emoji && (
                  <span aria-hidden="true" className="text-sm">
                    {row.emoji}
                  </span>
                )}
                <span className="truncate">{row.label}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {row.value}
                <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                  {share}%
                </span>
              </span>
            </div>
            {/* Track then bar. A zero stays a zero-width bar, never a sliver. */}
            <div className="bg-muted mt-1 h-2.5 overflow-hidden rounded-r-[4px]">
              <div
                className={cn(
                  "h-full rounded-r-[4px] transition-[width,opacity] duration-300",
                  dimmed && "opacity-60",
                )}
                style={{
                  width: `${(row.value / max) * 100}%`,
                  backgroundColor: row.color,
                }}
              />
            </div>
          </>
        );
        const ring =
          "focus-visible:ring-ring/50 relative rounded-md outline-none focus-visible:ring-3";

        return onSelect ? (
          <li key={row.key}>
            <button
              type="button"
              {...hover}
              onClick={() => onSelect(row.key)}
              aria-pressed={selectedKey === row.key}
              aria-label={name}
              className={cn(ring, "hover:bg-accent/40 -mx-1 block w-[calc(100%+0.5rem)] px-1 py-0.5 text-left")}
            >
              {content}
            </button>
          </li>
        ) : (
          // Keyboard users reach the same detail a pointer gets on hover.
          <li key={row.key} tabIndex={0} {...hover} className={ring} aria-label={name}>
            {content}
          </li>
        );
      })}
    </ul>
  );
}

export type WeekCount = { week_start: string; count: number };

const VIEW_W = 320;
const VIEW_H = 120;
const PAD_TOP = 18;
const PAD_BOTTOM = 18;
const BAR_W = 22;

/**
 * Assessments submitted per week. One series, so one hue and no legend — the
 * card title names it. Empty weeks stay on the axis as gaps above the
 * baseline: a lapse in monitoring is what an Officer is looking for.
 */
export function WeeklyColumns({ weeks }: { weeks: WeekCount[] }) {
  if (weeks.length === 0) return null;

  const total = weeks.reduce((sum, w) => sum + w.count, 0);
  const latest = weeks[weeks.length - 1];

  return (
    <ColumnChart
      columns={weeks.map((week) => ({
        key: week.week_start,
        axisLabel: formatShortDate(week.week_start),
        title: `Week of ${formatDisplayDate(week.week_start)}`,
        tableLabel: formatDisplayDate(week.week_start),
        count: week.count,
      }))}
      unit="assessment"
      tableHeading="Week of"
      summary={
        total === 0
          ? `No assessments in the last ${weeks.length} weeks.`
          : `${total} assessment${total === 1 ? "" : "s"} in the last ${weeks.length} weeks · ${latest.count} this week.`
      }
      name={`Assessments per week, ${weeks.length} weeks. ${total} in total, ${latest.count} this week.`}
      labelIndex={weeks.length - 1}
      axisEvery={2}
    />
  );
}

export type Column = {
  key: string;
  /** Short label under the column, e.g. "Sep 14" or "Oct". */
  axisLabel: string;
  /** Tooltip heading, e.g. "Week of September 14, 2026". */
  title: string;
  /** First cell of the numbers table. */
  tableLabel: string;
  count: number;
};

/**
 * Vertical columns for one series over time. One hue and no legend — the
 * card title names the series. Zero stays a gap above the baseline.
 */
export function ColumnChart({
  columns,
  unit,
  summary,
  name,
  tableHeading,
  labelIndex,
  axisEvery = 1,
  onHoverIndex,
  onSelectIndex,
  selectedIndex = null,
}: {
  columns: Column[];
  /** Singular noun, e.g. "assessment". */
  unit: string;
  /** The sentence above the chart that states the takeaway. */
  summary: string;
  /** Accessible description of the whole chart. */
  name: string;
  tableHeading: string;
  /** The one column that carries its value as a direct label. */
  labelIndex?: number;
  /** Label every Nth column on the axis (the last is always labelled). */
  axisEvery?: number;
  /** Called with a column's index as the pointer or focus enters it, null as it leaves. */
  onHoverIndex?: (index: number | null) => void;
  /** Makes each column a toggle, e.g. to keep its details open. */
  onSelectIndex?: (index: number) => void;
  /** The column currently selected through `onSelectIndex`, if any. */
  selectedIndex?: number | null;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  // The drawing is sized to the real pixel width of its card, so the chart
  // keeps one height and its text stays true to size whether the card is
  // half the page, the full page, or a phone screen.
  const [viewW, setViewW] = useState(VIEW_W);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      if (width > 0) setViewW(width);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  if (columns.length === 0) return null;

  const peak = Math.max(...columns.map((c) => c.count), 1);
  const slot = viewW / columns.length;
  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const baseline = VIEW_H - PAD_BOTTOM;
  const barW = Math.min(BAR_W, slot * 0.6);
  const shown = active;
  // A selected column stays highlighted after the pointer leaves it.
  const focused = active ?? selectedIndex;

  const enter = (i: number) => {
    setActive(i);
    onHoverIndex?.(i);
  };
  const leave = () => {
    setActive(null);
    onHoverIndex?.(null);
  };

  return (
    <div>
      <p className="text-muted-foreground text-sm">{summary}</p>

      <div ref={boxRef} className="relative mt-3">
        <svg
          viewBox={`0 0 ${viewW} ${VIEW_H}`}
          className="h-auto w-full overflow-visible"
          role="img"
          aria-label={name}
        >
          <line
            x1={0}
            x2={viewW}
            y1={baseline}
            y2={baseline}
            stroke="var(--border)"
            strokeWidth={1}
          />
          {columns.map((column, i) => {
            const h = (column.count / peak) * plotH;
            const x = i * slot + (slot - barW) / 2;
            const y = baseline - h;
            const isLast = i === columns.length - 1;
            // Rounded data-end, square at the baseline.
            const r = Math.min(4, h);
            const path =
              h === 0
                ? ""
                : `M${x},${baseline} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${baseline} Z`;
            const showAxis =
              isLast || (columns.length - 1 - i) % axisEvery === 0;
            return (
              <g
                key={column.key}
                onMouseEnter={() => enter(i)}
                onMouseLeave={leave}
                {...(onSelectIndex && {
                  role: "button",
                  tabIndex: 0,
                  "aria-pressed": selectedIndex === i,
                  "aria-label": `${column.title}: ${column.count} ${plural(unit, column.count)}`,
                  onClick: () => onSelectIndex(i),
                  onFocus: () => enter(i),
                  onBlur: leave,
                  onKeyDown: (event: React.KeyboardEvent) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectIndex(i);
                    }
                  },
                  className: "cursor-pointer outline-none focus-visible:[&>rect:first-child]:fill-[var(--accent)]",
                })}
              >
                {/* A hit target the full height of the slot, bigger than the bar. */}
                <rect x={i * slot} y={0} width={slot} height={VIEW_H} fill="transparent" />
                {path && (
                  <path
                    d={path}
                    fill="var(--primary)"
                    opacity={focused !== null && focused !== i ? 0.45 : 1}
                  />
                )}
                {/* One direct label; the rest are on hover or in the table. */}
                {i === labelIndex && shown === null && (
                  <text
                    x={x + barW / 2}
                    y={y - 5}
                    textAnchor="middle"
                    className="fill-foreground text-[10px] font-medium"
                  >
                    {column.count}
                  </text>
                )}
                {showAxis && (
                  <text
                    x={i * slot + slot / 2}
                    y={VIEW_H - 4}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[9px]"
                  >
                    {column.axisLabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {shown !== null && (
          <div
            role="status"
            className="bg-popover border-border pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg whitespace-nowrap border px-2.5 py-1.5 text-xs shadow-md"
            style={{
              left: `${((shown * slot + slot / 2) / viewW) * 100}%`,
            }}
          >
            <p className="text-muted-foreground">{columns[shown].title}</p>
            <p className="font-medium tabular-nums">
              {columns[shown].count} {plural(unit, columns[shown].count)}
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowTable((v) => !v)}
        className="text-muted-foreground mt-2 text-xs underline underline-offset-2"
        aria-expanded={showTable}
      >
        {showTable ? "Hide numbers" : "Show numbers"}
      </button>
      {showTable && (
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="text-muted-foreground text-left">
              <th className="py-1 font-normal">{tableHeading}</th>
              <th className="py-1 text-right font-normal capitalize">{plural(unit, 2)}</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((column) => (
              <tr key={column.key} className="border-border/60 border-t">
                <td className="py-1">{column.tableLabel}</td>
                <td className="py-1 text-right tabular-nums">{column.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function plural(noun: string, count: number): string {
  return count === 1 ? noun : `${noun}s`;
}

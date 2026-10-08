"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useMemo, useRef } from "react";

import { useResolvedColors } from "@/components/lgu/risk-pie";

// ApexCharts touches `window` on import, so it only loads in the browser.
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export type Series = { name: string; data: number[]; color: string; type?: "column" | "line" | "area" | "bar" };

/**
 * Bar, column, line and area charts in the app's theme. Colours are theme
 * tokens (var(--primary) ...), resolved to real colours and re-resolved when
 * Light / Dark changes.
 */
export function AnalyticsChart({
  type,
  series,
  categories,
  height = 280,
  horizontal = false,
  stacked = false,
  unit,
  label,
}: {
  type: "bar" | "line" | "area";
  series: Series[];
  categories: string[];
  height?: number;
  horizontal?: boolean;
  stacked?: boolean;
  /** Singular noun for tooltips, e.g. "harvest". */
  unit: string;
  /** Accessible name of the chart. */
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const colors = useResolvedColors(ref, series.map((s) => s.color));

  const options = useMemo<ApexOptions | null>(() => {
    if (!colors) return null;
    const grid = colors.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
    return {
      chart: {
        fontFamily: "inherit",
        background: "transparent",
        toolbar: { show: false },
        zoom: { enabled: false },
        stacked,
        animations: { speed: 300 },
        foreColor: colors.muted,
      },
      theme: { mode: colors.dark ? "dark" : "light" },
      colors: series.map((_, i) => colors[i]),
      plotOptions: { bar: { horizontal, borderRadius: 4, columnWidth: "55%", barHeight: "62%" } },
      dataLabels: { enabled: false },
      stroke: { width: type === "bar" ? 0 : 2.5, curve: "monotoneCubic" },
      fill: type === "area" ? { type: "gradient", gradient: { opacityFrom: 0.35, opacityTo: 0.02 } } : { opacity: 1 },
      grid: { borderColor: grid, strokeDashArray: 4 },
      // Counts are whole numbers: the value axis shows integers only. On a
      // horizontal bar that is the x axis; the y axis then holds the names.
      xaxis: {
        categories,
        labels: {
          style: { fontSize: "11px" },
          trim: true,
          hideOverlappingLabels: true,
          ...(horizontal ? { formatter: (v: string) => (Number.isInteger(Number(v)) ? String(v) : "") } : {}),
        },
        axisBorder: { color: grid },
        axisTicks: { color: grid },
      },
      yaxis: horizontal
        ? { labels: { maxWidth: 180, style: { fontSize: "12px" } } }
        : { labels: { formatter: (v: number) => (Number.isInteger(v) ? String(v) : "") } },
      legend: { position: "top", horizontalAlign: "left", fontSize: "12px", labels: { colors: colors.text }, markers: { size: 5 } },
      tooltip: {
        theme: colors.dark ? "dark" : "light",
        y: { formatter: (v: number) => `${v} ${v === 1 ? unit : `${unit}s`}` },
      },
      states: { active: { filter: { type: "none" } } },
    };
  }, [colors, series, categories, horizontal, stacked, type, unit]);

  return (
    <div ref={ref} role="img" aria-label={label} className="-mx-2 min-w-0">
      {options ? (
        <Chart
          type={type}
          height={height}
          options={options}
          series={series.map((s) => ({ name: s.name, data: s.data, ...(s.type ? { type: s.type } : {}) }))}
        />
      ) : (
        <div style={{ height }} />
      )}
    </div>
  );
}

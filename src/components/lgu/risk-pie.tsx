"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

import type { BarRow } from "@/components/lgu/dashboard-charts";

// ApexCharts touches `window` on import, so it can only load in the browser.
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

/**
 * The plant-risk share as a donut, drawn by ApexCharts.
 *
 * It is always shown beside the labelled risk bars, never on its own: the
 * status colours (amber against green especially) are too close for a
 * colour-blind reader to tell slices apart, so the bars carry each level's
 * name and count and the donut shows the overall share at a glance.
 */
export function RiskPie({ rows }: { rows: BarRow[] }) {
  return <DonutChart rows={rows} unit="plant" name="Plant risk share" />;
}

/**
 * A share-of-the-whole donut with the total in its centre. Pair it with
 * labelled rows (HorizontalBars) so no slice is identified by colour alone.
 */
export function DonutChart({
  rows,
  unit,
  name,
  onHoverKey,
  onSelectKey,
}: {
  rows: BarRow[];
  /** Singular noun for the centre label and tooltip, e.g. "plant". */
  unit: string;
  /** Accessible name, e.g. "Crop type share". */
  name: string;
  /** Called with a slice's row key as the pointer enters it, null as it leaves. */
  onHoverKey?: (key: string | null) => void;
  /** Called with a slice's row key when it is clicked. */
  onSelectKey?: (key: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const colors = useResolvedColors(
    ref,
    rows.map((row) => row.color),
  );
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  // The latest callbacks, read by the chart's event handlers. Keeping them
  // out of `options` keeps `options` stable, so a parent re-rendering on
  // hover does not redraw the chart — a redraw would fire a fresh
  // mouse-leave and make the hover flicker.
  const hoverRef = useRef(onHoverKey);
  const selectRef = useRef(onSelectKey);
  useEffect(() => {
    hoverRef.current = onHoverKey;
    selectRef.current = onSelectKey;
  });

  const options = useMemo<ApexOptions>(() => {
    const plural = (n: number) => (n === 1 ? unit : `${unit}s`);
    const keyAt = (index: number) => rows[index]?.key ?? null;
    return {
      chart: {
        fontFamily: "inherit",
        background: "transparent",
        animations: { speed: 300 },
        events: {
          dataPointMouseEnter: (_e, _ctx, opts) =>
            hoverRef.current?.(keyAt(opts?.dataPointIndex ?? -1)),
          dataPointMouseLeave: () => hoverRef.current?.(null),
          dataPointSelection: (_e, _ctx, opts) => {
            const key = keyAt(opts?.dataPointIndex ?? -1);
            if (key) selectRef.current?.(key);
          },
        },
      },
      // Selection is shown in the labelled rows beside the donut, not by
      // ApexCharts' own click state, which the rows could not keep in sync.
      states: {
        hover: { filter: { type: "darken" } },
        active: { filter: { type: "none" } },
      },
      labels: rows.map((row) => row.label),
      colors: colors ?? undefined,
      legend: { show: false },
      dataLabels: { enabled: false },
      // The surface-coloured gap between slices, so touching slices stay apart.
      stroke: { width: 2, colors: [colors?.surface ?? "transparent"] },
      tooltip: {
        theme: colors?.dark ? "dark" : "light",
        y: {
          formatter: (value: number) =>
            `${value} ${plural(value)} · ${Math.round((value / total) * 100)}%`,
        },
      },
      plotOptions: {
        pie: {
          expandOnClick: false,
          donut: {
            size: "68%",
            labels: {
              show: true,
              name: {
                show: true,
                fontSize: "11px",
                color: colors?.muted,
                offsetY: 16,
              },
              value: {
                show: true,
                fontSize: "22px",
                fontWeight: 500,
                color: colors?.text,
                offsetY: -12,
              },
              total: {
                show: true,
                showAlways: true,
                label: plural(total),
                fontSize: "11px",
                color: colors?.muted,
                formatter: () => String(total),
              },
            },
          },
        },
      },
    };
  }, [rows, colors, total, unit]);

  if (total === 0) {
    return (
      <div className="text-muted-foreground flex aspect-square items-center justify-center text-center text-sm">
        No {unit}s to chart yet.
      </div>
    );
  }

  return (
    <div
      ref={ref}
      role="img"
      aria-label={`${name}: ${rows
        .map((row) => `${row.label} ${row.value}`)
        .join(", ")}.`}
      className="mx-auto w-full max-w-[200px]"
    >
      {colors && (
        <Chart
          type="donut"
          series={rows.map((row) => row.value)}
          options={options}
          height={200}
        />
      )}
    </div>
  );
}

type ResolvedColors = string[] & {
  surface: string;
  text: string;
  muted: string;
  dark: boolean;
};

/**
 * ApexCharts paints SVG attributes and does its own colour maths, so it
 * cannot take the theme's `var(--risk-high)` tokens. They are resolved to
 * plain rgb() here, and again whenever the page switches light/dark.
 */
function useResolvedColors(
  ref: React.RefObject<HTMLDivElement | null>,
  tokens: string[],
): ResolvedColors | null {
  const [colors, setColors] = useState<ResolvedColors | null>(null);
  const key = tokens.join("|");

  useEffect(() => {
    const resolve = () => {
      const el = ref.current ?? document.body;
      const style = getComputedStyle(el);
      const read = (token: string) => {
        const name = token.match(/var\((--[^)]+)\)/)?.[1];
        return toRgb(name ? style.getPropertyValue(name).trim() : token);
      };
      const list = key.split("|").map(read) as ResolvedColors;
      list.surface = read("var(--card)");
      list.text = read("var(--foreground)");
      list.muted = read("var(--muted-foreground)");
      list.dark = Boolean(el.closest(".dark"));
      setColors(list);
    };

    resolve();
    // The theme is a `.dark` class on an ancestor; re-resolve only when it
    // actually flips. ApexCharts rewrites classes on its own SVG as it is
    // hovered, and redrawing on each of those would make the chart flicker.
    let wasDark = Boolean((ref.current ?? document.body).closest(".dark"));
    const observer = new MutationObserver(() => {
      const isDark = Boolean((ref.current ?? document.body).closest(".dark"));
      if (isDark === wasDark) return;
      wasDark = isDark;
      resolve();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
      subtree: true,
    });
    return () => observer.disconnect();
  }, [ref, key]);

  return colors;
}

/** Any CSS colour (including oklch) to rgb(), via a one-pixel canvas. */
function toRgb(css: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx || !css) return css;
  ctx.fillStyle = "#000";
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

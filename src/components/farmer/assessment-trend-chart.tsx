"use client";

import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { formatDisplayDate, formatShortDate } from "@/components/ui/date-picker";
import type { AssessmentTrend } from "@/lib/api/dashboard-api";
import { useLanguage } from "@/lib/i18n";

/**
 * How often this farmer has been assessing, over the last month.
 *
 * Counts come from Django, which returns every day in the range including
 * the zeroes. That matters: a line drawn only through the days that had an
 * assessment would compress a quiet fortnight into one short segment and
 * flatter the farmer's habit. The flat stretches are the honest part of
 * this chart.
 *
 * A single hue, because this is one series measuring magnitude over time —
 * there is no second category to tell apart, so no legend is needed and the
 * title names what the line is.
 */

const VIEW_W = 300;
const VIEW_H = 80;
const PAD_TOP = 6;
// Keeps the first and last marker fully inside the card rather than half
// hanging off the edge.
const PAD_X = 4;

type AssessmentTrendChartProps = {
  trend: AssessmentTrend;
};

export function AssessmentTrendChart({ trend }: AssessmentTrendChartProps) {
  const [showTable, setShowTable] = useState(false);
  const { t, dateLocale } = useLanguage();

  const days = trend.days ?? [];
  if (days.length === 0) return null;

  // Never divide by zero, and keep a flat line of zeroes sitting on the
  // baseline rather than halfway up the box.
  const peak = Math.max(trend.busiest_count, 1);
  const plotW = VIEW_W - PAD_X * 2;
  const stepX = days.length > 1 ? plotW / (days.length - 1) : plotW;
  const y = (count: number) =>
    VIEW_H - PAD_TOP - (count / peak) * (VIEW_H - PAD_TOP * 2);

  const points = days.map((d, i) => ({ ...d, x: PAD_X + i * stepX, y: y(d.count) }));
  const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} ${VIEW_W - PAD_X},${VIEW_H} ${PAD_X},${VIEW_H}`;

  const active = points.filter((p) => p.count > 0);
  const first = days[0];
  const last = days[days.length - 1];

  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium">{t("trend.title")}</h2>
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="text-muted-foreground hover:text-foreground shrink-0 text-xs underline underline-offset-2"
            aria-expanded={showTable}
          >
            {showTable ? t("trend.showChart") : t("trend.showNumbers")}
          </button>
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {trend.total === 0
            ? t("trend.none", { days: trend.range_days })
            : trend.total === 1
              ? t("trend.one", { days: trend.range_days })
              : t("trend.many", { n: trend.total, days: trend.range_days })}
        </p>

        {showTable ? (
          <div className="mt-3 max-h-56 overflow-y-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t("trend.caption")}</caption>
              <thead className="bg-card sticky top-0">
                <tr className="text-muted-foreground text-left text-xs">
                  <th scope="col" className="pb-1 font-medium">
                    {t("trend.date")}
                  </th>
                  <th scope="col" className="pb-1 text-right font-medium">
                    {t("trend.count")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Only the days with activity — thirty rows of zero is a
                    worse answer than the chart it is standing in for. */}
                {active.length > 0 ? (
                  active.map((d) => (
                    <tr key={d.date} className="border-border/60 border-t">
                      <td className="py-1.5">{formatDisplayDate(d.date, dateLocale)}</td>
                      <td className="py-1.5 text-right tabular-nums">{d.count}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-border/60 border-t">
                    <td colSpan={2} className="text-muted-foreground py-2">
                      {t("trend.emptyPeriod")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            {/* The line is drawn in SVG stretched to the card width, but the
                markers are HTML: `preserveAspectRatio="none"` scales x and y
                differently, which turns an SVG circle into an oval at any
                width but this one. Positioning them as elements keeps them
                round wherever the card lands. */}
            <div
              className="relative mt-3 h-20"
              role="img"
              aria-label={
                trend.total === 0
                  ? t("trend.none", { days: trend.range_days })
                  : t("trend.chartLabel", {
                      n: trend.total,
                      days: trend.range_days,
                      peak: trend.busiest_count,
                    })
              }
            >
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              className="absolute inset-0 h-full w-full"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--landing-accent)"
                    stopOpacity="0.28"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--landing-accent)"
                    stopOpacity="0"
                  />
                </linearGradient>
              </defs>

              {/* Recessive baseline, so "zero" is readable as a level. */}
              <line
                x1="0"
                y1={VIEW_H - PAD_TOP}
                x2={VIEW_W}
                y2={VIEW_H - PAD_TOP}
                stroke="var(--border)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <polygon points={area} fill="url(#trendFill)" />
              <polyline
                points={line}
                fill="none"
                stroke="var(--landing-accent)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* A marker on every point would be a number on every day.
                Only the days something happened get one. */}
            {active.map((p) => (
              <span
                key={p.date}
                className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  left: `${(p.x / VIEW_W) * 100}%`,
                  top: `${(p.y / VIEW_H) * 100}%`,
                  background: "var(--landing-accent)",
                }}
                title={`${formatShortDate(p.date, dateLocale)}: ${p.count}`}
              />
            ))}
            </div>

            <div className="text-muted-foreground mt-1 flex justify-between text-[11px]">
              <span>{formatShortDate(first.date, dateLocale)}</span>
              <span>{t("trend.peak", { n: trend.busiest_count })}</span>
              <span>{formatShortDate(last.date, dateLocale)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

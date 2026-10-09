"use client";

import { CircleHelp, Leaf, OctagonAlert, TriangleAlert } from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { useMemo, useState } from "react";

import { CROP_PAGE_SIZE, HorizontalBars, type BarRow } from "@/components/lgu/dashboard-charts";
import { DonutChart } from "@/components/lgu/risk-pie";
import { Card, CardContent } from "@/components/ui/card";
import type { LguPlant } from "@/lib/api/lgu-api";
import {
  cropCounts,
  riskKey,
  riskTally,
  type RiskKey,
  type RiskTally,
} from "@/lib/lgu-plant-stats";
import { cn } from "@/lib/utils";

/**
 * The body of the LGU Risk overview: how healthy the plants are overall,
 * and which crops sit at each risk level.
 */

const LEVELS: { key: RiskKey; label: string; short: string; color: string; icon: ElementType }[] = [
  { key: "HIGH", label: "High risk", short: "high", color: "var(--risk-high)", icon: OctagonAlert },
  { key: "MEDIUM", label: "Medium risk", short: "medium", color: "var(--risk-medium)", icon: TriangleAlert },
  { key: "LOW", label: "Low risk", short: "low", color: "var(--risk-low)", icon: Leaf },
  { key: "NONE", label: "Not assessed", short: "not assessed", color: "var(--muted-foreground)", icon: CircleHelp },
];

export function RiskOverview({ plants }: { plants: LguPlant[] }) {
  const tally = useMemo(() => riskTally(plants), [plants]);

  const riskRows: BarRow[] = useMemo(
    () =>
      LEVELS.map((level) => ({
        key: level.key,
        label: level.label,
        value: tally[level.key],
        color: level.color,
        icon: level.icon,
      })),
    [tally],
  );

  return (
    <Panel
      title="Plant risk"
      description="Latest AI reading for each plant — point at a level to see its crops."
    >
      <PlantRisk plants={plants} riskRows={riskRows} />
    </Panel>
  );
}

/**
 * The risk share, and the crops at each level. Pointing at a level (its
 * slice or its row) reveals the crops at that level underneath; moving away
 * hides them. Clicking keeps a level open.
 */
export function PlantRisk({
  plants,
  riskRows,
}: {
  plants: LguPlant[];
  riskRows: BarRow[];
}) {
  const [hoverLevel, setHoverLevel] = useState<RiskKey | null>(null);
  const [pinnedLevel, setPinnedLevel] = useState<RiskKey | null>(null);
  const shownLevel = hoverLevel ?? pinnedLevel;

  // Every level's crop rows, worked out once rather than on every hover.
  const cropRowsByLevel = useMemo(() => {
    const byLevel = new Map<RiskKey, BarRow[]>();
    for (const level of LEVELS) {
      const atLevel = plants.filter((plant) => riskKey(plant) === level.key);
      byLevel.set(
        level.key,
        cropCounts(atLevel).map((crop) => ({
          key: crop.id,
          label: crop.name,
          emoji: crop.emoji,
          value: crop.count,
          color: level.color,
        })),
      );
    }
    return byLevel;
  }, [plants]);

  const hover = (key: string | null) => setHoverLevel(key as RiskKey | null);
  const togglePinned = (key: string) =>
    setPinnedLevel((current) => (current === key ? null : (key as RiskKey)));

  const level = LEVELS.find((l) => l.key === shownLevel);
  const rows = shownLevel ? (cropRowsByLevel.get(shownLevel) ?? []) : [];
  const count = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* The pie gives the share at a glance; the rows beside it name each
          level and its count, so colour is never the only cue. */}
      <div className="grid items-center gap-4 self-start sm:grid-cols-[minmax(0,180px)_1fr]">
        <DonutChart
          rows={riskRows}
          unit="plant"
          name="Plant risk share"
          onHoverKey={hover}
          onSelectKey={togglePinned}
        />
        <HorizontalBars
          rows={riskRows}
          unit="plant"
          label="Plants by risk level"
          selectedKey={pinnedLevel}
          onHoverKey={hover}
          onSelect={togglePinned}
        />
      </div>

      {/* Below the pie on narrow screens, beside it on wide ones.

          A fixed height, showing five crops at a time with slide buttons to
          the rest. It used to grow with the list,
          and "Not assessed" (usually the longest) made the page ~450px
          taller on hover. That added a scrollbar and made the browser adjust
          the page, moving things under the pointer; the list closed, the
          page shrank back, and it looped — the screen shook. A panel that
          never changes size cannot start that loop. */}
      <div
        data-testid="risk-level-crops"
        className="border-border flex h-96 flex-col border-t pt-3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4"
        aria-live="polite"
      >
        {level ? (
          <>
            <p className="mb-2 flex shrink-0 items-baseline justify-between gap-3 text-xs">
              <span className="font-heading flex items-center gap-1.5 font-medium">
                <level.icon className="size-3.5" style={{ color: level.color }} aria-hidden="true" />
                {level.label} · {count} plant{count === 1 ? "" : "s"}
              </span>
              <span className="text-muted-foreground">
                {pinnedLevel === shownLevel
                  ? "Kept open · click the level again to close"
                  : "Click the level to keep this open"}
              </span>
            </p>
            {count === 0 ? (
              <p className="text-muted-foreground text-xs">No plants at this level.</p>
            ) : (
              // Keyed by level, so another level starts on its first crops.
              <HorizontalBars
                key={level.key}
                rows={rows}
                unit="plant"
                label={`Crops at ${level.label.toLowerCase()}`}
                pageSize={CROP_PAGE_SIZE}
              />
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-xs">
            Point at a risk level to see which crops are at it. Click to keep it open.
          </p>
        )}
      </div>
    </div>
  );
}

/** "2 high · 1 medium" — only the levels asked for, and only the non-zero ones. */
export function tallyText(tally: RiskTally, keys: RiskKey[]): string {
  const parts = LEVELS.filter((level) => keys.includes(level.key) && tally[level.key] > 0).map(
    (level) => `${tally[level.key]} ${level.short}`,
  );
  return parts.length > 0 ? parts.join(" · ") : "No readings";
}

function Panel({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("gap-0 py-4", className)}>
      <CardContent className="px-4">
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="text-muted-foreground mt-0.5 mb-4 text-xs">{description}</p>
        {children}
      </CardContent>
    </Card>
  );
}

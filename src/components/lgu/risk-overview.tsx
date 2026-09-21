"use client";

import { CircleHelp, Leaf, OctagonAlert, TriangleAlert } from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { useMemo, useRef, useState } from "react";

import { HorizontalBars, type BarRow } from "@/components/lgu/dashboard-charts";
import { FarmersToVisit, type Presence } from "@/components/lgu/farmers-to-visit";
import { NO_FILTERS, PlantDirectory, type PlantFilters } from "@/components/lgu/plant-directory";
import { DonutChart } from "@/components/lgu/risk-pie";
import { Card, CardContent } from "@/components/ui/card";
import type { LguPlant } from "@/lib/api/lgu-api";
import {
  cropCounts,
  farmersToVisit,
  riskKey,
  riskTally,
  type RiskKey,
  type RiskTally,
} from "@/lib/lgu-plant-stats";
import { cn } from "@/lib/utils";

/**
 * The body of the LGU Risk overview. It answers, top to bottom: how healthy
 * are the plants overall (and which crops sit at each
 * risk level), and which Farmers to visit first — then lists every plant
 * behind those answers. The charts filter the list, so a tap on "Maria
 * Santos" or on a crop goes straight to those plants.
 *
 * Everything is worked out from the one plant list, so the charts and the
 * list can never disagree.
 */

const LEVELS: { key: RiskKey; label: string; short: string; color: string; icon: ElementType }[] = [
  { key: "HIGH", label: "High risk", short: "high", color: "var(--risk-high)", icon: OctagonAlert },
  { key: "MEDIUM", label: "Medium risk", short: "medium", color: "var(--risk-medium)", icon: TriangleAlert },
  { key: "LOW", label: "Low risk", short: "low", color: "var(--risk-low)", icon: Leaf },
  { key: "NONE", label: "Not assessed", short: "not assessed", color: "var(--muted-foreground)", icon: CircleHelp },
];

export function RiskOverview({
  plants,
  presence,
  initialCropId = null,
}: {
  plants: LguPlant[];
  /** Online status by Farmer id, for the Farmers to visit cards. Optional. */
  presence?: Map<number, Presence>;
  /** From `?crop=` when arriving from a crop on the Plants page. */
  initialCropId?: string | null;
}) {
  const [filters, setFilters] = useState<PlantFilters>({ ...NO_FILTERS, cropId: initialCropId });
  const listRef = useRef<HTMLElement>(null);

  const tally = useMemo(() => riskTally(plants), [plants]);
  const farmers = useMemo(() => farmersToVisit(plants), [plants]);

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

  // A chart tap sets one filter (clearing the others, so the list shows
  // exactly what was tapped) and brings the list into view.
  function show(next: Partial<PlantFilters>) {
    setFilters({ ...NO_FILTERS, ...next });
    listRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Plant risk"
        description="Latest AI reading for each plant — point at a level to see its crops."
      >
        <PlantRisk
          plants={plants}
          riskRows={riskRows}
          onShow={(risk, cropId) => show({ risk, cropId })}
        />
      </Panel>

      <Panel
        title="Farmers to visit"
        description="Most urgent first — who to see and why."
      >
        <FarmersToVisit
          farmers={farmers}
          presence={presence}
        />
      </Panel>

      <section ref={listRef} aria-label="All plants" className="flex scroll-mt-4 flex-col gap-3">
        <h2 className="text-sm font-medium">All plants</h2>
        <PlantDirectory plants={plants} filters={filters} onFiltersChange={setFilters} />
      </section>
    </div>
  );
}

/**
 * The risk share, and the crops at each level. Pointing at a level (its
 * slice or its row) reveals the crops at that level underneath; moving away
 * hides them. Clicking keeps a level open so its crops can be reached —
 * picking one lists those plants, and "Show all" lists the whole level.
 */
export function PlantRisk({
  plants,
  riskRows,
  onShow,
}: {
  plants: LguPlant[];
  riskRows: BarRow[];
  /** List the plants at `risk`, optionally only those of one crop. */
  onShow: (risk: RiskKey, cropId: string | null) => void;
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
      <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,180px)_1fr]">
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

          A fixed height that scrolls inside. It used to grow with the list,
          and "Not assessed" (usually the longest) made the page ~450px
          taller on hover. That added a scrollbar and made the browser adjust
          the page, moving things under the pointer; the list closed, the
          page shrank back, and it looped — the screen shook. A panel that
          never changes size cannot start that loop. */}
      <div
        data-testid="risk-level-crops"
        className="border-border flex h-64 flex-col border-t pt-3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4"
        aria-live="polite"
      >
        {level ? (
          <>
            <p className="mb-2 flex shrink-0 items-baseline justify-between gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-medium">
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
              <>
                <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
                  <HorizontalBars
                    rows={rows}
                    unit="plant"
                    label={`Crops at ${level.label.toLowerCase()}`}
                    onSelect={(cropId) => onShow(level.key, cropId)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onShow(level.key, null)}
                  className="text-muted-foreground hover:text-foreground mt-3 shrink-0 self-start text-xs underline underline-offset-2"
                >
                  Show all {count} {level.label.toLowerCase()} plant{count === 1 ? "" : "s"}
                </button>
              </>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-xs">
            Point at a risk level to see which crops are at it. Click to keep it open, then pick
            a crop to list its plants.
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

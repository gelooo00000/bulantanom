"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { ColumnChart, HorizontalBars, type BarRow } from "@/components/lgu/dashboard-charts";
import { DonutChart } from "@/components/lgu/risk-pie";
import { Card, CardContent } from "@/components/ui/card";
import type { LguPlant } from "@/lib/api/lgu-api";
import {
  cropCounts,
  cropTypeCounts,
  harvestOutlook,
  harvestStatus,
} from "@/lib/lgu-plant-stats";

/**
 * The body of the LGU Plants page: what is growing at Layuan, and when it
 * comes in.
 *
 * The plant-by-plant list lives on the Risk overview, where each plant's
 * risk is the point. Picking a crop in either chart opens that list
 * already filtered to the crop.
 */

// Past this many crops the tail folds into one "Other" bar.
const CROP_ROWS = 6;
const OUTLOOK_MONTHS = 6;

// Colour follows the crop type, never its rank, so Fruit is always blue.
// The pair is validated for colour-blind separation in both themes.
const CROP_TYPE_COLOR: Record<string, string> = {
  Fruit: "var(--chart-series-1)",
  "Vegetables & Crops": "var(--chart-series-2)",
};

export function PlantsOverview({ plants }: { plants: LguPlant[] }) {
  const router = useRouter();
  const openCrop = (cropId: string) =>
    router.push(`/lgu/risks?crop=${encodeURIComponent(cropId)}`);
  const farmerCount = useMemo(() => new Set(plants.map((p) => p.farmer.id)).size, [plants]);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground -mt-2 text-sm">
        {plants.length} plant{plants.length === 1 ? "" : "s"} from {farmerCount} farmer
        {farmerCount === 1 ? "" : "s"} at Layuan Farm.
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Crops planted"
          description="Fruit or vegetables — point at one to see its crops."
        >
          <CropsPlanted plants={plants} onPickCrop={openCrop} />
        </ChartCard>

        <ChartCard
          title="Harvest outlook"
          description="Plants due for harvest each month — point at a month to see its crops."
        >
          <HarvestOutlook plants={plants} onPickCrop={openCrop} />
        </ChartCard>
      </div>
    </div>
  );
}

/**
 * Crop type and the crops inside it, as one chart. The donut and the type
 * rows beside it show Fruit against Vegetables; pointing at either reveals
 * that type's crops underneath, and moving away hides them again. Clicking
 * keeps a type open — without that, the crops would vanish the moment the
 * pointer moved down to reach them. Picking a crop opens its plants.
 */
export function CropsPlanted({
  plants,
  onPickCrop,
}: {
  plants: LguPlant[];
  /** Called with a crop's id when it is picked from the revealed list. */
  onPickCrop: (cropId: string) => void;
}) {
  const [hoverType, setHoverType] = useState<string | null>(null);
  const [pinnedType, setPinnedType] = useState<string | null>(null);
  const shownType = hoverType ?? pinnedType;

  const typeRows: BarRow[] = useMemo(
    () =>
      cropTypeCounts(plants).map((type) => ({
        key: type.label,
        label: type.label,
        value: type.count,
        color: CROP_TYPE_COLOR[type.label] ?? "var(--muted-foreground)",
      })),
    [plants],
  );

  // Every type's crop rows, worked out once rather than on each hover.
  const cropRowsByType = useMemo(() => {
    const byType = new Map<string, BarRow[]>();
    for (const type of typeRows) {
      const crops = cropCounts(plants.filter((p) => p.crop.category_label === type.key));
      const rows: BarRow[] = crops.slice(0, CROP_ROWS).map((crop) => ({
        key: crop.id,
        label: crop.name,
        emoji: crop.emoji,
        value: crop.count,
        color: type.color,
      }));
      const rest = crops.slice(CROP_ROWS);
      if (rest.length > 0) {
        rows.push({
          key: "other",
          label: `Other (${rest.length} crop${rest.length === 1 ? "" : "s"})`,
          value: rest.reduce((sum, crop) => sum + crop.count, 0),
          color: "var(--muted-foreground)",
        });
      }
      byType.set(type.key, rows);
    }
    return byType;
  }, [plants, typeRows]);

  const togglePinned = (type: string) =>
    setPinnedType((current) => (current === type ? null : type));
  const shownRows = shownType ? (cropRowsByType.get(shownType) ?? []) : [];
  const shownTotal = shownRows.reduce((sum, row) => sum + row.value, 0);

  return (
    <div>
      {/* The donut shows the split at a glance; the rows beside it name each
          type and its count, so colour is never the only cue. */}
      <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,180px)_1fr]">
        <DonutChart
          rows={typeRows}
          unit="plant"
          name="Crop type share"
          onHoverKey={setHoverType}
          onSelectKey={togglePinned}
        />
        <HorizontalBars
          rows={typeRows}
          unit="plant"
          label="Plants by crop type"
          selectedKey={pinnedType}
          onHoverKey={setHoverType}
          onSelect={togglePinned}
        />
      </div>

      {/* Fixed height, scrolling inside: a panel that grew with the list
          resized the page on hover, which could move the chart under the
          pointer and set off an open/close loop (see the Risk overview). */}
      <div className="border-border mt-4 flex h-56 flex-col border-t pt-3" aria-live="polite">
        {shownType ? (
          <>
            <p className="mb-2 flex shrink-0 items-baseline justify-between gap-3 text-xs">
              <span className="font-medium">
                {shownType} · {shownTotal} plant{shownTotal === 1 ? "" : "s"}
              </span>
              <span className="text-muted-foreground">
                {pinnedType === shownType
                  ? "Kept open · click the type again to close"
                  : "Click the type to keep this open"}
              </span>
            </p>
            <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
              <HorizontalBars
                rows={shownRows}
                unit="plant"
                label={`${shownType} crops`}
                onSelect={(key) => {
                  if (key !== "other") onPickCrop(key);
                }}
              />
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-xs">
            Point at {typeRows.map((row) => row.label).join(" or ")} to see its crops. Click to
            keep them open, then pick a crop to see its plants and their risk.
          </p>
        )}
      </div>
    </div>
  );
}

const monthName = (date: Date, month: "short" | "long") =>
  date.toLocaleDateString("en-PH", { month, year: month === "long" ? "numeric" : undefined });

/**
 * Plants coming due each month, and which crops they are. Pointing at a
 * month reveals the crops due in it underneath and moving away hides them;
 * clicking keeps a month open so its crops can be reached, and picking a
 * crop opens its plants — the same behaviour as "Crops planted".
 */
export function HarvestOutlook({
  plants,
  onPickCrop,
  today = new Date(),
}: {
  plants: LguPlant[];
  /** Called with a crop's id when it is picked from the revealed list. */
  onPickCrop: (cropId: string) => void;
  /** Injected by tests; the page always uses the real date. */
  today?: Date;
}) {
  const [hoverMonth, setHoverMonth] = useState<number | null>(null);
  const [pinnedMonth, setPinnedMonth] = useState<number | null>(null);
  const shownMonth = hoverMonth ?? pinnedMonth;

  const outlook = useMemo(() => {
    const { buckets, later } = harvestOutlook(plants, today, OUTLOOK_MONTHS);
    const total = buckets.reduce((sum, b) => sum + b.count, 0);
    const readyNow = plants.filter((p) => harvestStatus(p, today).tone === "ready").length;
    const peak = buckets.reduce((best, b, i) => (b.count > buckets[best].count ? i : best), 0);
    // Each month's crops, worked out once rather than on every hover.
    const cropRows = buckets.map((bucket) =>
      cropCounts(bucket.plants).map<BarRow>((crop) => ({
        key: crop.id,
        label: crop.name,
        emoji: crop.emoji,
        value: crop.count,
        color: "var(--primary)",
      })),
    );
    return { buckets, later, total, readyNow, peak, cropRows };
    // `today` only changes in tests; the page renders with the real date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plants]);

  const shown = shownMonth !== null ? outlook.buckets[shownMonth] : null;

  return (
    <div>
      <ColumnChart
        columns={outlook.buckets.map((bucket) => ({
          key: bucket.key,
          axisLabel: monthName(bucket.month, "short"),
          title: monthName(bucket.month, "long"),
          tableLabel: monthName(bucket.month, "long"),
          count: bucket.count,
        }))}
        unit="plant"
        tableHeading="Month"
        summary={
          outlook.total === 0
            ? `No harvests due in the next ${OUTLOOK_MONTHS} months.`
            : `${outlook.total} plant${outlook.total === 1 ? "" : "s"} due in the next ${OUTLOOK_MONTHS} months · ${outlook.readyNow} ready now${outlook.later > 0 ? ` · ${outlook.later} later` : ""}.`
        }
        name={`Harvests due per month for the next ${OUTLOOK_MONTHS} months: ${outlook.buckets
          .map((b) => `${monthName(b.month, "long")} ${b.count}`)
          .join(", ")}.`}
        labelIndex={outlook.total > 0 ? outlook.peak : undefined}
        onHoverIndex={setHoverMonth}
        onSelectIndex={(i) => setPinnedMonth((current) => (current === i ? null : i))}
        selectedIndex={pinnedMonth}
      />

      {/* Fixed height, scrolling inside, for the same reason as Crops planted. */}
      <div className="border-border mt-4 flex h-56 flex-col border-t pt-3" aria-live="polite">
        {shown ? (
          <>
            <p className="mb-2 flex shrink-0 items-baseline justify-between gap-3 text-xs">
              <span className="font-medium">
                Due in {monthName(shown.month, "long")} · {shown.count} plant
                {shown.count === 1 ? "" : "s"}
              </span>
              <span className="text-muted-foreground">
                {pinnedMonth === shownMonth
                  ? "Kept open · click the month again to close"
                  : "Click the month to keep this open"}
              </span>
            </p>
            {shown.count === 0 ? (
              <p className="text-muted-foreground text-xs">Nothing is due for harvest this month.</p>
            ) : (
              <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
                <HorizontalBars
                  rows={outlook.cropRows[shownMonth!]}
                  unit="plant"
                  label={`Crops due in ${monthName(shown.month, "long")}`}
                  onSelect={onPickCrop}
                />
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-xs">
            Point at a month to see which crops are due. Click to keep it open, then pick a
            crop to see its plants and their risk.
          </p>
        )}
      </div>
    </div>
  );
}

function ChartCard({
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
    <Card className={`gap-0 py-4 ${className ?? ""}`}>
      <CardContent className="px-4">
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="text-muted-foreground mt-0.5 mb-4 text-xs">{description}</p>
        {children}
      </CardContent>
    </Card>
  );
}

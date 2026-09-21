"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { formatDisplayDate } from "@/components/ui/date-picker";
import type { LguPlant } from "@/lib/api/lgu-api";
import { matchesPlantSearch, riskKey, type RiskKey } from "@/lib/lgu-plant-stats";
import { cn } from "@/lib/utils";

const RISK_FILTERS: { key: RiskKey | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "HIGH", label: "High risk" },
  { key: "MEDIUM", label: "Medium" },
  { key: "LOW", label: "Low" },
  { key: "NONE", label: "Not assessed" },
];

const RISK_BADGE: Record<RiskKey, { label: string; className: string }> = {
  HIGH: { label: "High risk", className: "bg-risk-high/15 text-risk-high border-risk-high/30" },
  MEDIUM: {
    label: "Medium risk",
    className: "bg-risk-medium/15 text-risk-medium border-risk-medium/30",
  },
  LOW: { label: "Low risk", className: "bg-risk-low/15 text-risk-low border-risk-low/30" },
  NONE: { label: "Not assessed", className: "border-border text-muted-foreground" },
};

/** Highest risk first; a plant nobody has assessed yet sorts last. */
const RISK_ORDER: Record<RiskKey, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 };

export type PlantFilters = {
  cropId: string | null;
  farmerId: number | null;
  risk: RiskKey | "ALL";
};

export const NO_FILTERS: PlantFilters = { cropId: null, farmerId: null, risk: "ALL" };

/**
 * Every plant at Layuan, searchable by plant, crop or Farmer and filterable
 * by its latest risk reading. The filters are held by the page, so the
 * charts above the list can set them — tapping a crop, a Farmer or a risk
 * level there narrows this list to it.
 */
export function PlantDirectory({
  plants,
  filters,
  onFiltersChange,
}: {
  plants: LguPlant[];
  filters: PlantFilters;
  onFiltersChange: (next: PlantFilters) => void;
}) {
  const [query, setQuery] = useState("");
  const { cropId, farmerId, risk } = filters;
  const setRisk = (next: RiskKey | "ALL") => onFiltersChange({ ...filters, risk: next });

  const inScope = useMemo(
    () =>
      plants.filter(
        (plant) =>
          (!cropId || plant.crop.id === cropId) && (!farmerId || plant.farmer.id === farmerId),
      ),
    [plants, cropId, farmerId],
  );

  // Counts reflect the crop and search already applied, so each chip says
  // exactly how many plants tapping it will show.
  const searched = useMemo(
    () => inScope.filter((plant) => matchesPlantSearch(plant, query)),
    [inScope, query],
  );
  const counts = useMemo(() => {
    const result: Record<RiskKey | "ALL", number> = {
      ALL: searched.length,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      NONE: 0,
    };
    for (const plant of searched) result[riskKey(plant)] += 1;
    return result;
  }, [searched]);

  const shown = (
    risk === "ALL" ? searched : searched.filter((p) => riskKey(p) === risk)
  )
    // Highest risk first, as the caption says; within a level, by name.
    .slice()
    .sort(
      (a, b) =>
        RISK_ORDER[riskKey(a)] - RISK_ORDER[riskKey(b)] ||
        a.display_name.localeCompare(b.display_name),
    );
  const cropName = cropId ? plants.find((p) => p.crop.id === cropId)?.crop.name : null;
  const farmerName = farmerId
    ? plants.find((p) => p.farmer.id === farmerId)?.farmer.full_name
    : null;
  const narrowed =
    query.trim() !== "" || risk !== "ALL" || cropId !== null || farmerId !== null;

  function clearAll() {
    setQuery("");
    onFiltersChange(NO_FILTERS);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
          placeholder="Search by plant, crop or farmer"
          aria-label="Search plants by plant, crop or farmer"
          className="border-border bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-lg border pr-9 pl-9 text-sm outline-none focus-visible:ring-3 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by risk">
        {RISK_FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            aria-pressed={risk === filter.key}
            onClick={() => setRisk(filter.key)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              risk === filter.key
                ? "border-primary/50 bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {filter.label}
            <span className="text-muted-foreground ml-1.5 tabular-nums">{counts[filter.key]}</span>
          </button>
        ))}

        {cropName && (
          <FilterChip
            label={cropName}
            onClear={() => onFiltersChange({ ...filters, cropId: null })}
          />
        )}
        {farmerName && (
          <FilterChip
            label={farmerName}
            onClear={() => onFiltersChange({ ...filters, farmerId: null })}
          />
        )}
      </div>

      <p className="text-muted-foreground text-sm" role="status">
        {shown.length === 1 ? "1 plant" : `${shown.length} plants`} · highest risk first
        {narrowed && (
          <>
            {" · "}
            <button type="button" onClick={clearAll} className="underline underline-offset-2">
              Show all plants
            </button>
          </>
        )}
      </p>

      {shown.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm">
          {query.trim() ? `No plants match "${query.trim()}".` : "No plants in this view."}
        </div>
      ) : (
        <ul className="border-border divide-border bg-card divide-y overflow-hidden rounded-xl border">
          {shown.map((plant) => (
            <PlantRow key={plant.id} plant={plant} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={`Stop filtering by ${label}`}
      className="border-primary/50 bg-primary/10 flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium"
    >
      {label}
      <X className="size-3.5" />
    </button>
  );
}

function PlantRow({ plant }: { plant: LguPlant }) {
  const badge = RISK_BADGE[riskKey(plant)];
  const showCrop = plant.display_name.trim().toLowerCase() !== plant.crop.name.toLowerCase();

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <span
        aria-hidden="true"
        className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-full text-lg"
      >
        {plant.crop.emoji}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {plant.display_name}
          {showCrop && (
            <span className="text-muted-foreground font-normal"> · {plant.crop.name}</span>
          )}
        </p>
        <p className="text-muted-foreground truncate text-sm">
          {plant.farmer.full_name} · planted {formatDisplayDate(plant.planting_date)} (
          {plant.age_days} {plant.age_days === 1 ? "day" : "days"})
        </p>
      </div>

      {/* Just the risk. When a plant comes in is on the Harvest outlook chart. */}
      <div className="shrink-0 text-xs">
        {/* Latest reading only — a recovered plant is not still HIGH. */}
        {plant.latest_risk?.risk_level === "HIGH" ? (
          <Link
            href="/lgu/high-risk"
            className={cn("rounded-full border px-2 py-0.5 font-medium hover:underline", badge.className)}
          >
            {badge.label}
          </Link>
        ) : (
          <span className={cn("rounded-full border px-2 py-0.5 font-medium", badge.className)}>
            {badge.label}
          </span>
        )}
      </div>
    </li>
  );
}

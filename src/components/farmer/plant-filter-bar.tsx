"use client";

import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BackendPlant } from "@/lib/api/plants-api";
import { useLanguage } from "@/lib/i18n";
import { cropsIn } from "@/lib/plant-filter";

/**
 * Search box and crop dropdown over a list of plants, as on My Plants and
 * Harvest. The page owns the state and does the filtering with
 * `filterPlants`; this only draws the controls and the "Showing 3 of 25" line.
 */
export function PlantFilterBar({
  plants,
  shown,
  query,
  onQueryChange,
  cropId,
  onCropChange,
}: {
  plants: BackendPlant[];
  /** How many plants pass the filter, for the "Showing" line. */
  shown: number;
  query: string;
  onQueryChange: (query: string) => void;
  cropId: string;
  onCropChange: (cropId: string) => void;
}) {
  const { t } = useLanguage();
  const crops = cropsIn(plants);
  const filtering = query.trim() !== "" || cropId !== "";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && onQueryChange("")}
            placeholder={t("myPlants.search")}
            aria-label={t("myPlants.search")}
            className="border-border bg-card focus-visible:ring-ring/50 h-11 w-full rounded-lg border pr-10 pl-9 text-base focus-visible:ring-[3px] focus-visible:outline-none sm:text-sm [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label={t("common.close")}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <select
          value={cropId}
          onChange={(e) => onCropChange(e.target.value)}
          aria-label={t("myPlants.cropFilter")}
          className="border-border bg-card h-11 rounded-lg border px-3 text-base sm:w-56 sm:text-sm"
        >
          <option value="">{t("myPlants.allCrops", { n: plants.length })}</option>
          {crops.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.name} ({c.count})
            </option>
          ))}
        </select>
      </div>

      {filtering && shown > 0 && (
        <p className="text-muted-foreground text-sm" role="status">
          {t("myPlants.showing", { shown, total: plants.length })}
        </p>
      )}
    </div>
  );
}

/** Shown in place of the list when nothing passes the filter. */
export function NoPlantsMatch({ onClear }: { onClear: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="border-border flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-8 text-center">
      <Search className="text-muted-foreground size-5" />
      <p className="font-heading text-sm font-medium" role="status">
        {t("myPlants.noMatch")}
      </p>
      <Button variant="outline" onClick={onClear}>
        {t("myPlants.clearFilters")}
      </Button>
    </div>
  );
}

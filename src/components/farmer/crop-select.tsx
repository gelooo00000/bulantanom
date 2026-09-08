"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BackendCrop } from "@/lib/api/plants-api";

const CATEGORY_ORDER: BackendCrop["category"][] = ["fruit", "vegetable"];
const CATEGORY_LABEL: Record<BackendCrop["category"], string> = {
  fruit: "Fruits",
  vegetable: "Vegetables & Crops",
};

/**
 * Substring match on the display name (so "cara" finds "Starfruit
 * (Carambola)") plus prefix match on local-name aliases (so "atis" finds
 * Sugar Apple without also matching Tomato via "kamatis").
 */
function matches(crop: BackendCrop, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (crop.name.toLowerCase().includes(q)) return true;
  return (crop.search_terms ?? []).some((term) => term.toLowerCase().startsWith(q));
}

type CropSelectProps = {
  id?: string;
  crops: BackendCrop[];
  value: string | null;
  onValueChange: (value: string | null) => void;
};

export function CropSelect({ id, crops, value, onValueChange }: CropSelectProps) {
  const [query, setQuery] = useState("");

  const groups = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        crops: crops.filter((crop) => crop.category === category && matches(crop, query)),
      })).filter((group) => group.crops.length > 0),
    [crops, query],
  );

  const selectedCrop = crops.find((crop) => crop.id === value);

  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      onOpenChange={(open) => {
        if (!open) setQuery("");
      }}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder="Select a crop">
          {() =>
            selectedCrop ? (
              <span className="flex items-center gap-2">
                <span aria-hidden="true">{selectedCrop.emoji}</span>
                {selectedCrop.name}
              </span>
            ) : (
              "Select a crop"
            )
          }
        </SelectValue>
      </SelectTrigger>

      <SelectContent className="max-h-80 w-[var(--anchor-width)] min-w-64 p-0">
        <div className="border-border bg-popover sticky top-0 z-10 border-b p-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              // Base UI Select runs its own typeahead on keydown; without
              // this the popup would jump around while typing here.
              onKeyDown={(event) => event.stopPropagation()}
              placeholder="Search crops…"
              aria-label="Search crops"
              className="border-border bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-lg border pr-2 pl-8 text-sm outline-none focus-visible:ring-3"
            />
          </div>
        </div>

        <div className="p-1">
          {groups.length > 0 ? (
            groups.map(({ category, crops: groupCrops }) => (
              <SelectGroup key={category}>
                <SelectGroupLabel>{CATEGORY_LABEL[category]}</SelectGroupLabel>
                {groupCrops.map((crop) => (
                  <SelectItem key={crop.id} value={crop.id}>
                    {/* Emoji is a visual aid only — the name is always shown. */}
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true">{crop.emoji}</span>
                      {crop.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))
          ) : (
            <p className="text-muted-foreground px-2 py-6 text-center text-sm">
              No crops match “{query}”.
            </p>
          )}
        </div>
      </SelectContent>
    </Select>
  );
}

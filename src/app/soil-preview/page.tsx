"use client";

// TEMPORARY preview. Delete before commit.

import { CropSuggestionsCard } from "@/components/farmer/crop-suggestions-card";
import type { BackendPlant } from "@/lib/api/plants-api";

function plant(id: number, name: string, emoji: string, date: string): BackendPlant {
  return {
    id,
    display_name: name,
    planting_date: date,
    status: "GROWING",
    status_label: "Growing",
    crop: { emoji },
  } as BackendPlant;
}

const today = new Date();
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const PLANTS = [
  plant(1, "Avocado", "🥑", iso(today)),
  plant(2, "Banana", "🍌", iso(today)),
  plant(3, "Pineapple", "🍍", "2026-09-19"),
];

export default function Page() {
  return (
    <div className="flex flex-wrap items-start gap-6 p-6">
      <div style={{ width: 420 }}>
        <h1 className="mb-2 text-sm font-medium">Planted today (pick Sep 19 for the pineapple)</h1>
        <CropSuggestionsCard plants={PLANTS} />
      </div>
      <div style={{ width: 420 }}>
        <h1 className="mb-2 text-sm font-medium">No plants yet</h1>
        <CropSuggestionsCard plants={[]} />
      </div>
    </div>
  );
}

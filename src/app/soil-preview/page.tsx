"use client";

// TEMPORARY preview. Delete before commit.

import { CropSuggestionsCard } from "@/components/farmer/crop-suggestions-card";
import type { CropSuggestions } from "@/lib/api/dashboard-api";

const WITH: CropSuggestions = {
  has_any: true,
  recorded_on: "2026-09-19",
  crops: [
    { id: "pineapple", name: "Pineapple", emoji: "🍍",
      reason: "Well-suited to the acidic soil pH of 4.0 you recorded.",
      planting_months: [2, 3, 4, 5, 6, 7, 8], caution_months: [9, 1] },
    { id: "pepper", name: "Green Chili Pepper", emoji: "🌶️",
      reason: "Tolerates the moderate moisture levels measured.",
      planting_months: [2, 3, 4, 5], caution_months: [6, 7, 8] },
    { id: "purple-sweet-potato", name: "Purple Sweet Potato (Ube)", emoji: "🍠",
      reason: "Performs well in acidic conditions.",
      planting_months: [3, 4, 5, 6], caution_months: [2, 7] },
  ],
};

const EMPTY: CropSuggestions = { has_any: false, recorded_on: null, crops: [] };

export default function Page() {
  return (
    <div className="flex flex-wrap items-start gap-6 p-6">
      <div style={{ width: 420 }}>
        <h1 className="mb-2 text-sm font-medium">With suggestions (today = Sep, lean month)</h1>
        <CropSuggestionsCard suggestions={WITH} />
      </div>
      <div style={{ width: 420 }}>
        <h1 className="mb-2 text-sm font-medium">Nothing yet</h1>
        <CropSuggestionsCard suggestions={EMPTY} />
      </div>
    </div>
  );
}

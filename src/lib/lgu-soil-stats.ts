import type { LguSoilRecommendation } from "@/lib/api/lgu-api";

/**
 * Helpers behind the LGU Crop Recommendation Records list, worked out from
 * the one list of soil records the page loads.
 *
 * pH bands follow the general agronomy guide that most crops grow best at
 * pH 6.0–7.0. They are guidance for spotting soils worth a follow-up, not a
 * diagnosis — the AI recommendation on each record is still the advice the
 * Farmer received. Nitrogen, phosphorus and potassium are deliberately not
 * banded: what counts as "low" depends on the test method, so the page shows
 * the readings as recorded instead of inventing thresholds.
 */

export type PhBand = "TOO_ACIDIC" | "SLIGHTLY_ACIDIC" | "IDEAL" | "ALKALINE" | "NONE";

export const PH_BANDS: { key: PhBand; label: string; range: string }[] = [
  { key: "TOO_ACIDIC", label: "Too acidic", range: "below 5.5" },
  { key: "SLIGHTLY_ACIDIC", label: "Slightly acidic", range: "5.5 – 6.0" },
  { key: "IDEAL", label: "Ideal", range: "6.0 – 7.0" },
  { key: "ALKALINE", label: "Alkaline", range: "above 7.0" },
  { key: "NONE", label: "No pH reading", range: "" },
];

export function phValue(record: LguSoilRecommendation): number | null {
  if (record.soil_ph === null || record.soil_ph === "") return null;
  const value = Number(record.soil_ph);
  return Number.isFinite(value) ? value : null;
}

export function phBand(ph: number | null): PhBand {
  if (ph === null) return "NONE";
  if (ph < 5.5) return "TOO_ACIDIC";
  if (ph < 6.0) return "SLIGHTLY_ACIDIC";
  if (ph <= 7.0) return "IDEAL";
  return "ALKALINE";
}

/** Newest first; ties (several saves in one moment) broken by id. */
function newestFirst(a: LguSoilRecommendation, b: LguSoilRecommendation): number {
  return b.created_at.localeCompare(a.created_at) || b.id - a.id;
}

/** Each Farmer's most recent record, newest Farmer first. */
export function latestPerFarmer(records: LguSoilRecommendation[]): LguSoilRecommendation[] {
  const latest = new Map<number, LguSoilRecommendation>();
  for (const record of [...records].sort(newestFirst)) {
    if (!latest.has(record.farmer_id)) latest.set(record.farmer_id, record);
  }
  return [...latest.values()];
}

/**
 * The reading a record's pH should be compared with: the same Farmer's
 * previous record that has a pH. Null when there is nothing earlier to
 * compare, or this record has no pH itself.
 */
export function previousPh(
  record: LguSoilRecommendation,
  records: LguSoilRecommendation[],
): number | null {
  if (phValue(record) === null) return null;
  const earlier = records
    .filter((r) => r.farmer_id === record.farmer_id && newestFirst(record, r) < 0)
    .sort(newestFirst);
  for (const r of earlier) {
    const ph = phValue(r);
    if (ph !== null) return ph;
  }
  return null;
}

/** A record worth an Officer's look: soil outside 6.0–7.0, or AI warnings. */
export function needsAttention(record: LguSoilRecommendation): boolean {
  const band = phBand(phValue(record));
  const offBand = band !== "IDEAL" && band !== "NONE";
  return offBand || record.important_warnings.length > 0;
}

export function recommendedCrops(record: LguSoilRecommendation) {
  return [...record.suitable_fruits, ...record.suitable_vegetables, ...record.suitable_crops];
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export function matchesFarmer(record: LguSoilRecommendation, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  return normalize(`${record.farmer_name} ${record.farmer_email}`).includes(q);
}

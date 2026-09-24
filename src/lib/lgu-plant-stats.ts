import type { LguPlant } from "@/lib/api/lgu-api";

/**
 * Figures behind the LGU Plants charts, computed from the one plant list the
 * page already loads — so the charts and the list below them can never
 * disagree.
 */

export type RiskKey = "HIGH" | "MEDIUM" | "LOW" | "NONE";

/** Archived plants were removed by their Farmer; they are not in the ground. */
export function livePlants(plants: LguPlant[]): LguPlant[] {
  return plants.filter((plant) => plant.status !== "ARCHIVED");
}

/**
 * A "too early to tell" reading counts as no reading, as it does on the LGU
 * dashboard, so every screen buckets a plant the same way.
 */
export function riskKey(plant: LguPlant): RiskKey {
  const level = plant.latest_risk?.risk_level;
  return level === "HIGH" || level === "MEDIUM" || level === "LOW" ? level : "NONE";
}

/** Plants per crop type (Fruit, Vegetables & Crops), largest first. */
export function cropTypeCounts(plants: LguPlant[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const plant of plants) {
    const label = plant.crop.category_label;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export type CropCount = { id: string; name: string; emoji: string; count: number };

/** Plants per crop, most planted first. */
export function cropCounts(plants: LguPlant[]): CropCount[] {
  const counts = new Map<string, CropCount>();
  for (const plant of plants) {
    const entry = counts.get(plant.crop.id) ?? {
      id: plant.crop.id,
      name: plant.crop.name,
      emoji: plant.crop.emoji,
      count: 0,
    };
    entry.count += 1;
    counts.set(plant.crop.id, entry);
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}

/** A YYYY-MM-DD date as a local calendar date (no timezone drift). */
function parseDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Still to be harvested: not harvested, and its window has not closed. */
export function isUpcomingHarvest(plant: LguPlant, today = new Date()): boolean {
  if (plant.status === "HARVESTED" || plant.status === "ARCHIVED") return false;
  return parseDate(plant.expected_harvest_end) >= startOfDay(today);
}

export type MonthBucket = {
  key: string;
  month: Date;
  count: number;
  /** The plants behind `count`, so a chart can show what is due that month. */
  plants: LguPlant[];
};

/**
 * Plants coming due for harvest in each of the next `months` months,
 * starting with this one. A window that is already open counts in the
 * current month — that harvest is due now. Windows further out than the
 * range are returned as `later` so the total still adds up.
 */
export function harvestOutlook(
  plants: LguPlant[],
  today = new Date(),
  months = 6,
): { buckets: MonthBucket[]; later: number } {
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const buckets: MonthBucket[] = Array.from({ length: months }, (_, i) => {
    const month = new Date(first.getFullYear(), first.getMonth() + i, 1);
    return {
      key: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`,
      month,
      count: 0,
      plants: [],
    };
  });

  let later = 0;
  for (const plant of plants) {
    if (!isUpcomingHarvest(plant, today)) continue;
    const start = parseDate(plant.expected_harvest_start);
    const due = start < first ? first : start;
    const index =
      (due.getFullYear() - first.getFullYear()) * 12 + (due.getMonth() - first.getMonth());
    if (index < months) {
      buckets[index].count += 1;
      buckets[index].plants.push(plant);
    }
    else later += 1;
  }
  return { buckets, later };
}

/** Where a plant stands against its harvest window, in plain words. */
export function harvestStatus(
  plant: LguPlant,
  today = new Date(),
): { label: string; tone: "ready" | "soon" | "later" | "done" | "passed" } {
  if (plant.status === "HARVESTED") return { label: "Harvested", tone: "done" };
  const now = startOfDay(today);
  const start = parseDate(plant.expected_harvest_start);
  const end = parseDate(plant.expected_harvest_end);
  if (end < now) return { label: "Harvest window passed", tone: "passed" };
  if (start <= now) return { label: "Ready to harvest now", tone: "ready" };
  const days = Math.round((start.getTime() - now.getTime()) / 86_400_000);
  if (days === 1) return { label: "Harvest tomorrow", tone: "soon" };
  if (days <= 14) return { label: `Harvest in ${days} days`, tone: "soon" };
  return { label: `Harvest in ${days} days`, tone: "later" };
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Matches the plant's name, its crop, or its Farmer's name or email. */
export function matchesPlantSearch(plant: LguPlant, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  return normalize(
    `${plant.display_name} ${plant.crop.name} ${plant.farmer.full_name} ${plant.farmer.email}`,
  ).includes(q);
}

export type RiskTally = Record<RiskKey, number>;

function emptyTally(): RiskTally {
  return { HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0 };
}

/** Plants per latest risk level. Every plant is counted exactly once. */
export function riskTally(plants: LguPlant[]): RiskTally {
  const tally = emptyTally();
  for (const plant of plants) tally[riskKey(plant)] += 1;
  return tally;
}

/** A crop that has at least one high- or medium-risk plant on a farm. */
export type CropAtRisk = { id: string; name: string; emoji: string; level: "HIGH" | "MEDIUM" };

export type FarmerRisk = {
  id: number;
  name: string;
  email: string;
  tally: RiskTally;
  total: number;
  /** Crops with a high- or medium-risk plant, high first, each listed once. */
  cropsAtRisk: CropAtRisk[];
  /** The most recent assessment of any of their plants (YYYY-MM-DD), or null. */
  lastChecked: string | null;
};

/**
 * Farmers with at least one high- or medium-risk plant, most urgent first:
 * by high-risk plants, then medium, then name. These are the visits worth
 * making; a Farmer whose plants all read low is not on the list.
 */
export function farmersToVisit(plants: LguPlant[]): FarmerRisk[] {
  const byFarmer = new Map<number, FarmerRisk>();
  for (const plant of plants) {
    const entry = byFarmer.get(plant.farmer.id) ?? {
      id: plant.farmer.id,
      name: plant.farmer.full_name,
      email: plant.farmer.email,
      tally: emptyTally(),
      total: 0,
      cropsAtRisk: [],
      lastChecked: null,
    };
    const level = riskKey(plant);
    entry.tally[level] += 1;
    entry.total += 1;

    if (level === "HIGH" || level === "MEDIUM") {
      const known = entry.cropsAtRisk.find((crop) => crop.id === plant.crop.id);
      if (!known) {
        entry.cropsAtRisk.push({
          id: plant.crop.id,
          name: plant.crop.name,
          emoji: plant.crop.emoji,
          level,
        });
      } else if (level === "HIGH") {
        // A crop with both a high and a medium plant is listed as high.
        known.level = "HIGH";
      }
    }

    const checked = plant.latest_risk?.assessment_date ?? null;
    if (checked && (!entry.lastChecked || checked > entry.lastChecked)) {
      entry.lastChecked = checked;
    }
    byFarmer.set(plant.farmer.id, entry);
  }

  for (const farmer of byFarmer.values()) {
    farmer.cropsAtRisk.sort(
      (x, y) => Number(y.level === "HIGH") - Number(x.level === "HIGH") || x.name.localeCompare(y.name),
    );
  }

  return [...byFarmer.values()]
    .filter((farmer) => farmer.tally.HIGH + farmer.tally.MEDIUM > 0)
    .sort(
      (a, b) =>
        b.tally.HIGH - a.tally.HIGH ||
        b.tally.MEDIUM - a.tally.MEDIUM ||
        a.name.localeCompare(b.name),
    );
}

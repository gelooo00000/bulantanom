import type { BackendPlant } from "@/lib/api/plants-api";

/**
 * Where each plant stands on the Harvest page, from its stored dates only.
 * Nothing here is estimated beyond the window Django calculated.
 */

/**
 * Matches APPROACHING_WINDOW_DAYS in
 * notifications/management/commands/notify_harvest_windows.py, so a plant
 * flagged "this week" here is the same one the system emails about.
 */
export const APPROACHING_WINDOW_DAYS = 7;

export type HarvestPhase = "harvested" | "open" | "approaching" | "growing" | "passed";

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Whole days from today to an ISO date, negative once the date has passed. */
export function daysUntil(iso: string, today: Date = new Date()): number {
  const target = new Date(`${iso}T00:00:00`);
  return Math.round((target.getTime() - startOfDay(today).getTime()) / 86_400_000);
}

/** Whole days from one ISO date to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000,
  );
}

export function phaseOf(plant: BackendPlant, today: Date = new Date()): HarvestPhase {
  if (plant.status === "HARVESTED" || plant.status === "ARCHIVED") return "harvested";
  const toStart = daysUntil(plant.expected_harvest_start, today);
  const toEnd = daysUntil(plant.expected_harvest_end, today);
  if (toEnd < 0) return "passed";
  if (toStart <= 0) return "open";
  if (toStart <= APPROACHING_WINDOW_DAYS) return "approaching";
  return "growing";
}

/**
 * Read from the plant's own saved dates, not `plant.crop`: a variety has its
 * own durations, and those are what Django used for the dates.
 */
export function growingDays(plant: BackendPlant): number {
  return daysBetween(plant.planting_date, plant.expected_harvest_start);
}

export function harvestWindowDays(plant: BackendPlant): number {
  return daysBetween(plant.expected_harvest_start, plant.expected_harvest_end);
}

/** How far through the growing period this plant is, 0-100. */
export function growthPercent(plant: BackendPlant): number {
  const total = growingDays(plant);
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((plant.age_days / total) * 100)));
}

/**
 * Positions on the planting-to-end-of-harvest timeline, as percentages.
 * The harvest window is kept at least 8% wide so it stays visible on a
 * tree crop whose growing years dwarf a three-month harvest.
 */
export function timeline(plant: BackendPlant, today: Date = new Date()) {
  const grow = Math.max(0, growingDays(plant));
  const window = Math.max(0, harvestWindowDays(plant));
  const total = grow + window || 1;
  const windowWidth = Math.min(100, Math.max(8, (window / total) * 100));
  const windowStart = 100 - windowWidth;
  // Today, mapped onto the same scale: growing days into the first part,
  // harvest days into the window.
  const age = daysBetween(plant.planting_date, startOfDayIso(today));
  let todayAt: number;
  if (age <= 0) todayAt = 0;
  else if (age <= grow) todayAt = grow ? (age / grow) * windowStart : windowStart;
  else todayAt = windowStart + Math.min(1, (age - grow) / (window || 1)) * windowWidth;
  return {
    windowStart,
    windowWidth,
    todayAt: Math.max(0, Math.min(100, todayAt)),
    pastEnd: age > grow + window,
  };
}

function startOfDayIso(date: Date): string {
  const d = startOfDay(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Most urgent first: open (ending soonest), passed, then approaching. */
export function sortByUrgency(plants: BackendPlant[], today: Date = new Date()) {
  const rank: Record<HarvestPhase, number> = {
    open: 0,
    passed: 1,
    approaching: 2,
    growing: 3,
    harvested: 4,
  };
  return [...plants].sort((a, b) => {
    const byPhase = rank[phaseOf(a, today)] - rank[phaseOf(b, today)];
    if (byPhase !== 0) return byPhase;
    const key = (p: BackendPlant) =>
      phaseOf(p, today) === "open" ? p.expected_harvest_end : p.expected_harvest_start;
    return key(a).localeCompare(key(b));
  });
}

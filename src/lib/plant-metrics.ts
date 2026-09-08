import { getPlantAgeDays, type Assessment, type Crop, type FarmerPlant, type RiskLevel } from "@/lib/mock-data";

export function getGrowthProgress(plant: FarmerPlant, crop: Crop): number {
  const fraction = getPlantAgeDays(plant) / crop.growingDurationDays;
  return Math.max(0, Math.min(100, Math.round(fraction * 100)));
}

const HEALTH_SCORE_BY_RISK: Record<RiskLevel, number> = {
  low: 90,
  medium: 55,
  high: 20,
};

export function getHealthScore(riskLevel: RiskLevel | undefined): number | null {
  if (!riskLevel) return null;
  return HEALTH_SCORE_BY_RISK[riskLevel];
}

export type FarmHealthSummary = {
  score: number | null;
  label: "Healthy" | "Needs Attention" | "At Risk" | "Not yet assessed";
};

export function summarizeFarmHealth(riskLevels: (RiskLevel | undefined)[]): FarmHealthSummary {
  const scores = riskLevels
    .map((level) => getHealthScore(level))
    .filter((score): score is number => score !== null);

  if (scores.length === 0) {
    return { score: null, label: "Not yet assessed" };
  }

  const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  const label = average >= 70 ? "Healthy" : average >= 40 ? "Needs Attention" : "At Risk";
  return { score: average, label };
}

export function countRecentAssessments(assessments: Assessment[], days = 7): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return assessments.filter((a) => new Date(a.submittedAt).getTime() >= cutoff).length;
}

export function daysUntil(date: string | Date): number {
  const target = typeof date === "string" ? new Date(date) : date;
  return Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

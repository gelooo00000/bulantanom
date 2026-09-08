// The crop catalog lives in `crops.ts` — the single canonical source. It is
// re-exported here so the many existing `from "@/lib/mock-data"` imports
// keep working unchanged.
export { CROPS, type Crop, type CropCategory } from "@/lib/crops";

import { CROPS } from "@/lib/crops";
import type { Crop } from "@/lib/crops";

export type RiskLevel = "low" | "medium" | "high";

export type FarmerPlant = {
  id: string;
  cropId: string;
  plantingDate: string;
  label?: string;
};

export type Assessment = {
  id: string;
  plantId: string;
  submittedAt: string;
  wateringFrequency: string;
  fertilization: string;
  leafCondition: string;
  stemCondition: string;
  growthCondition: string;
  pestSymptoms: string;
  diseaseSymptoms: string;
  environmentalObservations: string;
  farmerDescription: string;
};

export type RiskResult = {
  id: string;
  assessmentId: string;
  riskLevel: RiskLevel;
  confidence: number;
  contributingFactors: string[];
  possibleCauses: string[];
  explanation: string;
  recommendedActions: string[];
  monitoringAdvice: string;
  nextAssessmentDate: string;
};

export const GROWTH_STAGES = [
  "Seedling",
  "Vegetative",
  "Flowering",
  "Fruiting",
  "Harvest-ready",
] as const;

export const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

export const FARMER_PLANTS: FarmerPlant[] = [
  { id: "plant-1", cropId: "papaya", plantingDate: daysAgo(210), label: "Papaya · North Row" },
  { id: "plant-2", cropId: "tomato", plantingDate: daysAgo(52), label: "Tomato · Plot B" },
  { id: "plant-3", cropId: "eggplant", plantingDate: daysAgo(30), label: "Eggplant · Plot C" },
];

export const ASSESSMENTS: Assessment[] = [
  {
    id: "assessment-1",
    plantId: "plant-2",
    submittedAt: daysAgo(3),
    wateringFrequency: "Daily",
    fertilization: "Organic compost, applied 2 weeks ago",
    leafCondition: "Yellowing at lower leaves",
    stemCondition: "Firm, no lesions",
    growthCondition: "Slightly stunted compared to last week",
    pestSymptoms: "A few aphids observed on new growth",
    diseaseSymptoms: "None observed",
    environmentalObservations: "Heavy rain the past 3 days",
    farmerDescription: "Leaves near the bottom are turning yellow and a bit droopy.",
  },
  {
    id: "assessment-2",
    plantId: "plant-2",
    submittedAt: daysAgo(10),
    wateringFrequency: "Daily",
    fertilization: "None this week",
    leafCondition: "Healthy, deep green",
    stemCondition: "Firm, upright",
    growthCondition: "Steady growth",
    pestSymptoms: "None observed",
    diseaseSymptoms: "None observed",
    environmentalObservations: "Sunny, normal rainfall",
    farmerDescription: "Plant looks good overall.",
  },
  {
    id: "assessment-3",
    plantId: "plant-1",
    submittedAt: daysAgo(6),
    wateringFrequency: "Every 2 days",
    fertilization: "Balanced NPK, applied last week",
    leafCondition: "Healthy",
    stemCondition: "Firm, thickening",
    growthCondition: "Steady growth",
    pestSymptoms: "None observed",
    diseaseSymptoms: "None observed",
    environmentalObservations: "Consistent sunlight",
    farmerDescription: "No concerns this week.",
  },
];

export const RISK_RESULTS: RiskResult[] = [
  {
    id: "risk-1",
    assessmentId: "assessment-1",
    riskLevel: "medium",
    confidence: 72,
    contributingFactors: [
      "Yellowing on lower leaves",
      "Heavy rain over the past 3 days",
      "Early aphid presence",
    ],
    possibleCauses: [
      "Waterlogged soil reducing nutrient uptake",
      "Early-stage nutrient deficiency",
      "Aphid activity stressing new growth",
    ],
    explanation:
      "The combination of lower-leaf yellowing and several days of heavy rain suggests the roots may be sitting in overly wet soil, which limits how well the plant can take up nutrients. The aphids are a secondary, currently minor stressor.",
    recommendedActions: [
      "Improve drainage around the base of the plant",
      "Hold off on additional watering until soil surface dries",
      "Inspect new growth for aphids every 2–3 days",
    ],
    monitoringAdvice:
      "Recheck leaf color in 3–4 days. If yellowing spreads upward or aphid numbers increase, treat as higher priority.",
    nextAssessmentDate: daysAgo(-4),
  },
  {
    id: "risk-2",
    assessmentId: "assessment-2",
    riskLevel: "low",
    confidence: 88,
    contributingFactors: ["Healthy leaf color", "Steady growth", "No pest or disease symptoms"],
    possibleCauses: ["No significant risk factors identified"],
    explanation:
      "All reported indicators are within a healthy range. Growth is steady and there are no visible symptoms of pest or disease pressure.",
    recommendedActions: ["Continue current watering and care routine"],
    monitoringAdvice: "Proceed with the next scheduled weekly assessment.",
    nextAssessmentDate: daysAgo(-3),
  },
  {
    id: "risk-3",
    assessmentId: "assessment-3",
    riskLevel: "low",
    confidence: 91,
    contributingFactors: ["Healthy leaf and stem condition", "Consistent sunlight"],
    possibleCauses: ["No significant risk factors identified"],
    explanation:
      "The plant shows strong, steady growth with no reported pest, disease, or environmental stress.",
    recommendedActions: ["Continue current fertilization schedule"],
    monitoringAdvice: "Proceed with the next scheduled weekly assessment.",
    nextAssessmentDate: daysAgo(-1),
  },
];

export function getCrop(cropId: string): Crop {
  const crop = CROPS.find((c) => c.id === cropId);
  if (!crop) throw new Error(`Unknown crop: ${cropId}`);
  return crop;
}

export function getPlant(plantId: string): FarmerPlant | undefined {
  return FARMER_PLANTS.find((p) => p.id === plantId);
}

export function getPlantAgeDays(plant: FarmerPlant): number {
  const planted = new Date(plant.plantingDate).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - planted) / (1000 * 60 * 60 * 24)));
}

export function getGrowthStage(plant: FarmerPlant, crop: Crop): string {
  const ageDays = getPlantAgeDays(plant);
  const fraction = ageDays / crop.growingDurationDays;
  if (fraction < 0.15) return GROWTH_STAGES[0];
  if (fraction < 0.45) return GROWTH_STAGES[1];
  if (fraction < 0.7) return GROWTH_STAGES[2];
  if (fraction < 1) return GROWTH_STAGES[3];
  return GROWTH_STAGES[4];
}

export function getExpectedHarvestRange(plant: FarmerPlant, crop: Crop): { start: Date; end: Date } {
  const planted = new Date(plant.plantingDate);
  const start = new Date(planted);
  start.setDate(start.getDate() + crop.growingDurationDays);
  const end = new Date(start);
  end.setDate(end.getDate() + crop.harvestWindowDays);
  return { start, end };
}

export function getAssessmentsForPlant(plantId: string): Assessment[] {
  return ASSESSMENTS.filter((a) => a.plantId === plantId).sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );
}

export function getRiskResultForAssessment(assessmentId: string): RiskResult | undefined {
  return RISK_RESULTS.find((r) => r.assessmentId === assessmentId);
}

export function getLatestRiskResultForPlant(plantId: string): RiskResult | undefined {
  const [latest] = getAssessmentsForPlant(plantId);
  if (!latest) return undefined;
  return getRiskResultForAssessment(latest.id);
}

export function getPlantHistory(
  plantId: string,
): { assessment: Assessment; result?: RiskResult }[] {
  return getAssessmentsForPlant(plantId).map((assessment) => ({
    assessment,
    result: getRiskResultForAssessment(assessment.id),
  }));
}

export function formatDate(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

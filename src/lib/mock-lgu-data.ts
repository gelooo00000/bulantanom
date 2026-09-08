import {
  ASSESSMENTS,
  daysAgo,
  FARMER_PLANTS,
  RISK_RESULTS,
  type Assessment,
  type FarmerPlant,
  type RiskResult,
} from "@/lib/mock-data";

export type Farmer = {
  id: string;
  name: string;
  location: string;
};

/**
 * "farmer-demo" mirrors the account used on the Farmer side (farmer@layuan.ph)
 * so the LGU view of that farmer's plants matches what they see on their own
 * dashboard. The other two farmers exist only for LGU-side multi-farmer
 * views and are not reachable from the Farmer routes.
 */
export const FARMERS: Farmer[] = [
  { id: "farmer-demo", name: "Juan Dela Cruz", location: "North Row & Plot B–C, Layuan Farm" },
  { id: "farmer-2", name: "Maria Santos", location: "Plot D, Layuan Farm" },
  { id: "farmer-3", name: "Ramon Villanueva", location: "Plot E, Layuan Farm" },
];

export type FarmerPlantWithOwner = FarmerPlant & { farmerId: string };

const EXTRA_PLANTS: FarmerPlantWithOwner[] = [
  {
    id: "plant-4",
    cropId: "pepper",
    plantingDate: daysAgo(70),
    label: "Pepper · Plot D",
    farmerId: "farmer-2",
  },
  {
    id: "plant-5",
    cropId: "eggplant",
    plantingDate: daysAgo(20),
    label: "Eggplant · Plot E",
    farmerId: "farmer-3",
  },
];

const EXTRA_ASSESSMENTS: Assessment[] = [
  {
    id: "assessment-4",
    plantId: "plant-4",
    submittedAt: daysAgo(2),
    wateringFrequency: "Daily",
    fertilization: "None this week",
    leafCondition: "Spots or lesions",
    stemCondition: "Visible damage or lesions",
    growthCondition: "Stunted or no growth",
    pestSymptoms: "Heavy aphid infestation on most leaves",
    diseaseSymptoms: "Dark lesions spreading across leaves",
    environmentalObservations: "Prolonged flooding in the plot",
    farmerDescription: "Plant looks very unhealthy, leaves dying off.",
  },
  {
    id: "assessment-5",
    plantId: "plant-5",
    submittedAt: daysAgo(4),
    wateringFrequency: "Every 2 days",
    fertilization: "Balanced NPK applied last week",
    leafCondition: "Healthy",
    stemCondition: "Firm, upright",
    growthCondition: "Steady growth",
    pestSymptoms: "None observed",
    diseaseSymptoms: "None observed",
    environmentalObservations: "Sunny, normal rainfall",
    farmerDescription: "No concerns.",
  },
];

const EXTRA_RISK_RESULTS: RiskResult[] = [
  {
    id: "risk-4",
    assessmentId: "assessment-4",
    riskLevel: "high",
    confidence: 89,
    contributingFactors: [
      "Severe leaf lesions and damage",
      "Heavy aphid infestation",
      "Stunted growth",
      "Prolonged flooding",
    ],
    possibleCauses: [
      "Fungal or bacterial infection",
      "Active pest outbreak",
      "Root damage from waterlogging",
    ],
    explanation:
      "Multiple severe indicators are present at once: visible lesions, heavy pest pressure, and stunted growth following prolonged flooding. This combination suggests the plant is under serious, compounding stress.",
    recommendedActions: [
      "Inspect the plant in person as soon as possible",
      "Improve field drainage to reduce standing water",
      "Treat for pests and consider isolating affected plants",
      "Escalate to the LGU Agricultural Officer for a site visit",
    ],
    monitoringAdvice: "Check on this plant daily until symptoms stabilize.",
    nextAssessmentDate: daysAgo(-2),
  },
  {
    id: "risk-5",
    assessmentId: "assessment-5",
    riskLevel: "low",
    confidence: 90,
    contributingFactors: ["Healthy leaf and stem condition", "Steady growth"],
    possibleCauses: ["No significant risk factors identified"],
    explanation: "All reported indicators are within a healthy range.",
    recommendedActions: ["Continue current care routine"],
    monitoringAdvice: "Proceed with the next scheduled weekly assessment.",
    nextAssessmentDate: daysAgo(-3),
  },
];

const ALL_PLANTS: FarmerPlantWithOwner[] = [
  ...FARMER_PLANTS.map((p) => ({ ...p, farmerId: "farmer-demo" })),
  ...EXTRA_PLANTS,
];

const ALL_ASSESSMENTS: Assessment[] = [...ASSESSMENTS, ...EXTRA_ASSESSMENTS];
const ALL_RISK_RESULTS: RiskResult[] = [...RISK_RESULTS, ...EXTRA_RISK_RESULTS];

export type SoilRecommendationRecord = {
  id: string;
  farmerId: string;
  submittedAt: string;
  soilTypeSummary: string;
  recommendedCropNames: string[];
};

export const SOIL_RECOMMENDATION_RECORDS: SoilRecommendationRecord[] = [
  {
    id: "soil-rec-1",
    farmerId: "farmer-demo",
    submittedAt: daysAgo(9),
    soilTypeSummary: "Clay Loam, Dark Brown soil",
    recommendedCropNames: ["Tomato", "Eggplant"],
  },
  {
    id: "soil-rec-2",
    farmerId: "farmer-2",
    submittedAt: daysAgo(15),
    soilTypeSummary: "Sandy, Light Brown soil",
    recommendedCropNames: ["Pepper", "Papaya"],
  },
];

export function getFarmer(farmerId: string): Farmer | undefined {
  return FARMERS.find((f) => f.id === farmerId);
}

export function lguGetAllPlants(): FarmerPlantWithOwner[] {
  return ALL_PLANTS;
}

export function lguGetPlant(plantId: string): FarmerPlantWithOwner | undefined {
  return ALL_PLANTS.find((p) => p.id === plantId);
}

export function lguGetPlantsForFarmer(farmerId: string): FarmerPlantWithOwner[] {
  return ALL_PLANTS.filter((p) => p.farmerId === farmerId);
}

export function lguGetAssessmentsForPlant(plantId: string): Assessment[] {
  return ALL_ASSESSMENTS.filter((a) => a.plantId === plantId).sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );
}

export function lguGetRiskResultForAssessment(assessmentId: string): RiskResult | undefined {
  return ALL_RISK_RESULTS.find((r) => r.assessmentId === assessmentId);
}

export function lguGetLatestRiskResultForPlant(plantId: string): RiskResult | undefined {
  const [latest] = lguGetAssessmentsForPlant(plantId);
  if (!latest) return undefined;
  return lguGetRiskResultForAssessment(latest.id);
}

export function lguGetPlantHistory(
  plantId: string,
): { assessment: Assessment; result?: RiskResult }[] {
  return lguGetAssessmentsForPlant(plantId).map((assessment) => ({
    assessment,
    result: lguGetRiskResultForAssessment(assessment.id),
  }));
}

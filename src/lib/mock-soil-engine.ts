import { CROPS, type Crop } from "@/lib/mock-data";

export const SOIL_COLOR_OPTIONS = [
  { value: "dark-brown", label: "Dark Brown" },
  { value: "reddish-brown", label: "Reddish Brown" },
  { value: "light-brown", label: "Light Brown" },
  { value: "gray", label: "Gray" },
  { value: "black", label: "Black" },
] as const;

export const SOIL_TEXTURE_OPTIONS = [
  { value: "clay", label: "Clay" },
  { value: "sandy", label: "Sandy" },
  { value: "loam", label: "Loam" },
  { value: "silty", label: "Silty" },
  { value: "clay-loam", label: "Clay Loam" },
] as const;

export type SoilRecommendationInput = {
  soilColor: string;
  soilTexture: string;
  phLevel: number;
  moistureLevel: number;
  notes: string;
};

export type CropMatch = {
  crop: Crop;
  reason: string;
};

export type SoilRecommendationResult = {
  soilTypeSummary: string;
  recommendedCrops: CropMatch[];
  explanation: string;
};

function optionLabel(options: readonly { value: string; label: string }[], value: string) {
  return options.find((o) => o.value === value)?.label ?? value;
}

/**
 * Stands in for the eventual soil-classification service. Deterministic and
 * rule-based so the Soil Recommendation UI can be built and demoed before
 * the real backend/AI integration exists.
 */
export function generateMockSoilRecommendation(
  input: SoilRecommendationInput,
): SoilRecommendationResult {
  const textureLabel = input.soilTexture
    ? optionLabel(SOIL_TEXTURE_OPTIONS, input.soilTexture)
    : "Unspecified texture";
  const colorLabel = optionLabel(SOIL_COLOR_OPTIONS, input.soilColor);
  const soilTypeSummary = `${textureLabel}, ${colorLabel} soil`;

  const scored = CROPS.map((crop) => {
    let score = 0;

    if (crop.id === "papaya" && input.phLevel >= 6 && input.phLevel <= 6.5) score += 2;
    if (crop.id === "tomato" && input.phLevel >= 6 && input.phLevel <= 6.8) score += 2;
    if (crop.id === "eggplant" && input.phLevel >= 5.5 && input.phLevel <= 6.5) score += 2;
    if (crop.id === "pepper" && input.phLevel >= 5.5 && input.phLevel <= 7) score += 2;

    if (input.moistureLevel >= 40 && input.moistureLevel <= 70) score += 1;
    if (["loam", "clay-loam"].includes(input.soilTexture)) score += 1;

    return { crop, score };
  }).sort((a, b) => b.score - a.score);

  const recommendedCrops: CropMatch[] = scored.slice(0, 2).map(({ crop }) => ({
    crop,
    reason: `Matches a pH of ${input.phLevel} and ${textureLabel.toLowerCase()} texture typical for productive ${crop.name.toLowerCase()} growth.`,
  }));

  const phDescription =
    input.phLevel < 6 ? "slightly acidic" : input.phLevel > 7 ? "slightly alkaline" : "near-neutral";

  const explanation = `Based on a soil pH of ${input.phLevel} and moisture level of ${input.moistureLevel}%, this ${soilTypeSummary.toLowerCase()} is best suited for crops that tolerate ${phDescription} conditions.`;

  return { soilTypeSummary, recommendedCrops, explanation };
}

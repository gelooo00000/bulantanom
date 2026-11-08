import { apiFetch } from "@/lib/api/client";
import { postMultipart, type AssessmentEligibility } from "@/lib/api/risk-api";

/** A named variety within a crop, e.g. Sweet Corn under Corn. */
export type CropVariant = {
  id: string;
  name: string;
  description: string;
  /** Overrides the parent crop's duration when this variety is planted. */
  growing_duration_days: number;
  harvest_window_days: number;
  search_terms: string[];
};

/**
 * When this crop is normally planted at Layuan Farm.
 *
 * Only the month lists are data the UI tests against; every line of wording
 * comes from Django, so the agronomic text has one home. `null` on a crop
 * with no window on record — render nothing rather than guess.
 */
export type PlantingWindow = {
  preferred_months: number[];
  caution_months: number[];
  /** Pre-formatted, e.g. "February-May". */
  preferred_label: string;
  reason: string;
  risk: string;
  caution_note: string;
};

export type PlantingAdviceStatus = "good" | "caution" | "poor";

/** Django's verdict for one month. Advisory — never moves a harvest date. */
export type PlantingAdvice = {
  status: PlantingAdviceStatus;
  month: number;
  month_name: string;
  headline: string;
  detail: string;
  preferred_months: number[];
  preferred_label: string;
  caution_months: number[];
};

export type BackendCrop = {
  id: string;
  name: string;
  category: "fruit" | "vegetable";
  category_label: string;
  emoji: string;
  growing_duration_days: number;
  harvest_window_days: number;
  description: string;
  search_terms: string[];
  variants: CropVariant[];
  planting_window: PlantingWindow | null;
  /** Weekly-assessment questions that don't fit this crop; the form hides them. */
  not_applicable_questions?: AssessmentQuestion[];
};

export type AssessmentQuestion =
  | "plant_height_cm"
  | "leaf_condition"
  | "flowering_status"
  | "fruiting_status"
  /** Asked of mushrooms only, in place of leaf condition. */
  | "mushroom_condition";

export type BackendPlant = {
  id: number;
  crop: BackendCrop;
  /** Null for crops with no varieties, and for plants recorded before them. */
  variant: CropVariant | null;
  /** Season verdict for the month this plant actually went in the ground. */
  planting_advice: PlantingAdvice | null;
  label: string;
  display_name: string;
  planting_date: string;
  expected_harvest_start: string;
  expected_harvest_end: string;
  status: "GROWING" | "READY_FOR_HARVEST" | "HARVESTED" | "ARCHIVED" | "LOST";
  status_label: string;
  /** When it was marked harvested (ISO datetime); null otherwise. */
  harvested_at?: string | null;
  age_days: number;
  /** Planting date still ahead: a planned planting, not in the ground yet. */
  is_planned: boolean;
  /** Weekly-assessment lock state, decided by Django from stored assessments. */
  assessment_eligibility: AssessmentEligibility;
  /**
   * The final assessment written when it was marked harvested. Null before
   * harvest, and for plants harvested before reports existed.
   */
  harvest_report?: HarvestReport | null;
  /** The loss report, once the plant was reported dead (status LOST). */
  loss_report?: LossReport | null;
  created_at: string;
  updated_at: string;
};

export type HarvestQuality = "GOOD" | "FAIR" | "POOR";
export type HarvestHealth = "HEALTHY" | "MINOR_PROBLEMS" | "DAMAGED";
export type AdviceHelped = "YES" | "A_LITTLE" | "NO";
export type YieldUnit = "KG" | "PIECES" | "SACKS";

/** A plant's harvest report: the Farmer's answers plus what the system recorded. */
export type HarvestReport = {
  id: number;
  quality: HarvestQuality;
  quality_label: string;
  final_health: HarvestHealth;
  final_health_label: string;
  advice_helped: AdviceHelped;
  advice_helped_label: string;
  yield_amount: string | null;
  yield_unit: YieldUnit | "";
  yield_unit_label: string;
  /** The authorized photo endpoint; fetch it with the access token. */
  photo_url: string | null;
  notes: string;
  harvested_on: string;
  days_to_harvest: number;
  expected_days: number;
  timing: "EARLY" | "ON_TIME" | "LATE";
  timing_label: string;
  assessments_count: number;
  highest_risk: "" | "LOW" | "MEDIUM" | "HIGH";
  high_risk_count: number;
  recovered_from_high: boolean;
  created_at: string;
};

export type LossCause =
  | "PEST"
  | "DISEASE"
  | "FLOOD_TYPHOON"
  | "DROUGHT_HEAT"
  | "ANIMALS"
  | "OTHER";
export type LossNoticed = "TODAY" | "THIS_WEEK" | "EARLIER";

/** A plant reported dead: the Farmer's answers plus what the system recorded. */
export type LossReport = {
  id: number;
  cause: LossCause;
  cause_label: string;
  noticed: LossNoticed;
  noticed_label: string;
  photo_url: string | null;
  notes: string;
  lost_at: string;
  age_days: number;
  assessments_count: number;
  last_risk: "" | "LOW" | "MEDIUM" | "HIGH";
  highest_risk: "" | "LOW" | "MEDIUM" | "HIGH";
  high_risk_count: number;
  /** BulanTanom had read Medium or High risk before the loss. */
  warned_before: boolean;
};

export type LossAnswers = {
  cause: LossCause;
  noticed: LossNoticed;
  notes?: string;
  photo?: File | null;
};

export type HarvestAnswers = {
  quality: HarvestQuality;
  final_health: HarvestHealth;
  advice_helped: AdviceHelped;
  yield_amount?: string;
  yield_unit?: YieldUnit;
  notes?: string;
  photo?: File | null;
};

/** AI-generated educational content. Never the source of harvest dates. */
export type CropIntelligence = {
  crop_overview: string;
  growing_notes: string[];
  care_guidance: string[];
  harvest_guidance: string;
  important_factors: string[];
  model_name: string;
  generated_at: string;
};

/** Calculated by Django from the crop table — not by Gemini. */
export type HarvestWindow = {
  planting_date: string;
  expected_harvest_start: string;
  expected_harvest_end: string;
  growing_duration_days: number;
  harvest_window_days: number;
  source: string;
};

export type CropIntelligenceResponse = {
  crop: BackendCrop;
  /** Echoes back the variety the window was calculated for, if any. */
  variant: CropVariant | null;
  harvest_window: HarvestWindow | null;
  intelligence: CropIntelligence | null;
  intelligence_generated_now: boolean;
  unavailable_reason: string | null;
};

export function fetchCrops(accessToken: string): Promise<BackendCrop[]> {
  return apiFetch("/farmer/crops/", { accessToken });
}

export function fetchCropIntelligence(
  accessToken: string,
  cropId: string,
  plantingDate: string,
  /**
   * Required for the preview to match what gets saved. Without it the
   * harvest window came back computed from the parent crop while the
   * created plant used the variety's own durations — 25 days apart for
   * Sweet Corn against Corn.
   */
  variantId?: string | null,
  /** The app language; Gemini writes the guidance in it. */
  language: "en" | "fil" | "bik" = "en",
): Promise<CropIntelligenceResponse> {
  const params = new URLSearchParams({ planting_date: plantingDate, lang: language });
  if (variantId) params.set("variant", variantId);
  return apiFetch(`/farmer/crops/${cropId}/intelligence/?${params}`, { accessToken });
}

export function fetchPlants(accessToken: string): Promise<BackendPlant[]> {
  return apiFetch("/farmer/plants/", { accessToken });
}

export function fetchPlant(accessToken: string, plantId: string): Promise<BackendPlant> {
  return apiFetch(`/farmer/plants/${plantId}/`, { accessToken });
}

/** The farmer is taken from the auth token server-side — never sent here. */
export function createPlant(
  accessToken: string,
  payload: {
    crop_id: string;
    planting_date: string;
    label?: string;
    variant_id?: string | null;
  },
): Promise<BackendPlant> {
  return apiFetch("/farmer/plants/", { method: "POST", body: payload, accessToken });
}

export function deletePlant(accessToken: string, plantId: number): Promise<void> {
  return apiFetch(`/farmer/plants/${plantId}/`, { method: "DELETE", accessToken });
}

/**
 * Marks a plant harvested together with its harvest report (the final
 * assessment). Multipart, because the report may carry a photo.
 */
export function harvestPlant(
  accessToken: string,
  plantId: number,
  answers: HarvestAnswers,
): Promise<BackendPlant> {
  const body = new FormData();
  body.append("quality", answers.quality);
  body.append("final_health", answers.final_health);
  body.append("advice_helped", answers.advice_helped);
  if (answers.yield_amount) {
    body.append("yield_amount", answers.yield_amount);
    if (answers.yield_unit) body.append("yield_unit", answers.yield_unit);
  }
  if (answers.notes?.trim()) body.append("notes", answers.notes.trim());
  if (answers.photo) body.append("photo", answers.photo);
  return postMultipart(`/farmer/plants/${plantId}/harvest/`, accessToken, body);
}

/**
 * Reports that a plant died. The plant and its history are kept; it moves to
 * the Archive's Lost list.
 */
export function reportPlantLost(
  accessToken: string,
  plantId: number,
  answers: LossAnswers,
): Promise<BackendPlant> {
  const body = new FormData();
  body.append("cause", answers.cause);
  body.append("noticed", answers.noticed);
  if (answers.notes?.trim()) body.append("notes", answers.notes.trim());
  if (answers.photo) body.append("photo", answers.photo);
  return postMultipart(`/farmer/plants/${plantId}/lost/`, accessToken, body);
}

/** Harvested or lost: finished, shown only in the Archive. */
export function isFinished(plant: BackendPlant): boolean {
  return plant.status === "HARVESTED" || plant.status === "ARCHIVED" || plant.status === "LOST";
}

/** Whether a harvested or lost plant may still go back to growing (24 hours, if reported). */
export function canRestoreHarvest(plant: BackendPlant, now = Date.now()): boolean {
  if (plant.status === "LOST") {
    if (!plant.loss_report) return true;
    return now - new Date(plant.loss_report.lost_at).getTime() < 24 * 60 * 60 * 1000;
  }
  if (plant.status !== "HARVESTED") return false;
  if (!plant.harvest_report || !plant.harvested_at) return true;
  return now - new Date(plant.harvested_at).getTime() < 24 * 60 * 60 * 1000;
}

/**
 * Undoes a harvest (back to growing); allowed for 24 hours after a reported
 * harvest. Marking harvested goes through `harvestPlant`, never here.
 */
export function setPlantStatus(
  accessToken: string,
  plantId: number,
  status: "GROWING",
): Promise<BackendPlant> {
  return apiFetch(`/farmer/plants/${plantId}/`, {
    method: "PATCH",
    body: { status },
    accessToken,
  });
}

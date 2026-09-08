import { apiFetch, refreshAccessToken } from "@/lib/api/client";
import type { BackendPlant } from "@/lib/api/plants-api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type RiskStatus = "pending" | "completed" | "failed";

export type RiskFactor = { factor: string; severity: string; explanation: string };

export type BackendRisk = {
  risk_level: RiskLevel | null;
  risk_level_label: string | null;
  status: RiskStatus;
  summary: string;
  reality_vs_expectation: { expected?: string; observed?: string; assessment?: string };
  visual_observations: string[];
  risk_factors: RiskFactor[];
  possible_causes: string[];
  recommended_actions: string[];
  monitoring_advice: string[];
  limitations: string[];
  next_assessment_days: number | null;
  image_analyzed: boolean;
  model_name: string;
  failure_reason: string;
  generated_at: string;
};

/** Server-decided weekly-assessment schedule. Never computed in the browser. */
export type AssessmentEligibility = {
  can_assess: boolean;
  last_assessment_date: string | null;
  next_assessment_date: string | null;
  days_remaining: number;
  interval_days: number;
};

export type EvidenceVerdict = "match" | "mismatch" | "no_plant" | "unclear";

export type EvidenceValidation = {
  evidence_valid: boolean;
  verdict: EvidenceVerdict;
  confidence: number;
  detected_subject: string;
  expected_crop: string;
  reason: string;
  message: string;
  /** Present only when the photo was accepted; replays validation at submit. */
  evidence_token?: string;
};

export type BackendAssessment = {
  id: number;
  plant_id: number;
  plant_display_name: string;
  crop_name: string;
  crop_emoji: string;
  assessment_date: string;
  plant_age_days: number;
  plant_height_cm: string | null;
  growth_condition: string;
  health_condition: string;
  leaf_condition: string;
  flowering_status: string;
  fruiting_status: string;
  watering_frequency: string;
  soil_moisture: string;
  pest_observation: string;
  disease_observation: string;
  environmental_observations: string;
  notes: string;
  evidence_image_url: string | null;
  evidence_validated: boolean;
  evidence_validation: Partial<EvidenceValidation>;
  created_at: string;
  risk: BackendRisk | null;
  /** Present only on LGU endpoints. */
  farmer?: { id: number; full_name: string; email: string };
};

export type FarmerRiskOverview = {
  counts: { LOW: number; MEDIUM: number; HIGH: number; unassessed: number };
  plants: { plant: BackendPlant; latest_assessment: BackendAssessment | null }[];
};

/**
 * Error from a multipart call, carrying the status and the parsed body so
 * callers can react to the specific outcome (weekly lock, rejected evidence,
 * validation outage) rather than only showing a string.
 */
export class AssessmentApiError extends Error {
  status: number;
  payload: Record<string, unknown>;

  constructor(message: string, status: number, payload: Record<string, unknown>) {
    super(message);
    this.name = "AssessmentApiError";
    this.status = status;
    this.payload = payload;
  }
}

/**
 * Multipart POST. `apiFetch` always sends JSON, so file uploads use fetch
 * directly — but the auth header and error normalisation follow the same
 * contract, and the raw body is preserved on the error.
 */
async function postMultipart<T>(
  path: string,
  accessToken: string,
  body: FormData,
): Promise<T> {
  const send = (token: string) =>
    fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      credentials: "include",
      // No Content-Type header: the browser sets the multipart boundary.
      headers: { Authorization: `Bearer ${token}` },
      body,
    });

  let response: Response;
  try {
    response = await send(accessToken);

    // Uploads are the longest-running action a Farmer performs, so they are
    // the most likely to outlive a 15-minute access token. Refresh once and
    // replay rather than losing a completed assessment and its photo.
    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) response = await send(refreshed);
    }
  } catch {
    throw new AssessmentApiError(
      "Unable to connect to BulanTanom. Please try again.",
      0,
      {},
    );
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  const record = (data ?? {}) as Record<string, unknown>;

  if (!response.ok) {
    if (typeof record.detail === "string") {
      throw new AssessmentApiError(record.detail, response.status, record);
    }
    for (const value of Object.values(record)) {
      if (Array.isArray(value) && typeof value[0] === "string") {
        throw new AssessmentApiError(value[0], response.status, record);
      }
    }
    throw new AssessmentApiError(
      response.status >= 500
        ? "Something went wrong. Please try again later."
        : "Please check the assessment details and try again.",
      response.status,
      record,
    );
  }

  return data as T;
}

/**
 * Checks the photo against the plant's crop before the assessment is
 * submitted. Nothing is saved by this call — a rejected photo stays in the
 * form so the Farmer can replace it.
 */
export function validateEvidence(
  accessToken: string,
  plantId: number,
  evidenceImage: File,
): Promise<EvidenceValidation> {
  const body = new FormData();
  body.append("evidence_image", evidenceImage);
  return postMultipart(`/farmer/plants/${plantId}/evidence/validate/`, accessToken, body);
}

export function submitAssessment(
  accessToken: string,
  plantId: number,
  fields: Record<string, string>,
  evidenceImage: File | null,
  evidenceValidationToken?: string,
): Promise<BackendAssessment> {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== "" && value !== null && value !== undefined) body.append(key, value);
  }
  // Only attach the image if one is actually selected — a removed preview
  // must never be uploaded.
  if (evidenceImage) body.append("evidence_image", evidenceImage);
  // Proof this exact photo already passed validation, so the server does not
  // pay for a second Gemini call. It re-validates if the token is absent or
  // does not match, so this can only save time, never bypass the check.
  if (evidenceValidationToken) body.append("evidence_token", evidenceValidationToken);

  return postMultipart(`/farmer/plants/${plantId}/assessments/`, accessToken, body);
}

/** The authoritative "can this plant be assessed today?" answer. */
export function fetchAssessmentEligibility(
  accessToken: string,
  plantId: number | string,
): Promise<AssessmentEligibility> {
  return apiFetch(`/farmer/plants/${plantId}/assessments/eligibility/`, { accessToken });
}

export function fetchPlantAssessments(
  accessToken: string,
  plantId: number | string,
): Promise<BackendAssessment[]> {
  return apiFetch(`/farmer/plants/${plantId}/assessments/`, { accessToken });
}

export function fetchAssessment(
  accessToken: string,
  assessmentId: number | string,
): Promise<BackendAssessment> {
  return apiFetch(`/farmer/assessments/${assessmentId}/`, { accessToken });
}

/**
 * Re-runs the AI evaluation for an assessment whose analysis failed. The
 * stored answers and evidence photo are reused — this never edits them.
 */
export function reanalyzeAssessment(
  accessToken: string,
  assessmentId: number,
): Promise<BackendAssessment> {
  return apiFetch(`/farmer/assessments/${assessmentId}/reanalyze/`, {
    method: "POST",
    accessToken,
  });
}

export function fetchFarmerRisk(accessToken: string): Promise<FarmerRiskOverview> {
  return apiFetch("/farmer/risk/", { accessToken });
}

export function fetchFarmerRiskHistory(accessToken: string): Promise<BackendAssessment[]> {
  return apiFetch("/farmer/risk/history/", { accessToken });
}

// ---- LGU (read-only) -------------------------------------------------------

export function fetchLguRiskOverview(accessToken: string): Promise<{
  counts: { LOW: number; MEDIUM: number; HIGH: number; unassessed: number };
  cases: BackendAssessment[];
}> {
  return apiFetch("/lgu/risk/overview/", { accessToken });
}

export function fetchLguHighRisk(accessToken: string): Promise<BackendAssessment[]> {
  return apiFetch("/lgu/risk/high-risk/", { accessToken });
}

export function fetchLguAssessmentHistory(
  accessToken: string,
): Promise<BackendAssessment[]> {
  return apiFetch("/lgu/assessments/history/", { accessToken });
}

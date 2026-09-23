"""
Plant Risk Evaluation — the isolated Gemini boundary for weekly assessments.

Architecture rules:

* Django computes the *facts* (plant age, expected stage, harvest window)
  from the Crop table and passes them in. Gemini interprets; it never
  calculates dates or invents measurements.
* Multimodal: the evidence image is sent alongside the structured
  observations so visual findings can be compared with what the Farmer
  reported.
* Structured output with a strict enum for risk_level — a malformed or
  missing level is rejected rather than coerced.
* Safe to fail. Any failure returns None; the caller stores the assessment
  with status FAILED and never fabricates a risk level.
* The API key is read from settings and never logged.
"""

from __future__ import annotations

import json
import logging

from django.conf import settings

from .durations import human_duration
from .gemini_models import generate_with_fallback

logger = logging.getLogger(__name__)

# A plant this young is still establishing: "nothing wrong yet" is not the
# same as "healthy", so the AI may answer INCONCLUSIVE instead of LOW.
EARLY_STAGE_DAYS = 14

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "risk_level": {
            "type": "string",
            "enum": ["LOW", "MEDIUM", "HIGH", "INCONCLUSIVE"],
        },
        "planting_date_mismatch": {
            "type": "boolean",
            "description": (
                "True only when the photo clearly shows a plant at a very "
                "different stage from the recorded age."
            ),
        },
        "summary": {"type": "string"},
        "reality_vs_expectation": {
            "type": "object",
            "properties": {
                "expected": {"type": "string"},
                "observed": {"type": "string"},
                "assessment": {"type": "string"},
            },
            "required": ["expected", "observed", "assessment"],
        },
        "visual_observations": {"type": "array", "items": {"type": "string"}},
        "risk_factors": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "factor": {"type": "string"},
                    "severity": {"type": "string", "enum": ["low", "medium", "high"]},
                    "explanation": {"type": "string"},
                },
                "required": ["factor", "severity", "explanation"],
            },
        },
        "possible_causes": {"type": "array", "items": {"type": "string"}},
        "recommended_actions": {"type": "array", "items": {"type": "string"}},
        "monitoring_advice": {"type": "array", "items": {"type": "string"}},
        "next_assessment_days": {"type": "integer"},
        "limitations": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "risk_level",
        "summary",
        "reality_vs_expectation",
        "risk_factors",
        "recommended_actions",
        "next_assessment_days",
        "planting_date_mismatch",
    ],
}

SYSTEM_INSTRUCTION = """
You are the BulanTanom Crop Risk Evaluation Assistant, supporting
smallholder farmers at Layuan Nature Integrated Farm in Bulan, Sorsogon,
Philippines.

Evaluate the supplied crop information, plant age, farmer observations, and
plant-condition image. Compare the ACTUAL reported condition against what
would normally be EXPECTED for this crop at this age.

Rules you must follow:

- Do NOT invent measurements, yields, or agricultural facts. The crop
  duration figures given to you are the system's own configured values;
  treat them as the only quantitative baseline you have.
- If the system has no authoritative expectation for a specific measurement
  (for example an exact expected height), say so plainly instead of
  inventing a number. Use phrasing like "based on the available crop
  information".
- Do NOT diagnose diseases with certainty. Separate what is OBSERVED from
  what is a POSSIBLE CAUSE. "Several leaves appear yellow" is an
  observation; "this is nitrogen deficiency" is not acceptable.
- If an image is supplied, base `visual_observations` only on what is
  actually visible. If the image is blurry, dark, distant, obstructed or
  incomplete, say so in `limitations` and rely more on the written report.
  A poor-quality image is NOT by itself a reason to raise the risk level.
- If no image is supplied, leave `visual_observations` empty and note the
  absence in `limitations`.
- Weigh the whole picture. Do not escalate to HIGH on a single symptom.
    LOW          = developing broadly as expected, no significant warning
                   signs.
    MEDIUM       = some deviation from expectation, or moderate warning
                   signs that warrant monitoring.
    HIGH         = significant deviation, several concerning observations,
                   or severe visible warning signs needing prompt attention.
    INCONCLUSIVE = there is not enough to judge yet. Use this, and say why
                   in `summary`, when the plant is in its first weeks and
                   the farmer reports no problem: a seedling that has barely
                   emerged has no growth history to compare against, so LOW
                   would overstate what you actually know. You are told when
                   the plant is in this early stage. Do NOT use INCONCLUSIVE
                   as a way to avoid reporting a real problem — if the
                   farmer reports pests, disease, wilting or damage, or the
                   photo shows it, give a real level however young the plant
                   is.
- `planting_date_mismatch`: set this true when the photo clearly shows a
  plant at a very different stage from the age you were given — mature fruit
  on a plant recorded as days old, or bare soil for one recorded as months
  old. When you do, set `risk_level` to INCONCLUSIVE and explain in
  `summary` that the planting date or the photo may be wrong. A mismatch is
  a record-keeping problem, not a danger to the crop: never report it as
  HIGH risk. Ordinary variation in growth is NOT a mismatch — only use this
  when the two cannot both be true.
- Do not claim to replace an agricultural extension officer or agronomist.
- Keep advice practical and specific for a working smallholder farmer.
- Say durations the way a farmer says them — "about 4 years", "three
  months" — using the readable forms given to you. Never quote raw day
  counts like "1460 days".
- A tree crop years away from its first harvest is behaving normally. Judge
  it on how the young tree is establishing, not on the absence of fruit.
- `risk_level` must be exactly LOW, MEDIUM or HIGH.
""".strip()


def is_configured() -> bool:
    return bool(settings.GEMINI_API_KEY)


def _expected_stage(crop, age_days: int) -> str:
    """
    Coarse expected stage derived from the system's own configured growing
    duration. Deliberately descriptive, not a precise agronomic claim.
    """
    duration = crop.growing_duration_days or 0
    if duration <= 0:
        return "unknown (no growing duration configured for this crop)"
    fraction = age_days / duration
    if fraction < 0.15:
        return "early establishment / seedling"
    if fraction < 0.45:
        return "vegetative growth"
    if fraction < 0.70:
        return "flowering / early reproductive"
    if fraction < 1.0:
        return "fruiting / maturing"
    return "harvest-ready or past expected harvest start"


def build_context(assessment) -> dict:
    """The structured EXPECTED + ACTUAL payload handed to Gemini."""
    plant = assessment.plant
    crop = plant.crop
    return {
        "crop": {
            "name": crop.name,
            "category": crop.get_category_display(),
            "growing_duration_days": crop.growing_duration_days,
            # How to say it. A tree crop is years from harvest, and "1460
            # days" is not how anyone reports that.
            "growing_duration_readable": human_duration(crop.growing_duration_days),
            "harvest_window_days": crop.harvest_window_days,
            "expected_growth_stage": _expected_stage(crop, assessment.plant_age_days),
            "expected_harvest_start": plant.expected_harvest_start.isoformat(),
            "expected_harvest_end": plant.expected_harvest_end.isoformat(),
            "system_description": crop.description,
        },
        "plant": {
            "planting_date": plant.planting_date.isoformat(),
            "assessment_date": assessment.assessment_date.isoformat(),
            "age_days": assessment.plant_age_days,
            "age_readable": human_duration(assessment.plant_age_days),
            # Below this the plant is still establishing and an absent
            # problem is not yet evidence that all is well.
            "early_establishment_stage": assessment.plant_age_days <= EARLY_STAGE_DAYS,
        },
        "farmer_assessment": {
            "plant_height_cm": (
                float(assessment.plant_height_cm)
                if assessment.plant_height_cm is not None
                else None
            ),
            "growth_condition": assessment.get_growth_condition_display(),
            "health_condition": assessment.get_health_condition_display(),
            "leaf_condition": assessment.get_leaf_condition_display(),
            "flowering_status": assessment.get_flowering_status_display() or None,
            "fruiting_status": assessment.get_fruiting_status_display() or None,
            "watering_frequency": assessment.get_watering_frequency_display(),
            "soil_moisture": assessment.get_soil_moisture_display() or None,
            "pest_observation": assessment.pest_observation or "none reported",
            "disease_observation": assessment.disease_observation or "none reported",
            "environmental_observations": assessment.environmental_observations or "none reported",
            "notes": assessment.notes or "none provided",
        },
        "image_evidence": bool(assessment.evidence_image),
        # The photo has already passed a separate check confirming it shows
        # this crop, so the risk evaluation can treat it as genuine evidence
        # rather than re-litigating what plant it is.
        "image_evidence_verified": assessment.evidence_validated,
        "image_detected_subject": (assessment.evidence_validation or {}).get(
            "detected_subject"
        ),
    }


def _validate(payload) -> dict | None:
    if not isinstance(payload, dict):
        return None

    level = payload.get("risk_level")
    if level not in ("LOW", "MEDIUM", "HIGH", "INCONCLUSIVE"):
        # Never coerce — an unusable level means the evaluation failed.
        return None

    summary = payload.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        return None

    def _str_list(key):
        value = payload.get(key)
        if not isinstance(value, list):
            return []
        return [v.strip() for v in value if isinstance(v, str) and v.strip()]

    rve = payload.get("reality_vs_expectation")
    rve = rve if isinstance(rve, dict) else {}

    factors = []
    raw_factors = payload.get("risk_factors")
    if isinstance(raw_factors, list):
        for item in raw_factors:
            if not isinstance(item, dict):
                continue
            factor = str(item.get("factor", "")).strip()
            if not factor:
                continue
            severity = str(item.get("severity", "")).strip().lower()
            factors.append(
                {
                    "factor": factor,
                    "severity": severity if severity in ("low", "medium", "high") else "low",
                    "explanation": str(item.get("explanation", "")).strip(),
                }
            )

    next_days = payload.get("next_assessment_days")
    if not isinstance(next_days, int) or not (1 <= next_days <= 60):
        next_days = 7

    mismatch = payload.get("planting_date_mismatch") is True

    return {
        "risk_level": "INCONCLUSIVE" if mismatch else level,
        "date_mismatch": mismatch,
        "summary": summary.strip(),
        "reality_vs_expectation": {
            "expected": str(rve.get("expected", "")).strip(),
            "observed": str(rve.get("observed", "")).strip(),
            "assessment": str(rve.get("assessment", "")).strip(),
        },
        "visual_observations": _str_list("visual_observations"),
        "risk_factors": factors,
        "possible_causes": _str_list("possible_causes"),
        "recommended_actions": _str_list("recommended_actions"),
        "monitoring_advice": _str_list("monitoring_advice"),
        "limitations": _str_list("limitations"),
        "next_assessment_days": next_days,
    }


def evaluate_assessment(assessment) -> dict | None:
    """
    Runs the Gemini risk evaluation. Returns validated structured data, or
    None on any failure (caller must record FAILED, not a fake risk level).
    """
    if not is_configured():
        logger.info("Risk evaluation skipped: GEMINI_API_KEY not configured.")
        return None

    try:
        from google import genai
        from google.genai import types
    except Exception:
        logger.exception("google-genai SDK unavailable.")
        return None

    context = build_context(assessment)
    parts: list = [
        "Evaluate this plant's condition against expectations for its crop and age.\n\n"
        + json.dumps(context, indent=2)
    ]

    image_analyzed = False
    if assessment.evidence_image:
        try:
            with assessment.evidence_image.open("rb") as fh:
                image_bytes = fh.read()
            mime = "image/png" if assessment.evidence_image.name.lower().endswith(".png") else "image/jpeg"
            parts.append(types.Part.from_bytes(data=image_bytes, mime_type=mime))
            parts.append(
                "The attached photo is the farmer's plant-condition evidence for this "
                "assessment. Describe only what is genuinely visible."
            )
            image_analyzed = True
        except Exception as exc:
            # A broken image must not sink the whole evaluation.
            logger.warning("Evidence image unreadable: %s: %s", type(exc).__name__, exc)

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        response_mime_type="application/json",
        response_schema=RESPONSE_SCHEMA,
        temperature=0.2,
        # This call never uses tools; leaving automatic function calling on
        # only adds SDK overhead and a warning on every request.
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        http_options=types.HttpOptions(
            timeout=settings.GEMINI_RISK_TIMEOUT_SECONDS * 1000
        ),
    )

    # An overloaded (503) or out-of-quota (429) model is skipped for the next
    # configured one; retrying the same model only burns its daily quota.
    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
    except Exception as exc:
        logger.warning("Gemini client could not be created: %s", type(exc).__name__)
        return None
    response, model = generate_with_fallback(
        client, contents=parts, config=config, label="risk evaluation"
    )

    if response is None:
        return None

    parsed = getattr(response, "parsed", None)
    if parsed is None:
        raw = (getattr(response, "text", "") or "").strip()
        if not raw:
            logger.warning("Gemini returned an empty risk response.")
            return None
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("Gemini returned non-JSON risk content.")
            return None

    validated = _validate(parsed)
    if validated is None:
        logger.warning("Gemini risk response failed validation.")
        return None

    validated["image_analyzed"] = image_analyzed
    # The model that actually answered, recorded on the RiskAssessment.
    validated["model_name"] = model
    return validated

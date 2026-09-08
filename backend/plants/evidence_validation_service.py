"""
Plant Evidence Validation — a Gemini boundary kept separate from risk
evaluation (`risk_evaluation_service.py`) and from crop information
(`crop_intelligence_service.py`).

Its single job: decide whether an uploaded photo plausibly shows the crop the
Farmer selected, *before* any risk evaluation runs.

Architecture rules:

* Structured output with a strict verdict enum. Free-form text is never
  trusted; anything that fails validation is treated as "could not verify".
* Confidence is enforced in Django, not left to the model's own wording — a
  low-confidence "match" is downgraded to `unclear`, so the system never
  overclaims certainty on an ambiguous photo.
* Poor image quality is reported as its own verdict, never as a crop
  mismatch: "I can't tell" and "that's the wrong plant" are different
  answers and get different messages.
* Fail closed. If Gemini is unavailable this returns None and the caller
  must reject the submission — it must never assume the evidence is valid.
* The API key is read from settings and never logged.
"""

from __future__ import annotations

import json
import logging
import time

from django.conf import settings

logger = logging.getLogger(__name__)

# Below this, a "match" is not trusted — reported as unclear rather than
# accepted, so an ambiguous photo never passes as verified evidence.
MIN_MATCH_CONFIDENCE = 0.55

GEMINI_MAX_ATTEMPTS = 3
GEMINI_RETRY_DELAY_SECONDS = 1.5
_RETRYABLE_MARKERS = (
    "429",
    "503",
    "504",
    "UNAVAILABLE",
    "DEADLINE_EXCEEDED",
    "RESOURCE_EXHAUSTED",
    "overloaded",
)

VERDICTS = ("match", "mismatch", "no_plant", "unclear")

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": list(VERDICTS)},
        "confidence": {"type": "number"},
        "detected_subject": {"type": "string"},
        "reason": {"type": "string"},
    },
    "required": ["verdict", "confidence", "detected_subject", "reason"],
}

SYSTEM_INSTRUCTION = """
You verify whether a farmer's uploaded photo actually shows the crop they
selected in BulanTanom, an agricultural monitoring system for Layuan Nature
Integrated Farm in Bulan, Sorsogon, Philippines.

You are NOT diagnosing plant health here. Your only question is: does this
photo plausibly show the expected crop?

Choose exactly one verdict:

- "match"     — the photo plausibly shows the expected crop. Related plant
                parts count: a close-up of leaves, stems, flowers or fruit of
                that crop is a match, as is a field or row planting of it.
- "mismatch"  — a plant is clearly visible, but it is clearly a different
                crop from the expected one.
- "no_plant"  — the photo shows no crop plant at all: rocks, bare soil, empty
                ground, buildings, vehicles, people, indoor objects,
                screenshots, or other unrelated subjects.
- "unclear"   — a plant may be present but the photo is too blurry, too dark,
                too distant, too obstructed, or too cropped to tell which crop
                it is.

Rules:
- `confidence` is your confidence in the verdict, from 0.0 to 1.0. Be honest.
  Many crops look similar as young seedlings; if you cannot really tell them
  apart, that is "unclear" with modest confidence, NOT a confident "match"
  and NOT a "mismatch".
- Never claim certainty you do not have. Do not say a plant "is definitely"
  the expected crop when the photo is ambiguous.
- Prefer "unclear" over "mismatch" when the limiting factor is image quality
  rather than the plant itself being visibly a different species.
- `detected_subject` is a short plain description of what you actually see
  ("papaya plant", "tomato seedlings", "pile of rocks", "blurry green
  foliage"). Describe what is there, not what you expected.
- `reason` is one or two plain sentences a farmer would understand. No
  jargon, no hedging boilerplate.
- Judge only the photo. Do not infer the crop from the expected-crop name.
""".strip()


def is_configured() -> bool:
    return bool(settings.GEMINI_API_KEY)


def _is_retryable(exc: Exception) -> bool:
    """True for transient upstream saturation, not timeouts or bad requests."""
    if "timeout" in type(exc).__name__.lower():
        return False
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    if code in (429, 503, 504):
        return True
    return any(marker in str(exc) for marker in _RETRYABLE_MARKERS)


def build_context(crop) -> dict:
    """
    What Gemini is told about the expectation.

    Deliberately crop metadata only — no farmer name, email, id, tokens or
    any other account information is ever sent.
    """
    return {
        "expected_crop": crop.name,
        "crop_category": crop.get_category_display(),
        "crop_description": crop.description,
        "typical_growing_duration_days": crop.growing_duration_days,
        "also_known_as": list(crop.search_terms or []),
    }


def _message_for(verdict: str, crop_name: str) -> str:
    """Farmer-facing copy. Fixed per verdict so wording stays consistent."""
    if verdict == "match":
        return "Plant evidence accepted."
    if verdict == "mismatch":
        return f"Please upload a clear photo of your {crop_name.lower()} plant."
    if verdict == "no_plant":
        return f"Please upload a photo showing your {crop_name.lower()} plant."
    return "Please upload a clearer photo showing the plant."


def _validate(payload, crop) -> dict | None:
    """
    Turn a raw model response into a trusted result, or None if unusable.

    `evidence_valid` is decided here, never read from the model — it requires
    both a "match" verdict and sufficient confidence.
    """
    if not isinstance(payload, dict):
        return None

    verdict = payload.get("verdict")
    if verdict not in VERDICTS:
        return None

    raw_confidence = payload.get("confidence")
    if not isinstance(raw_confidence, (int, float)) or isinstance(raw_confidence, bool):
        return None
    confidence = round(min(1.0, max(0.0, float(raw_confidence))), 2)

    reason = str(payload.get("reason", "")).strip()
    if not reason:
        return None

    detected = str(payload.get("detected_subject", "")).strip() or "unidentified subject"

    # A weakly-held "match" is not evidence — downgrade rather than accept.
    if verdict == "match" and confidence < MIN_MATCH_CONFIDENCE:
        verdict = "unclear"
        reason = (
            f"The photo may show {detected}, but it is not clear enough to confirm "
            f"it is {crop.name.lower()}."
        )

    return {
        "evidence_valid": verdict == "match",
        "verdict": verdict,
        "confidence": confidence,
        "detected_subject": detected,
        "expected_crop": crop.name,
        "reason": reason,
        "message": _message_for(verdict, crop.name),
    }


def validate_crop_evidence(crop, image_bytes: bytes, mime_type: str) -> dict | None:
    """
    Ask Gemini whether `image_bytes` plausibly shows `crop`.

    Returns the validated result dict, or None if the check could not be
    performed (not configured, SDK missing, upstream failure, unusable
    response). None means "unknown" — callers must reject, never accept.
    """
    if not is_configured():
        logger.info("Evidence validation skipped: GEMINI_API_KEY not configured.")
        return None

    if not image_bytes:
        return None

    try:
        from google import genai
        from google.genai import types
    except Exception:
        logger.exception("google-genai SDK unavailable.")
        return None

    context = build_context(crop)
    parts = [
        "Does this photo show the expected crop?\n\n" + json.dumps(context, indent=2),
        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
    ]

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        response_mime_type="application/json",
        response_schema=RESPONSE_SCHEMA,
        temperature=0.1,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        http_options=types.HttpOptions(
            timeout=settings.GEMINI_EVIDENCE_TIMEOUT_SECONDS * 1000
        ),
    )

    response = None
    for attempt in range(GEMINI_MAX_ATTEMPTS):
        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL, contents=parts, config=config
            )
            break
        except Exception as exc:
            retryable = _is_retryable(exc)
            logger.warning(
                "Evidence validation failed (attempt %d/%d, retryable=%s): %s: %s",
                attempt + 1,
                GEMINI_MAX_ATTEMPTS,
                retryable,
                type(exc).__name__,
                exc,
            )
            if not retryable or attempt == GEMINI_MAX_ATTEMPTS - 1:
                return None
            time.sleep(GEMINI_RETRY_DELAY_SECONDS * (attempt + 1))

    if response is None:
        return None

    parsed = getattr(response, "parsed", None)
    if parsed is None:
        raw = (getattr(response, "text", "") or "").strip()
        if not raw:
            logger.warning("Evidence validation returned an empty response.")
            return None
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("Evidence validation returned non-JSON content.")
            return None

    result = _validate(parsed, crop)
    if result is None:
        logger.warning("Evidence validation response failed schema validation.")
    return result

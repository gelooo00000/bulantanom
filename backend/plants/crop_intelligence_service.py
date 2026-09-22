"""
Crop Intelligence — the single, isolated boundary between BulanTanom and
Gemini. No other module may call the Gemini SDK.

Design rules enforced here:

* Gemini is an *explanation* layer, never the database. Harvest windows are
  computed by `Plant.calculate_harvest_window()` from the Crop table and
  passed *into* the prompt as facts; Gemini is explicitly told not to
  invent or override dates.
* Structured output only — a response JSON schema is supplied so the API
  returns predictable fields instead of free-form prose.
* Safe to fail. Every failure path returns `None`, and callers must treat a
  missing result as "temporarily unavailable" and still allow the Farmer to
  save their plant.
* The API key is read from Django settings (env) and never logged.
"""

from __future__ import annotations

import logging

from django.conf import settings
from django.utils import timezone

from .models import CropIntelligence

logger = logging.getLogger(__name__)

# Requested JSON shape. Kept in one place so the serializer, the model and
# the frontend all agree on the contract.
RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "crop_overview": {
            "type": "string",
            "description": "2-4 sentence plain-language overview of the crop.",
        },
        "growing_notes": {
            "type": "array",
            "items": {"type": "string"},
            "description": "3-5 short practical growing characteristics.",
        },
        "care_guidance": {
            "type": "array",
            "items": {"type": "string"},
            "description": "3-5 short, actionable care tips for a smallholder farmer.",
        },
        "harvest_guidance": {
            "type": "string",
            "description": (
                "How to tell the crop is ready, and why the calculated window is "
                "an estimate rather than a guaranteed date."
            ),
        },
        "important_factors": {
            "type": "array",
            "items": {"type": "string"},
            "description": "3-5 factors that can shift harvest timing or yield.",
        },
    },
    "required": [
        "crop_overview",
        "growing_notes",
        "care_guidance",
        "harvest_guidance",
        "important_factors",
    ],
}

SYSTEM_INSTRUCTION = """
You are BulanTanom's Crop Intelligence assistant, helping smallholder
farmers at Layuan Nature Integrated Farm in Bulan, Sorsogon, Philippines.

Follow these rules strictly:

- Do NOT fabricate exact scientific values, yields, or precise dates.
- The expected harvest window is supplied to you and was calculated by the
  system from its own crop database. Treat it as given. Never contradict it,
  never compute your own harvest date, and never state a single exact
  harvest day as a certainty.
- Always describe timing as a typical range or estimate, and explain that
  real timing varies.
- Clearly say when something is uncertain or variable rather than guessing.
- Do NOT invent the farm's local weather, soil conditions, pest pressure, or
  any site-specific measurement you were not given.
- Do NOT diagnose plant diseases and do NOT claim to replace agricultural
  extension officers or agronomists.
- Keep language practical, concrete, and readable for a working farmer.
- Prefer widely-accepted general horticultural knowledge. If a crop detail
  is genuinely contested or you are unsure, say so plainly.
- Keep each list item to one short sentence.
""".strip()


def _build_prompt(crop, planting_date=None, harvest_start=None, harvest_end=None) -> str:
    lines = [
        "Provide crop information for a farmer who is tracking this crop.",
        "",
        f"Crop: {crop.name}",
        f"Category: {crop.get_category_display()}",
    ]
    if crop.description:
        lines.append(f"System crop description: {crop.description}")
    lines.append(
        f"System-configured typical growing duration: {crop.growing_duration_days} days"
    )
    lines.append(
        f"System-configured typical harvest window length: {crop.harvest_window_days} days"
    )

    if planting_date and harvest_start and harvest_end:
        lines += [
            "",
            "The system has already calculated the following from its own database.",
            "These are facts you must not change or recalculate:",
            f"  Planting date: {planting_date.isoformat()}",
            f"  Expected harvest window: {harvest_start.isoformat()} to {harvest_end.isoformat()}",
            "",
            "Explain what this window means and what could shift it. Do not state a",
            "single guaranteed harvest date.",
        ]

    return "\n".join(lines)


def _validate(payload) -> dict | None:
    """Defensive validation — never trust the model's shape blindly."""
    if not isinstance(payload, dict):
        return None

    def _str(key):
        value = payload.get(key)
        return value.strip() if isinstance(value, str) else ""

    def _list(key):
        value = payload.get(key)
        if not isinstance(value, list):
            return []
        return [item.strip() for item in value if isinstance(item, str) and item.strip()]

    overview = _str("crop_overview")
    if not overview:
        # Without an overview the payload is not useful; treat as a failure
        # so the caller shows the unavailable state instead of a blank card.
        return None

    return {
        "crop_overview": overview,
        "growing_notes": _list("growing_notes"),
        "care_guidance": _list("care_guidance"),
        "harvest_guidance": _str("harvest_guidance"),
        "important_factors": _list("important_factors"),
    }


def is_configured() -> bool:
    return bool(settings.GEMINI_API_KEY)


def generate_crop_intelligence(
    crop, planting_date=None, harvest_start=None, harvest_end=None
) -> dict | None:
    """
    Calls Gemini and returns validated structured data, or None on any
    failure. Callers must handle None as "temporarily unavailable".
    """
    if not is_configured():
        logger.info("Crop intelligence skipped: GEMINI_API_KEY is not configured.")
        return None

    try:
        from google import genai
        from google.genai import types
    except Exception:
        logger.exception("google-genai SDK unavailable.")
        return None

    # When GEMINI_MODEL is overloaded (503 "high demand") or out of its daily
    # quota (429), the next configured model is tried instead of telling the
    # Farmer the AI is unavailable.
    from .gemini_models import generate_with_fallback

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
    except Exception as exc:
        logger.warning("Gemini client could not be created: %s", type(exc).__name__)
        return None

    response, model = generate_with_fallback(
        client,
        contents=_build_prompt(crop, planting_date, harvest_start, harvest_end),
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=RESPONSE_SCHEMA,
            temperature=0.3,
            http_options=types.HttpOptions(
                timeout=settings.GEMINI_TIMEOUT_SECONDS * 1000
            ),
        ),
        label="crop intelligence",
    )

    if response is None:
        return None

    parsed = getattr(response, "parsed", None)
    if parsed is None:
        import json

        raw = (getattr(response, "text", "") or "").strip()
        if not raw:
            logger.warning("Gemini returned an empty response.")
            return None
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("Gemini returned non-JSON content.")
            return None

    validated = _validate(parsed)
    if validated is None:
        logger.warning("Gemini response failed schema validation.")
        return None
    # The model that actually answered, so the cached row records it truthfully.
    validated["model_name"] = model
    return validated


def get_or_create_crop_intelligence(crop, force_refresh: bool = False):
    """
    Crop-level cache. "About guava" is identical for every Farmer, so it is
    generated once per crop and reused; only the harvest window (computed in
    Django) is personalised per plant.

    Returns (CropIntelligence | None, generated_now: bool).
    """
    if not force_refresh:
        cached = CropIntelligence.objects.filter(crop=crop).first()
        if cached:
            return cached, False

    data = generate_crop_intelligence(crop)
    if data is None:
        return None, False

    intelligence, _ = CropIntelligence.objects.update_or_create(
        crop=crop,
        defaults={
            # Map the API's `crop_overview` onto the model's `overview` field.
            "overview": data["crop_overview"],
            "growing_notes": data["growing_notes"],
            "care_guidance": data["care_guidance"],
            "harvest_guidance": data["harvest_guidance"],
            "important_factors": data["important_factors"],
            "model_name": data.get("model_name", settings.GEMINI_MODEL),
            "generated_at": timezone.now(),
        },
    )
    return intelligence, True

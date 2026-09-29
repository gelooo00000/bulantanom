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

from .ai_language import language_code, write_in
from .durations import human_duration
from .models import CropIntelligence

logger = logging.getLogger(__name__)

# Requested JSON shape. Kept in one place so the serializer, the model and
# the frontend all agree on the contract.
RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "crop_overview": {
            "type": "string",
            "description": "2-4 sentences on this specific crop or variety: what it is, what sets it apart, and how it fits a lowland Sorsogon farm.",
        },
        "growing_notes": {
            "type": "array",
            "items": {"type": "string"},
            "description": "3-5 specific growing facts with typical figures where standard (spacing, depth, soil pH, sun, how it is propagated).",
        },
        "care_guidance": {
            "type": "array",
            "items": {"type": "string"},
            "description": "3-5 concrete care actions with timing (e.g. when and what to fertilise, pruning, watering in dry spells, the named pests or diseases to watch for).",
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
            "description": "3-5 specific factors that shift this crop's harvest timing or yield on this farm (e.g. typhoon season, heavy November-January rain, a named disease).",
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

- Be precise and specific, not generic. Every item must be something this
  farmer can act on for THIS crop or variety — never advice that would fit
  any plant ("water regularly", "use good soil", "monitor for pests").
- When a variety is named, describe that variety itself: what sets it apart
  from other varieties of the same crop (fruit or leaf traits, size, how
  soon it bears, known strengths or weaknesses) where that is well
  established.
- Give concrete numbers where agronomic practice has a well-established
  typical range — plant spacing in metres or centimetres, planting depth,
  how often to water in dry spells, when to fertilise relative to growth
  stage or flowering, signs and timing of ripeness — stated as a typical
  range ("usually 8-10 m apart"), and name the specific pests or diseases
  this crop is known for, with what to look for.
- Do NOT fabricate figures you are not confident are standard practice, nor
  yields, prices, or exact dates. If a value genuinely varies, say so
  instead of guessing.
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
- Say how long things take the way a farmer says it — "about 4 years",
  "about 3 months", "a few weeks". Never quote the system's raw day counts
  back at them ("1460 days" means nothing to a reader), and never convert a
  duration yourself: the readable form is given to you, so use it as-is.
- A tree crop that takes years to bear is normal, not a warning. Say plainly
  how long the wait is, and what the tree needs during it.
""".strip()


def _build_prompt(
    crop,
    planting_date=None,
    harvest_start=None,
    harvest_end=None,
    variant=None,
    language="en",
) -> str:
    # A variety is described as itself: the catalog files Pechay under
    # "Lemongrass / Leafy Greens", and asking about the parent crop got an
    # answer about lemongrass.
    subject = variant or crop
    lines = [
        "Provide crop information for a farmer who is tracking this crop.",
        "",
        # Given as fact so the advice fits the place, without asking the
        # model to guess local conditions it was not told.
        "Farm: Layuan Nature Integrated Farm, Bulan, Sorsogon, Philippines "
        "(lowland, humid tropics; Type II climate - no distinct dry season, "
        "heaviest rain November to January; exposed to typhoons).",
        "",
        f"Crop: {subject.name}",
        f"Category: {crop.get_category_display()}",
    ]
    if variant:
        lines.append(
            f'(Listed in the system\'s catalog under "{crop.name}". Describe '
            f"{variant.name} itself, not the other crops in that group.)"
        )
    if subject.description:
        lines.append(f"System crop description: {subject.description}")
    # Both forms: the number so the model has the fact, and the wording it
    # must use so its answer matches what the Farmer sees on screen.
    lines.append(
        f"System-configured typical growing duration: {subject.growing_duration_days} days "
        f'— say this as "{human_duration(subject.growing_duration_days)}"'
    )
    lines.append(
        f"System-configured typical harvest window length: {subject.harvest_window_days} days "
        f'— say this as "{human_duration(subject.harvest_window_days)}"'
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

    if write_in(language):
        lines += ["", write_in(language)]

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
    crop,
    planting_date=None,
    harvest_start=None,
    harvest_end=None,
    variant=None,
    language="en",
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
        contents=_build_prompt(
            crop, planting_date, harvest_start, harvest_end, variant, language_code(language)
        ),
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=RESPONSE_SCHEMA,
            # Low: this is reference material, where consistency beats variety.
            temperature=0.2,
            http_options=types.HttpOptions(
                timeout=settings.GEMINI_TIMEOUT_SECONDS * 1000
            ),
        ),
        label="crop intelligence",
        slow_budget_seconds=settings.GEMINI_INTELLIGENCE_BUDGET_SECONDS,
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


def get_or_create_crop_intelligence(
    crop, force_refresh: bool = False, variant=None, language: str = "en"
):
    """
    Per crop-and-variety cache. "About guava" is identical for every Farmer,
    so it is generated once and reused; only the harvest window (computed in
    Django) is personalised per plant. A variety has its own entry, since
    Pechay and lemongrass share a catalog crop but not a description, and
    each language has its own, written in that language by Gemini.

    Returns (CropIntelligence | None, generated_now: bool).
    """
    language = language_code(language)
    if not force_refresh:
        cached = CropIntelligence.objects.filter(
            crop=crop, variant=variant, language=language
        ).first()
        if cached:
            return cached, False

    data = generate_crop_intelligence(crop, variant=variant, language=language)
    if data is None:
        return None, False

    intelligence, _ = CropIntelligence.objects.update_or_create(
        crop=crop,
        variant=variant,
        language=language,
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

"""
Soil Recommendation — the Gemini boundary for soil-based crop advice.

Mirrors the design rules already used by `crop_intelligence_service` and
`risk_evaluation_service`:

* Structured output only. A response schema is supplied so the API returns
  exactly the six sections the Farmer UI renders — never free-form prose.
* Grounded in the real catalog. The Crop table is passed into the prompt and
  Gemini is told to recommend only from it, so every result maps back to a
  crop BulanTanom actually knows (and therefore has an emoji for).
* Safe to fail. Every failure path returns None. Callers must save the
  Farmer's soil assessment regardless and present "temporarily unavailable".
* Proportionate confidence. When NPK or pH are missing, the prompt requires
  the advice to become more cautious rather than inventing precise dosages.
* The API key is read from Django settings (env) and never logged.
"""

from __future__ import annotations

import json
import logging

from django.conf import settings

from .models import Crop, CropCategory

logger = logging.getLogger(__name__)

# The six sections, and nothing else. This shape is the contract shared by
# the model fields, the serializer and the frontend result card.
_CROP_ITEM = {
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "description": "Crop name copied EXACTLY from the supplied catalog.",
        },
        "reason": {
            "type": "string",
            "description": (
                "One short sentence on why this suits the reported soil. "
                "Reference the actual soil values given."
            ),
        },
    },
    "required": ["name", "reason"],
}

_RECOMMENDATION_ITEM = {
    "type": "object",
    "properties": {
        "recommendation": {
            "type": "string",
            "description": "One short, practical, actionable sentence.",
        }
    },
    "required": ["recommendation"],
}

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "suitable_fruits": {"type": "array", "items": _CROP_ITEM},
        "suitable_vegetables": {"type": "array", "items": _CROP_ITEM},
        "suitable_crops": {"type": "array", "items": _CROP_ITEM},
        "fertilizer_recommendations": {
            "type": "array",
            "items": _RECOMMENDATION_ITEM,
        },
        "soil_improvement_watering": {
            "type": "array",
            "items": _RECOMMENDATION_ITEM,
        },
        "important_warnings": {"type": "array", "items": _RECOMMENDATION_ITEM},
    },
    "required": [
        "suitable_fruits",
        "suitable_vegetables",
        "suitable_crops",
        "fertilizer_recommendations",
        "soil_improvement_watering",
        "important_warnings",
    ],
}

SYSTEM_INSTRUCTION = """
You are BulanTanom's Soil Recommendation assistant, helping smallholder
farmers at Layuan Nature Integrated Farm in Bulan, Sorsogon, Philippines.

Your ONLY job is to read the soil information a Farmer reported and return
crop, fertilizer, soil-improvement and warning guidance based on it.

Follow these rules strictly:

- Recommend ONLY crops from the supplied catalog. Copy each crop name
  EXACTLY as written in the catalog. Never invent a crop, and never use a
  name that is not in the catalog.
- Base every recommendation on the ACTUAL soil values supplied. Two Farmers
  with different soil must receive different results. Never return a generic
  list.
- In each `reason`, refer to the specific soil characteristics given (for
  example the drainage, texture or moisture the Farmer reported).
- Do NOT repeat the same crop in more than one section. A crop belongs to
  exactly one of fruits, vegetables, or other crops.
- Do NOT state exact fertilizer dosages, application rates, or quantities
  unless nitrogen, phosphorus and potassium values were actually supplied.
  When they were not, keep fertilizer advice general and say what a soil
  test would clarify.
- Do NOT invent soil measurements that were not provided. If pH is unknown,
  treat it as unknown; never assume a value.
- Only raise warnings that genuinely follow from the reported information.
  Do not manufacture warnings to fill the section. If nothing significant
  stands out, return a single reassuring item saying there are no major
  warnings based on the information provided.
- Keep every item to one short, practical sentence a working farmer can act
  on. No jargon, no paragraphs.
- Do NOT diagnose plant disease and do NOT claim to replace agricultural
  extension officers or agronomists.
""".strip()


def _catalog_lines() -> tuple[list[str], list[str]]:
    """
    The active crop catalog, split by category, as prompt lines.

    Returns (fruit_names, vegetable_names) so the caller can also validate
    Gemini's answers against real crops afterwards.
    """
    fruits, vegetables = [], []
    for crop in Crop.objects.filter(is_active=True).order_by("name"):
        if crop.category == CropCategory.FRUIT:
            fruits.append(crop.name)
        else:
            vegetables.append(crop.name)
    return fruits, vegetables


def _label(instance, field: str) -> str:
    """Human-readable choice label, e.g. 'sandy_loam' -> 'Sandy Loam'."""
    return getattr(instance, f"get_{field}_display")()


def _build_prompt(soil) -> str:
    fruits, vegetables = _catalog_lines()

    ph = "Unknown" if soil.ph_level is None else str(soil.ph_level)

    lines = [
        "A Farmer reported the following soil information. Analyse THESE",
        "values and recommend accordingly.",
        "",
        "REPORTED SOIL INFORMATION",
        f"  Soil type: {_label(soil, 'soil_type')}",
        f"  Soil texture: {_label(soil, 'soil_texture')}",
        f"  Drainage: {_label(soil, 'drainage')}",
        f"  Soil moisture: {_label(soil, 'soil_moisture')}",
        f"  Soil pH: {ph}",
        f"  Nitrogen: {_label(soil, 'nitrogen')}",
        f"  Phosphorus: {_label(soil, 'phosphorus')}",
        f"  Potassium: {_label(soil, 'potassium')}",
        f"  Organic matter: {_label(soil, 'organic_matter')}",
    ]

    if soil.notes.strip():
        lines.append(f"  Farmer's additional observations: {soil.notes.strip()}")
    else:
        lines.append("  Farmer's additional observations: (none provided)")

    if not soil.has_npk:
        lines += [
            "",
            "NOTE: No nitrogen, phosphorus or potassium readings were supplied.",
            "Keep fertilizer advice general and avoid exact dosages.",
        ]
    if soil.ph_level is None:
        lines += [
            "",
            "NOTE: Soil pH was not supplied. Do not assume a pH value.",
        ]

    lines += [
        "",
        "CROP CATALOG — recommend ONLY from this list, copying names exactly.",
        "",
        "Fruits (use for suitable_fruits):",
        "  " + ", ".join(fruits) if fruits else "  (none)",
        "",
        "Vegetables and other crops (split between suitable_vegetables and",
        "suitable_crops — put leafy/fruiting vegetables in suitable_vegetables",
        "and grains, root crops, herbs and spices in suitable_crops):",
        "  " + ", ".join(vegetables) if vegetables else "  (none)",
        "",
        "Copy each crop `name` exactly as written in the catalog so the",
        "system can match it to its emoji.",
    ]

    return "\n".join(lines)


def _validate(payload, catalog: dict[str, Crop]) -> dict | None:
    """
    Defensive validation — never trust the model's shape blindly.

    Crop names are matched case-insensitively against the real catalog and
    anything unrecognised is dropped, so the UI can always resolve an emoji.
    A crop already used in an earlier section is skipped, enforcing the
    "no duplicates between sections" rule even if Gemini ignores it.
    """
    if not isinstance(payload, dict):
        return None

    seen: set[str] = set()

    def _crops(key):
        value = payload.get(key)
        if not isinstance(value, list):
            return []
        items = []
        for entry in value:
            if not isinstance(entry, dict):
                continue
            name = entry.get("name")
            reason = entry.get("reason")
            if not isinstance(name, str) or not name.strip():
                continue
            crop = catalog.get(name.strip().casefold())
            if crop is None or crop.id in seen:
                continue
            seen.add(crop.id)
            items.append(
                {
                    "id": crop.id,
                    "name": crop.name,
                    "emoji": crop.emoji,
                    "reason": reason.strip() if isinstance(reason, str) else "",
                }
            )
        return items

    def _recommendations(key):
        value = payload.get(key)
        if not isinstance(value, list):
            return []
        items = []
        for entry in value:
            if isinstance(entry, dict):
                text = entry.get("recommendation")
            elif isinstance(entry, str):
                # Tolerate a plain string list rather than discarding usable advice.
                text = entry
            else:
                continue
            if isinstance(text, str) and text.strip():
                items.append({"recommendation": text.strip()})
        return items

    result = {
        "suitable_fruits": _crops("suitable_fruits"),
        "suitable_vegetables": _crops("suitable_vegetables"),
        "suitable_crops": _crops("suitable_crops"),
        "fertilizer_recommendations": _recommendations("fertilizer_recommendations"),
        "soil_improvement_watering": _recommendations("soil_improvement_watering"),
        "important_warnings": _recommendations("important_warnings"),
    }

    # A result with no crops at all is not useful to the Farmer; treat it as
    # a failure so the UI shows "unavailable" rather than six empty sections.
    if not (
        result["suitable_fruits"]
        or result["suitable_vegetables"]
        or result["suitable_crops"]
    ):
        return None

    return result


def is_configured() -> bool:
    return bool(settings.GEMINI_API_KEY)


def generate_soil_recommendation(soil) -> dict | None:
    """
    Calls Gemini for one soil assessment and returns validated structured
    data, or None on any failure (missing key, quota, timeout, API error,
    malformed response). Callers must handle None as "temporarily
    unavailable" and must still keep the Farmer's saved soil information.
    """
    if not is_configured():
        logger.info("Soil recommendation skipped: GEMINI_API_KEY is not configured.")
        return None

    try:
        from google import genai
        from google.genai import types
    except Exception:
        logger.exception("google-genai SDK unavailable.")
        return None

    catalog = {
        crop.name.casefold(): crop for crop in Crop.objects.filter(is_active=True)
    }
    if not catalog:
        logger.warning("Soil recommendation skipped: crop catalog is empty.")
        return None

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=_build_prompt(soil),
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                response_mime_type="application/json",
                response_schema=RESPONSE_SCHEMA,
                temperature=0.3,
                http_options=types.HttpOptions(
                    timeout=settings.GEMINI_SOIL_TIMEOUT_SECONDS * 1000
                ),
            ),
        )
    except Exception as exc:
        # Never log the key; log only the exception type/message.
        logger.warning(
            "Gemini soil request failed: %s: %s", type(exc).__name__, exc
        )
        return None

    parsed = getattr(response, "parsed", None)
    if parsed is None:
        raw = (getattr(response, "text", "") or "").strip()
        if not raw:
            logger.warning("Gemini returned an empty soil response.")
            return None
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("Gemini returned non-JSON soil content.")
            return None

    validated = _validate(parsed, catalog)
    if validated is None:
        logger.warning("Gemini soil response failed schema validation.")
    return validated


def apply_recommendation(soil, data: dict | None) -> bool:
    """
    Writes a generated result onto the row and saves it.

    Returns True when AI content was stored. On failure the soil inputs are
    left untouched and only the failure marker is persisted, so the Farmer's
    assessment survives a Gemini outage.
    """
    if data is None:
        soil.ai_generated = False
        soil.failure_reason = "AI recommendation is temporarily unavailable."
        soil.save(update_fields=["ai_generated", "failure_reason", "updated_at"])
        return False

    soil.suitable_fruits = data["suitable_fruits"]
    soil.suitable_vegetables = data["suitable_vegetables"]
    soil.suitable_crops = data["suitable_crops"]
    soil.fertilizer_recommendations = data["fertilizer_recommendations"]
    soil.soil_improvement_watering = data["soil_improvement_watering"]
    soil.important_warnings = data["important_warnings"]
    soil.ai_generated = True
    soil.model_name = settings.GEMINI_MODEL
    soil.failure_reason = ""
    soil.save()
    return True

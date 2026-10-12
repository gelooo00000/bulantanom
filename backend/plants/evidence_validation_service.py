"""
Plant Evidence Validation — a Gemini boundary kept separate from risk
evaluation (`risk_evaluation_service.py`) and from crop information
(`crop_intelligence_service.py`).

Its job: decide whether an uploaded photo plausibly shows the crop the
Farmer selected, at an age that fits its planting date, *before* any risk
evaluation runs.

Architecture rules:

* Structured output with a strict verdict enum. Free-form text is never
  trusted; anything that fails validation is treated as "could not verify".
* Confidence is enforced in Django, not left to the model's own wording — a
  low-confidence "match" is downgraded to `unclear`, so the system never
  overclaims certainty on an ambiguous photo.
* Poor image quality is reported as its own verdict, never as a crop
  mismatch: "I can't tell" and "that's the wrong plant" are different
  answers and get different messages.
* The plant's age is checked in Django too. The model reports the growth
  stage it sees on a fixed scale (growth_stage.STAGES); a photo clearly
  older than the planting date allows (fruit on a plant sown 11 days ago)
  becomes `wrong_stage` even when the model called it a match, because the
  photo and the planting date cannot both be right.
* Fail closed. If Gemini is unavailable this returns None and the caller
  must reject the submission — it must never assume the evidence is valid.
* The API key is read from settings and never logged.

On an accepted photo it also suggests answers for the parts of the weekly
assessment a photo can show (overall health, leaves, flowering, fruiting),
so the Farmer checks them instead of filling them in. These are only
suggestions: the form shows them for the Farmer to confirm or change, and
the risk evaluation still compares the photo with the final answers.
"""

from __future__ import annotations

import json
import logging

from django.conf import settings

from .ai_language import write_in
from .durations import human_duration
from .gemini_models import generate_with_fallback
from .growth_stage import STAGES, expected_stage, too_far_ahead

logger = logging.getLogger(__name__)

# Below this, a "match" is not trusted — reported as unclear rather than
# accepted, so an ambiguous photo never passes as verified evidence.
MIN_MATCH_CONFIDENCE = 0.55

VERDICTS = ("match", "mismatch", "no_plant", "unclear", "not_genuine", "wrong_stage")

# Crops whose photo age is not judged against the planting date: mushrooms
# do not grow through seedling-to-fruit stages, and long-lived crops (fruit
# trees, banana) are usually planted as nursery saplings or suckers already
# months old, which may even flower early. The risk evaluation still flags a
# plain planting-date mismatch for them after submission.
STAGE_CHECK_MAX_DURATION_DAYS = 365
STAGE_CHECK_EXEMPT = {"mushroom"}


def stage_check_applies(crop, duration_days: int | None) -> bool:
    duration = duration_days or 0
    return (
        getattr(crop, "id", None) not in STAGE_CHECK_EXEMPT
        and 0 < duration <= STAGE_CHECK_MAX_DURATION_DAYS
    )

# Answers a photo can suggest, with the values the assessment form accepts
# (Assessment's TextChoices). "unknown" means the photo does not show it.
SUGGESTIBLE = {
    "health_condition": ("healthy", "slightly_unhealthy", "unhealthy"),
    "leaf_condition": (
        "healthy", "slight_yellowing", "yellowing", "spots", "wilting", "damaged",
    ),
    "flowering_status": ("not_flowering", "starting", "flowering", "finished"),
    "fruiting_status": ("not_fruiting", "forming", "developing", "ripening"),
    "mushroom_condition": (
        "healthy", "discoloured", "spots", "slimy", "dry", "misshapen", "mold",
    ),
}

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": list(VERDICTS)},
        "confidence": {"type": "number"},
        "detected_subject": {"type": "string"},
        "reason": {"type": "string"},
        "observed_stage": {"type": "string", "enum": [*STAGES, "unknown"]},
        "observed": {
            "type": "object",
            "properties": {
                field: {"type": "string", "enum": [*values, "unknown"]}
                for field, values in SUGGESTIBLE.items()
            },
            "required": list(SUGGESTIBLE),
        },
    },
    "required": [
        "verdict", "confidence", "detected_subject", "reason", "observed_stage", "observed",
    ],
}

SYSTEM_INSTRUCTION = """
You verify whether a farmer's uploaded photo actually shows the crop they
selected in BulanTanom, an agricultural monitoring system for Layuan Nature
Integrated Farm in Bulan, Sorsogon, Philippines.

You are NOT diagnosing plant health here. Your questions are: is this a
real photo the farmer took of a growing plant, does it plausibly show the
expected crop, and could it be the plant the farmer recorded, given how long
ago it was planted?

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
- "wrong_stage" — the photo shows the expected crop, but clearly far older
                than the plant's recorded age allows: flowers, fruit, pods,
                a large tuber or a full mature plant on a plant planted only
                days or a few weeks ago. Then it is not this plant, or the
                planting date is wrong. Name what you see and the age in
                `reason`. A plant that looks a little ahead of its age, or
                younger than expected, is NOT wrong_stage.
- "not_genuine" — the image is not a real photo of a living plant taken in
                the field. Use this, even when the crop is right, for: stock
                or internet images (watermarks, website logos, copyright
                text, captions, catalogue-style shots of a perfect specimen
                on a white or studio background); screenshots (phone status
                bars, app or browser chrome, search results, social media
                frames); a photo of a computer, TV or phone screen (visible
                pixels, moire, screen glare, bezels); a photo of a printed
                picture, poster, book, seed packet or product label;
                drawings, illustrations, clip art, 3D renders, AI-generated
                images; collages or edited images with text or stickers;
                harvested fruit at a market or shop instead of a plant in the
                ground.

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
- Check "not_genuine" first. A genuine farm photo is usually imperfect: uneven
  natural light, soil, weeds, other plants, fences or a hand in frame, some
  blur. That is normal and is NOT a reason for "not_genuine". Use it only
  when you see an actual sign listed above, and name that sign in `reason`.

`observed_stage` — the growth stage the photo shows, judged from the photo
alone: "seedling" (first leaves, just emerged), "vegetative" (leafy growth,
no flowers), "flowering" (flower buds or open flowers), "fruiting" (fruit,
pods or a tuber/root visibly forming), or "mature" (full-grown, ready to
harvest). Use "unknown" when you cannot tell. Report what you see honestly
even when it does not fit the plant's age: the system makes the comparison.

`observed` — what the photo shows of the plant, used to pre-fill the
farmer's weekly checklist. Fill it only for a "match"; for any other verdict
set every field to "unknown".
- health_condition: overall look of the plant. "healthy", "slightly_unhealthy"
  or "unhealthy".
- leaf_condition: "healthy" (green), "slight_yellowing", "yellowing",
  "spots" (spots or lesions), "wilting" (drooping) or "damaged" (holes,
  tears, chewed).
- flowering_status: "not_flowering", "starting", "flowering" or "finished".
- fruiting_status: "not_fruiting", "forming", "developing" or "ripening".
- mushroom_condition (mushrooms only; "unknown" for any other crop):
  "healthy" (firm, normal colour), "discoloured" (yellow or brown patches),
  "spots", "slimy" (slimy or soft), "dry" (dry or cracked caps), "misshapen"
  (misshapen, or long thin stems) or "mold" (green or other mold).
Use "unknown" whenever the photo does not clearly show it (leaves out of
frame, too far away, too dark). A wrong guess makes the farmer correct it;
"unknown" just leaves the question to them.
""".strip()


def is_configured() -> bool:
    return bool(settings.GEMINI_API_KEY)


def build_context(
    crop, age_days: int | None = None, duration_days: int | None = None
) -> dict:
    """
    What Gemini is told about the expectation.

    Deliberately crop metadata and the plant's age only — no farmer name,
    email, id, tokens or any other account information is ever sent.
    """
    context = {
        "expected_crop": crop.name,
        "crop_category": crop.get_category_display(),
        "crop_description": crop.description,
        "typical_growing_duration_days": crop.growing_duration_days,
        "also_known_as": list(crop.search_terms or []),
    }
    if age_days is not None:
        context["plant_age"] = {
            "days_since_planting": age_days,
            "readable": human_duration(age_days),
            "expected_stage": expected_stage(duration_days, age_days) or "unknown",
        }
    return context


def _message_for(verdict: str, crop_name: str) -> str:
    """Farmer-facing copy. Fixed per verdict so wording stays consistent."""
    if verdict == "match":
        return "Plant evidence accepted."
    if verdict == "mismatch":
        return f"Please upload a clear photo of your {crop_name.lower()} plant."
    if verdict == "no_plant":
        return f"Please upload a photo showing your {crop_name.lower()} plant."
    if verdict == "wrong_stage":
        return (
            f"This doesn't look like the {crop_name.lower()} you planted. Take a photo of "
            "that plant. If its planting date is wrong, remove it in My Plants and add it "
            "again with the right date."
        )
    if verdict == "not_genuine":
        return (
            f"Take a new photo of your own {crop_name.lower()} plant with your camera. "
            "Pictures from the internet, screenshots or photos of a screen can't be used."
        )
    return "Please upload a clearer photo showing the plant."


def _suggestions(observed) -> dict:
    """
    The usable answers from the model's `observed` block: known fields with
    allowed values only. Anything else, including "unknown", is left out, so
    the Farmer answers it. A missing or malformed block just suggests nothing;
    it never rejects the photo.
    """
    if not isinstance(observed, dict):
        return {}
    return {
        field: observed[field]
        for field, values in SUGGESTIBLE.items()
        if observed.get(field) in values
    }


def _validate(
    payload, crop, age_days: int | None = None, duration_days: int | None = None
) -> dict | None:
    """
    Turn a raw model response into a trusted result, or None if unusable.

    `evidence_valid` is decided here, never read from the model — it requires
    a "match" verdict, sufficient confidence, and (where the stage check
    applies) a growth stage the plant's age allows.
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

    stage_applies = age_days is not None and stage_check_applies(crop, duration_days)
    if verdict == "wrong_stage" and not stage_applies:
        # The model judged an age it was not asked to judge for this crop.
        verdict = "match"

    observed_stage = payload.get("observed_stage")
    expected = expected_stage(duration_days, age_days) if stage_applies else None
    if verdict == "match" and too_far_ahead(expected, observed_stage):
        verdict = "wrong_stage"
        reason = (
            f"The photo shows a {crop.name.lower()} plant at the {observed_stage} stage, "
            f"but this plant was planted {human_duration(age_days)} ago and should still "
            f"be at the {expected} stage."
        )

    # A weakly-held "match" is not evidence — downgrade rather than accept.
    if verdict == "match" and confidence < MIN_MATCH_CONFIDENCE:
        verdict = "unclear"
        reason = (
            f"The photo may show {detected}, but it is not clear enough to confirm "
            f"it is {crop.name.lower()}."
        )

    return {
        "evidence_valid": verdict == "match",
        "suggested_answers": _suggestions(payload.get("observed")) if verdict == "match" else {},
        "verdict": verdict,
        "confidence": confidence,
        "detected_subject": detected,
        "observed_stage": observed_stage if observed_stage in STAGES else None,
        "expected_stage": expected,
        "expected_crop": crop.name,
        "reason": reason,
        "message": _message_for(verdict, crop.name),
    }


def validate_crop_evidence(
    crop,
    image_bytes: bytes,
    mime_type: str,
    language: str = "en",
    age_days: int | None = None,
    duration_days: int | None = None,
) -> dict | None:
    """
    Ask Gemini whether `image_bytes` plausibly shows `crop`. `reason` - the
    sentence the farmer reads when a photo is turned down - comes back in
    their app `language`; `verdict` stays one of the fixed English values.

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

    context = build_context(crop, age_days, duration_days)
    parts = [
        "Does this photo show the expected crop, at an age that fits?\n\n"
        + json.dumps(context, indent=2),
        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
    ]
    if write_in(language):
        parts.append(write_in(language))

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

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
    except Exception as exc:
        logger.warning("Gemini client could not be created: %s", type(exc).__name__)
        return None
    response, _model = generate_with_fallback(
        client, contents=parts, config=config, label="evidence validation"
    )

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

    result = _validate(parsed, crop, age_days, duration_days)
    if result is None:
        logger.warning("Evidence validation response failed schema validation.")
    return result

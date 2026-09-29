"""
Which Gemini model answers, when the first choice cannot.

Gemini's free tier allows about 20 requests per model per day, and a request
refused with 503 "high demand" still counts against it. Retrying the same
model therefore burns the day's quota without getting an answer — and each
refusal was measured at around 20 seconds, so three retries kept a Farmer
waiting a minute for nothing. Each model has its own quota and its own load,
so an overloaded or exhausted model is skipped for the next configured one
instead.

Shared by every Gemini feature — crop intelligence, soil recommendations,
risk evaluation and evidence validation — so they all behave the same way
when Google is busy.
"""

from __future__ import annotations

import logging
import time

from django.conf import settings

logger = logging.getLogger(__name__)

_TRANSIENT_MARKERS = ("429", "503", "UNAVAILABLE", "RESOURCE_EXHAUSTED")


def models() -> list[str]:
    """GEMINI_MODEL first, then each configured fallback, without repeats."""
    return list(dict.fromkeys([settings.GEMINI_MODEL, *settings.GEMINI_FALLBACK_MODELS]))


def is_transient(exc: Exception) -> bool:
    """
    True when this model is overloaded (503) or out of quota (429), so the
    next model is worth trying.

    Deliberately excludes 504 DEADLINE_EXCEEDED and client timeouts: those
    have already spent the whole timeout, and moving on to another model
    would double the wait.
    """
    if "timeout" in type(exc).__name__.lower():
        return False
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    if code in (429, 503):
        return True
    if code is not None:
        return False
    return any(marker in str(exc) for marker in _TRANSIENT_MARKERS)


def is_slow_failure(exc: Exception) -> bool:
    """
    A timeout, 504 DEADLINE_EXCEEDED or 500 INTERNAL: the model was reached
    but did not answer in time. Under heavy load Gemini often does this
    instead of refusing with 503, so a feature with a time budget to spare
    may still try the next model (see `generate_with_fallback`).
    """
    if "timeout" in type(exc).__name__.lower():
        return True
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    if code in (500, 504):
        return True
    return code is None and any(m in str(exc) for m in ("DEADLINE_EXCEEDED", "INTERNAL"))


def generate_with_fallback(
    client, *, contents, config, label: str, slow_budget_seconds: float | None = None
):
    """
    Calls `generate_content` on each model in turn until one answers.

    Returns (response, model) — or (None, None) when a model fails for a
    reason another model would not fix, or every model is busy. `label`
    names the feature in the log. The API key is never logged.

    `slow_budget_seconds`: when given, a slow failure (timeout, 504, 500)
    also moves on to the next model, as long as less than this many seconds
    have passed in total. Without it a slow failure ends the attempt, which
    is right for long calls such as soil (120s each). Crop intelligence
    passes one: seen live, a busy primary timed out and the Farmer was told
    "unavailable" while the next model answered in a few seconds.
    """
    started = time.monotonic()
    for model in models():
        try:
            response = client.models.generate_content(
                model=model, contents=contents, config=config
            )
        except Exception as exc:
            transient = is_transient(exc) or (
                slow_budget_seconds is not None
                and is_slow_failure(exc)
                and time.monotonic() - started < slow_budget_seconds
            )
            logger.warning(
                "Gemini %s failed on %s (next model=%s): %s: %s",
                label, model, transient, type(exc).__name__, exc,
            )
            if not transient:
                return None, None
            continue
        if model != settings.GEMINI_MODEL:
            logger.info("Gemini %s answered by fallback model %s.", label, model)
        return response, model
    return None, None

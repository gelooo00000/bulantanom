"""
Growing durations in words a farmer uses.

Every duration is stored in days, so a Cardinal avocado is 1460. Neither a
farmer nor Gemini should be handed that figure and asked to convert it: the
UI shows "about 4 years", and the prompts say the same, so the AI's wording
agrees with the screen instead of quoting raw day counts back.

Deliberately approximate. The stored figure is a typical duration, not a
promise, and "about 4 years" is the honest precision.
"""

from __future__ import annotations


def human_duration(days: int | None) -> str:
    """e.g. 1460 -> "about 4 years", 90 -> "about 3 months", 5 -> "5 days"."""
    if days is None:
        return "an unknown length of time"
    days = max(0, int(days))
    if days <= 1:
        return f"{days} day"
    if days < 14:
        return f"{days} days"
    if days < 60:
        weeks = round(days / 7)
        return f"about {weeks} week{'' if weeks == 1 else 's'}"
    if days < 365:
        months = round(days / 30)
        return f"about {months} month{'' if months == 1 else 's'}"

    years, remainder = divmod(days, 365)
    months = round(remainder / 30)
    if months >= 11:
        years, months = years + 1, 0
    if months <= 1:
        return f"about {years} year{'' if years == 1 else 's'}"
    return f"about {years} year{'' if years == 1 else 's'} and {months} months"

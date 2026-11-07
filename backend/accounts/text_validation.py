"""
Shared rules for the free-text fields people type into.

Mirrored in src/lib/text-validation.ts, which runs the same checks in the
browser so the farmer sees the problem beside the field; these run again on
the server so nothing reaches the database (or Gemini) unchecked.

Two kinds of field:

* Names (sign-up, LGU Officer accounts): letters, spaces, hyphens,
  apostrophes and periods only, e.g. "Ma. Luisa", "Dela Cruz", "O'Neil",
  "Peña".
* Notes (Additional Soil Information, weekly assessment notes): optional,
  but when given they must read as words. They are passed to Gemini, so a
  link, HTML or a keyboard mash is refused rather than analysed.

Kept language-neutral on purpose: English, Filipino and Bikol all pass, so
no rule leans on an English word list.
"""

from __future__ import annotations

import re

NAME_MAX = 50
NAME_MIN_LETTERS = 2

# Unicode letters (ñ, é ...) plus space, hyphen, apostrophe and period.
_NAME_ALLOWED = re.compile(r"^[^\W\d_]+(?:[ \-'.’]+[^\W\d_]*)*$")
_LETTER = re.compile(r"[^\W\d_]")
_REPEATED = re.compile(r"(.)\1{4,}", re.IGNORECASE | re.DOTALL)  # 5+ in a row
_URL = re.compile(r"(https?://|www\.|\b[\w-]+\.(com|net|org|ph|io|xyz)\b)", re.IGNORECASE)
_HTML = re.compile(r"<[^>]*>")
_WORD = re.compile(r"[^\W\d_]+")
_VOWELS = set("aeiouyáéíóúàèìòùâêîôûäëïöü")


def clean(value: str | None) -> str:
    """Trimmed, with runs of spaces collapsed to one."""
    return re.sub(r"\s+", " ", (value or "")).strip()


def clean_notes(value: str | None) -> str:
    """Trimmed, keeping the farmer's line breaks but no blank runs."""
    text = (value or "").strip()
    text = re.sub(r"[ \t]+", " ", text)
    return re.sub(r"\n{3,}", "\n\n", text)


def name_problem(value: str | None, label: str, required: bool = True) -> str | None:
    """Why `value` is not an acceptable name, or None when it is."""
    text = clean(value)
    if not text:
        return f"{label} is required." if required else None
    if len(text) > NAME_MAX:
        return f"{label} must be {NAME_MAX} characters or fewer."
    if not _NAME_ALLOWED.match(text):
        return (
            f"{label} can only contain letters, spaces, hyphens (-), "
            "apostrophes (') and periods (.)."
        )
    if len(_LETTER.findall(text)) < NAME_MIN_LETTERS:
        return f"{label} must have at least {NAME_MIN_LETTERS} letters."
    if _REPEATED.search(text):
        return f"{label} does not look like a real name."
    return None


def notes_problem(value: str | None, label: str, max_length: int) -> str | None:
    """Why optional free text is not acceptable, or None when it is."""
    text = clean_notes(value)
    if not text:
        return None
    if len(text) > max_length:
        return f"Please keep {label} under {max_length} characters."
    if _HTML.search(text):
        return f"{label} cannot contain code or HTML tags."
    if _URL.search(text):
        return f"{label} cannot contain links. Describe what you see instead."
    words = _WORD.findall(text)
    letters = sum(len(word) for word in words)
    if letters < 3:
        return f"{label} must describe something in words, not only numbers or symbols."
    if _REPEATED.search(text):
        return f"{label} has a character repeated too many times."
    for word in words:
        lower = word.lower()
        no_vowel = len(lower) >= 6 and not (set(lower) & _VOWELS)
        if no_vowel or len(lower) > 30:
            return f"{label} does not look like real words. Please describe it plainly."
    return None

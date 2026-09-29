"""
The language Gemini writes in: the farmer's chosen app language.

Shared by every Gemini feature a farmer reads — crop guidance, the photo
check, risk evaluation and soil recommendations — so a Filipino or Bikol
screen gets Filipino or Bikol text, asked for the same way everywhere.
The frontend's API client sends it on every request as `Accept-Language`
(`en`, `fil` or `bik`); `?lang=` overrides it.
"""

# How to ask Gemini for each. Bikol names the variety Bulan speaks, the one
# the app's own Bikol screens are in.
LANGUAGES = {
    "en": "English",
    "fil": "Filipino (Tagalog)",
    "bik": (
        "Bikol as spoken in Bulan, Sorsogon (Sorsogon Bikol / Sorsoganon) - "
        "the everyday words a local farmer uses"
    ),
}

LANGUAGE_CHOICES = [("en", "English"), ("fil", "Filipino"), ("bik", "Bikol")]


def language_code(value) -> str:
    """A supported language code, English for anything else."""
    return value if value in LANGUAGES else "en"


def from_request(request) -> str:
    """
    The farmer's language for this request: `?lang=` when given, otherwise
    the `Accept-Language` header the app's API client sets on every call.
    A browser's own header ("en-US,en;q=0.9", "fil-PH") is not one of the
    app's codes, so it falls back to English rather than guessing.
    """
    if "lang" in request.query_params:
        return language_code(request.query_params.get("lang"))
    header = request.headers.get("Accept-Language", "")
    first = header.split(",")[0].split(";")[0].strip().lower()
    return language_code(first)


def write_in(language: str) -> str:
    """
    The instruction appended to a prompt, or "" for English. Field names,
    enum values (LOW / MEDIUM / HIGH, true / false) and crop names copied
    from a catalog stay exactly as given, so the app can still read them.
    """
    language = language_code(language)
    if language == "en":
        return ""
    return (
        f"Write all of your free-text answers in {LANGUAGES[language]}. The farmer "
        "reads the app in this language. Keep the JSON field names, any fixed "
        "values the schema lists (such as LOW, MEDIUM, HIGH or INCONCLUSIVE), and "
        "any crop names copied from a supplied catalog exactly as given in "
        "English. Keep crop, variety, pest and disease names and numbers with "
        "units as farmers there commonly say them (an English or scientific name "
        "in brackets is fine when there is no local one). Say durations "
        "naturally in this language, keeping the same length you were given."
    )

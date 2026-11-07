"""
Soil Check - fixed rules that decide whether a soil can be planted at all,
and which catalog crops can actually grow in it.

Gemini writes the advice, but it does not get the final say on safety. A
language model asked for "3 to 5 crops" will name 3 to 5 crops even for soil
nothing can grow in. So every reading is graded here first, by explainable
thresholds that give the same answer every time:

* ``good``     - the reading is fine for most crops.
* ``caution``  - plantable, but only crops that tolerate it, and the farmer
                 should fix it.
* ``critical`` - the soil is not ready for planting. No crop is recommended
                 until it is fixed.

Then each catalog crop is checked against the readings (its pH range, and
whether it can stand wet or salty ground). Only the crops that fit are
offered to Gemini, so it can never recommend one that does not.

The thresholds are general agronomy ranges for tropical smallholder crops,
not lab precision. They are deliberately the same for every farmer, so two
farmers with the same readings always get the same verdict.
"""

from __future__ import annotations

from dataclasses import dataclass, field

GOOD = "good"
CAUTION = "caution"
CRITICAL = "critical"

# Overall verdicts.
FAVORABLE = "favorable"
NEEDS_CARE = "needs_care"
UNSUITABLE = "unsuitable"

# --- Reading thresholds ---------------------------------------------------
# (critical below, caution below, caution above, critical above). None means
# that side has no limit.
PH = (4.5, 5.5, 7.5, 8.5)
MOISTURE = (5, 15, 80, 90)  # percent
TEMPERATURE = (10, 18, 35, 40)  # degrees Celsius
CONDUCTIVITY = (None, None, 2000, 4000)  # microsiemens per cm (salt)
# Nutrients are fixable with fertilizer, so low N, P or K is only a caution.
NITROGEN_LOW = 20  # mg/kg
PHOSPHORUS_LOW = 10
POTASSIUM_LOW = 50

# --- What each catalog crop tolerates -------------------------------------
# pH range it grows in, and whether it rots in wet ground, suffers in salty
# ground, or wilts in hot soil. Keyed by Crop.id. A crop missing from this
# table (one an Admin added later) is only held to the general rules.
#
# "mushroom" is absent on purpose and excluded below: it grows on prepared
# substrate, not in the field soil being measured.
CROP_NEEDS = {
    # Fruits
    "starfruit": {"ph": (5.0, 7.5), "salt_sensitive": True},
    "guava": {"ph": (4.5, 8.2)},
    "passion-fruit": {"ph": (5.5, 7.5), "needs_drainage": True, "salt_sensitive": True},
    "grapes": {"ph": (5.5, 8.0), "needs_drainage": True},
    "cantaloupe": {"ph": (6.0, 7.5), "needs_drainage": True},
    "watermelon": {"ph": (5.0, 7.5), "needs_drainage": True},
    "orange-calamansi": {"ph": (5.5, 7.5), "needs_drainage": True, "salt_sensitive": True},
    "banana": {"ph": (5.0, 8.0)},
    "pineapple": {"ph": (4.5, 6.5), "needs_drainage": True},
    "soursop": {"ph": (5.0, 7.5), "needs_drainage": True},
    "java-plum": {"ph": (5.0, 8.0)},
    "papaya": {"ph": (5.5, 7.5), "needs_drainage": True},
    "pomelo": {"ph": (5.5, 7.5), "needs_drainage": True, "salt_sensitive": True},
    "sapodilla": {"ph": (5.5, 8.0)},
    "rambutan-lychee": {"ph": (4.5, 7.0), "salt_sensitive": True},
    "sugar-apple": {"ph": (5.5, 7.5), "needs_drainage": True},
    "jackfruit": {"ph": (5.0, 7.5), "needs_drainage": True},
    "avocado": {"ph": (5.5, 7.0), "needs_drainage": True, "salt_sensitive": True},
    "cacao": {"ph": (5.0, 7.5)},
    # Vegetables and other crops
    "pepper": {"ph": (5.5, 7.5), "needs_drainage": True, "salt_sensitive": True},
    "tomato": {"ph": (5.5, 7.5), "needs_drainage": True},
    "lettuce-cabbage": {"ph": (6.0, 7.5), "salt_sensitive": True, "heat_sensitive": True},
    "eggplant": {"ph": (5.5, 7.5)},
    "red-chili": {"ph": (5.5, 7.5), "needs_drainage": True, "salt_sensitive": True},
    "purple-sweet-potato": {"ph": (4.5, 7.0), "needs_drainage": True},
    "ginger": {"ph": (5.0, 7.0), "needs_drainage": True, "salt_sensitive": True},
    "lemongrass": {"ph": (5.0, 8.0)},
    "radish-jicama": {"ph": (5.5, 7.5), "needs_drainage": True, "salt_sensitive": True},
    "corn": {"ph": (5.5, 7.5), "salt_sensitive": True},
}

NOT_SOIL_GROWN = {"mushroom"}


@dataclass
class Finding:
    """One reading's grade. `code` names the problem for the UI's message."""

    field: str
    level: str
    code: str
    value: float | None = None

    def as_dict(self) -> dict:
        return {
            "field": self.field,
            "level": self.level,
            "code": self.code,
            "value": self.value,
        }


@dataclass
class SoilCheck:
    findings: list[Finding] = field(default_factory=list)
    # Ids of the catalog crops that can grow in this soil.
    fitting_crop_ids: list[str] = field(default_factory=list)

    @property
    def problems(self) -> list[Finding]:
        return [f for f in self.findings if f.level != GOOD]

    @property
    def critical(self) -> list[Finding]:
        return [f for f in self.findings if f.level == CRITICAL]

    @property
    def status(self) -> str:
        if self.critical or not self.fitting_crop_ids:
            return UNSUITABLE
        if self.problems:
            return NEEDS_CARE
        return FAVORABLE

    @property
    def unsuitable(self) -> bool:
        return self.status == UNSUITABLE

    def as_dict(self) -> dict:
        return {
            "status": self.status,
            "findings": [f.as_dict() for f in self.findings],
        }


def _number(value) -> float | None:
    return None if value is None else float(value)


def _grade(field_name, value, limits, low_code, high_code, good_code="ok"):
    """Grade a reading against (crit_low, caution_low, caution_high, crit_high)."""
    crit_low, warn_low, warn_high, crit_high = limits
    if crit_low is not None and value < crit_low:
        return Finding(field_name, CRITICAL, low_code, value)
    if crit_high is not None and value >= crit_high:
        return Finding(field_name, CRITICAL, high_code, value)
    if warn_low is not None and value < warn_low:
        return Finding(field_name, CAUTION, low_code, value)
    if warn_high is not None and value >= warn_high:
        return Finding(field_name, CAUTION, high_code, value)
    return Finding(field_name, GOOD, good_code, value)


def _findings(soil) -> list[Finding]:
    findings = []

    ph = _number(soil.soil_ph)
    if ph is not None:
        findings.append(_grade("soil_ph", ph, PH, "ph_low", "ph_high"))

    if not soil.has_sensor_readings:
        # Pre-detector rows only carry descriptions. Poor drainage with wet
        # ground is the one combination that clearly means waterlogging.
        wet = {soil.SoilMoisture.MOIST, soil.SoilMoisture.VERY_WET}
        if soil.legacy_drainage == soil.Drainage.POOR and soil.legacy_soil_moisture in wet:
            findings.append(Finding("soil_moisture", CAUTION, "moisture_high"))
        return findings

    moisture = _number(soil.soil_moisture)
    if moisture is not None:
        findings.append(
            _grade("soil_moisture", moisture, MOISTURE, "moisture_low", "moisture_high")
        )

    temperature = _number(soil.soil_temperature)
    if temperature is not None:
        findings.append(
            _grade("soil_temperature", temperature, TEMPERATURE, "temp_low", "temp_high")
        )

    conductivity = _number(soil.soil_conductivity)
    if conductivity is not None:
        findings.append(
            _grade("soil_conductivity", conductivity, CONDUCTIVITY, "salt_low", "salt_high")
        )

    for name, low, code in (
        ("nitrogen", NITROGEN_LOW, "n_low"),
        ("phosphorus", PHOSPHORUS_LOW, "p_low"),
        ("potassium", POTASSIUM_LOW, "k_low"),
    ):
        value = _number(getattr(soil, name))
        if value is None:
            continue
        level = CAUTION if value < low else GOOD
        findings.append(Finding(name, level, code if level == CAUTION else "ok", value))

    return findings


def crop_fits(crop_id: str, soil) -> bool:
    """True when this crop can grow in the reported soil."""
    if crop_id in NOT_SOIL_GROWN:
        return False
    needs = CROP_NEEDS.get(crop_id, {})

    ph = _number(soil.soil_ph)
    if ph is not None and "ph" in needs:
        low, high = needs["ph"]
        if not (low <= ph <= high):
            return False

    if soil.has_sensor_readings:
        moisture = _number(soil.soil_moisture)
        if needs.get("needs_drainage") and moisture is not None and moisture >= MOISTURE[2]:
            return False
        salt = _number(soil.soil_conductivity)
        if needs.get("salt_sensitive") and salt is not None and salt >= CONDUCTIVITY[2]:
            return False
        temperature = _number(soil.soil_temperature)
        if (
            needs.get("heat_sensitive")
            and temperature is not None
            and temperature >= TEMPERATURE[2]
        ):
            return False
    elif needs.get("needs_drainage"):
        wet = {soil.SoilMoisture.MOIST, soil.SoilMoisture.VERY_WET}
        if soil.legacy_drainage == soil.Drainage.POOR and soil.legacy_soil_moisture in wet:
            return False

    return True


def check_soil(soil, crops=None) -> SoilCheck:
    """
    Grade the soil and list the crops that fit it.

    `crops` is the active catalog; it is loaded when not given. When any
    reading is critical no crop fits, whatever its own tolerances.
    """
    if crops is None:
        from .models import Crop

        crops = Crop.objects.filter(is_active=True)

    result = SoilCheck(findings=_findings(soil))
    if not result.critical:
        result.fitting_crop_ids = [c.id for c in crops if crop_fits(c.id, soil)]
    return result


# Plain-English lines for the Gemini prompt. The farmer never sees these;
# the UI renders the same findings in their own language.
_PROMPT_TEXT = {
    "ph_low": "soil pH is too low (too sour) at {value:g}; most crops like 5.5 to 7.5",
    "ph_high": "soil pH is too high at {value:g}; most crops like 5.5 to 7.5",
    "moisture_low": "soil is too dry at {value:g}% moisture",
    "moisture_high": "soil is too wet at {value:g}% moisture, roots may rot",
    "temp_low": "soil is too cold at {value:g} degrees Celsius",
    "temp_high": "soil is too hot at {value:g} degrees Celsius",
    "salt_high": "soil is too salty at {value:g} microsiemens per cm",
    "n_low": "nitrogen is low at {value:g} mg/kg",
    "p_low": "phosphorus is low at {value:g} mg/kg",
    "k_low": "potassium is low at {value:g} mg/kg",
}


def prompt_lines(check: SoilCheck) -> list[str]:
    """The check's verdict, written for the model."""
    lines = ["", "SYSTEM SOIL CHECK (fixed rules; treat as fact)"]
    if not check.problems:
        lines.append("  All readings are within the normal range for most crops.")
    for finding in check.problems:
        template = _PROMPT_TEXT.get(finding.code)
        if template is None:
            continue
        text = (
            template.format(value=finding.value)
            if finding.value is not None
            else template.split(" at ")[0]
        )
        lines.append(f"  [{finding.level.upper()}] {text}")
    if check.unsuitable:
        lines += [
            "",
            "VERDICT: this soil is NOT ready for planting. Return EMPTY lists for",
            "suitable_fruits, suitable_vegetables and suitable_crops. Instead,",
            "explain in important_warnings why it is not ready, and use",
            "fertilizer_recommendations and soil_improvement_watering to say",
            "exactly how to fix each problem before planting and re-testing.",
        ]
    elif check.problems:
        lines += [
            "",
            "VERDICT: plantable with care. The catalog below already lists only",
            "crops that tolerate these problems. In each crop's reason, say how it",
            "copes with them, and give a warning for every CAUTION item above.",
        ]
    return lines

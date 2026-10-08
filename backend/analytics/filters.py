"""
The global analytics filter bar: date range, season, soil type, crop, farmer.

Parsed once per request and applied the same way by every aggregation, so
two cards on the dashboard can never disagree about what "this season" or
"Clay soil" means. Each aggregation reports which filters it honours
(`applies`), and the UI says so when one does not apply to a card.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from django.utils import timezone

# Philippine seasons (PAGASA): the south-west monsoon brings the wet season
# from June to November; December to May is the dry season.
WET_MONTHS = (6, 7, 8, 9, 10, 11)
DRY_MONTHS = (12, 1, 2, 3, 4, 5)
SEASON_LABELS = {"wet": "Wet season (Jun-Nov)", "dry": "Dry season (Dec-May)"}

# Soil records from the soil detector carry readings, not a soil type; only
# the older questionnaire rows recorded one. They are grouped honestly.
NOT_RECORDED = "not_recorded"
NOT_RECORDED_LABEL = "Not recorded"


class FilterError(Exception):
    """A malformed filter from the client."""


def season_of(day: date) -> str:
    return "wet" if day.month in WET_MONTHS else "dry"


@dataclass(frozen=True)
class Filters:
    date_from: date | None = None
    date_to: date | None = None
    season: str | None = None
    soil_type: str | None = None
    crop_id: str | None = None
    farmer_id: int | None = None

    def as_params(self) -> dict:
        """The filters as they were asked for, for report history and echoes."""
        out = {}
        if self.date_from:
            out["date_from"] = self.date_from.isoformat()
        if self.date_to:
            out["date_to"] = self.date_to.isoformat()
        for key in ("season", "soil_type", "crop_id", "farmer_id"):
            value = getattr(self, key)
            if value not in (None, ""):
                out[key] = value
        return out

    # --- Applying to querysets -------------------------------------------

    def dates(self, queryset, field: str, *, season=True, is_datetime=False):
        """
        Date range and season on `field`.

        Written as plain range comparisons, never `__date` or `__month`: on
        MySQL those convert time zones in SQL and silently match nothing when
        the server has no time-zone tables. Datetime fields get aware bounds
        in the farm's time zone.
        """
        if self.date_from or self.date_to:
            queryset = queryset.filter(range_q(field, self.date_from, self.date_to, is_datetime))
        if season and self.season:
            queryset = queryset.filter(season_q(field, self.season, is_datetime))
        return queryset

    def window(self) -> tuple[tuple[date, date], tuple[date, date]]:
        """
        The current period and the one before it, of equal length, for the
        KPI trends. Without a full date range, the last 30 days are compared
        with the 30 before them.
        """
        if self.date_from and self.date_to:
            length = (self.date_to - self.date_from).days + 1
            current = (self.date_from, self.date_to)
        else:
            end = self.date_to or timezone.localdate()
            length = 30
            current = (end - timedelta(days=length - 1), end)
        previous_end = current[0] - timedelta(days=1)
        previous = (previous_end - timedelta(days=length - 1), previous_end)
        return current, previous


def _bound(day: date, is_datetime: bool):
    if not is_datetime:
        return day
    return timezone.make_aware(datetime(day.year, day.month, day.day))


def range_q(field: str, start: date | None, end: date | None, is_datetime=False):
    """start <= field <= end (whole days), as a Q."""
    from django.db.models import Q

    q = Q()
    if start:
        q &= Q(**{f"{field}__gte": _bound(start, is_datetime)})
    if end:
        if is_datetime:
            q &= Q(**{f"{field}__lt": _bound(end + timedelta(days=1), True)})
        else:
            q &= Q(**{f"{field}__lte": end})
    return q


def season_q(field: str, season: str, is_datetime=False):
    """
    The wet or dry season of every year, as date ranges: Jun 1 to Nov 30 is
    wet; everything else is dry.
    """
    from django.db.models import Q

    this_year = timezone.localdate().year
    q = Q()
    for year in range(2015, this_year + 2):
        wet = range_q(field, date(year, 6, 1), date(year, 11, 30), is_datetime)
        q |= wet
    return q if season == "wet" else ~q


def _date(raw: str, name: str) -> date | None:
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        raise FilterError(f"{name} must be a date in YYYY-MM-DD format.")


def parse(params) -> Filters:
    from plants.models import SoilRecommendation

    date_from = _date((params.get("date_from") or "").strip(), "date_from")
    date_to = _date((params.get("date_to") or "").strip(), "date_to")
    if date_from and date_to and date_from > date_to:
        raise FilterError("date_from cannot be after date_to.")

    season = (params.get("season") or "").strip().lower() or None
    if season in ("all",):
        season = None
    if season and season not in SEASON_LABELS:
        raise FilterError("season must be wet or dry.")

    soil_type = (params.get("soil_type") or "").strip().lower() or None
    if soil_type in ("all",):
        soil_type = None
    valid_soil = {c for c, _ in SoilRecommendation.SoilType.choices if c != "unknown"} | {NOT_RECORDED}
    if soil_type and soil_type not in valid_soil:
        raise FilterError("Unknown soil_type.")

    crop_id = (params.get("crop") or "").strip() or None
    if crop_id in ("all",):
        crop_id = None

    farmer_raw = (params.get("farmer") or "").strip()
    farmer_id = None
    if farmer_raw and farmer_raw != "all":
        try:
            farmer_id = int(farmer_raw)
        except ValueError:
            raise FilterError("farmer must be a numeric id.")

    return Filters(date_from, date_to, season, soil_type, crop_id, farmer_id)

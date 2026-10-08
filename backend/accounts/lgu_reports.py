"""
LGU Officer reporting.

Every figure in every report is queried from MySQL through the ORM at request
time. Nothing is cached, hardcoded, or estimated, and no Gemini call is made:
AI text shown here is the result already stored when the Farmer submitted, so
generating a report costs no quota and returns the same answer twice.

Scope is identical to the rest of `lgu_views`: approved Farmers only. An
Officer never sees a pending, rejected or suspended Farmer's records through
these endpoints, and the queryset enforces that rather than the serializer.

Where a record genuinely has no data - an assessment whose AI evaluation
failed, a plant with no photo - the report says so. It never fills the gap.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from django.db.models import Count, Q
from django.utils import timezone

from .models import AccountStatus, User, UserRole

FARM_NAME = "Layuan Farm"
FARM_LOCATION = "Layuan Nature Integrated Farm, Bulan, Sorsogon"

# Mirrors HARVEST_APPROACHING_DAYS in lgu_views so both surfaces agree on
# what "upcoming" means.
HARVEST_APPROACHING_DAYS = 7


class ReportError(Exception):
    """A bad request from the client (unknown report, malformed dates)."""


# --------------------------------------------------------------------------
# Period filtering
# --------------------------------------------------------------------------

PERIOD_LABELS = {
    "this_week": "This Week",
    "this_month": "This Month",
    "last_3_months": "Last 3 Months",
    "this_year": "This Year",
    "all_time": "All Time",
    "custom": "Custom Range",
}


@dataclass(frozen=True)
class Period:
    """
    A resolved reporting window.

    `start`/`end` are inclusive dates or None for an open end. Resolving once
    up front means every builder filters on the same boundaries, so the
    figures in a report can be compared against each other.
    """

    key: str
    label: str
    start: date | None
    end: date | None

    def describe(self) -> str:
        if self.start is None and self.end is None:
            return "All records to date"
        fmt = "%b %d, %Y"
        if self.start and self.end:
            return f"{self.start.strftime(fmt)} - {self.end.strftime(fmt)}"
        if self.start:
            return f"From {self.start.strftime(fmt)}"
        return f"Up to {self.end.strftime(fmt)}"


def _parse_date(raw: str, field: str) -> date:
    from datetime import datetime

    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise ReportError(f"{field} must be a date in YYYY-MM-DD format.")


def resolve_period(key: str, date_from: str = "", date_to: str = "") -> Period:
    """Turns the client's period choice into concrete inclusive bounds."""
    key = (key or "all_time").strip()
    if key not in PERIOD_LABELS:
        raise ReportError(f"Unknown period '{key}'.")

    today = timezone.localdate()

    if key == "all_time":
        return Period(key, PERIOD_LABELS[key], None, None)
    if key == "this_week":
        # Monday-based, matching how a weekly assessment cycle is discussed.
        start = today - timedelta(days=today.weekday())
        return Period(key, PERIOD_LABELS[key], start, today)
    if key == "this_month":
        return Period(key, PERIOD_LABELS[key], today.replace(day=1), today)
    if key == "last_3_months":
        return Period(key, PERIOD_LABELS[key], today - timedelta(days=90), today)
    if key == "this_year":
        return Period(key, PERIOD_LABELS[key], today.replace(month=1, day=1), today)

    # custom
    if not date_from and not date_to:
        raise ReportError("A custom range needs date_from and/or date_to.")
    start = _parse_date(date_from, "date_from") if date_from else None
    end = _parse_date(date_to, "date_to") if date_to else None
    if start and end and start > end:
        raise ReportError("date_from cannot be after date_to.")
    return Period(key, PERIOD_LABELS[key], start, end)


def _apply_period(queryset, field: str, period: Period):
    if period.start:
        queryset = queryset.filter(**{f"{field}__gte": period.start})
    if period.end:
        queryset = queryset.filter(**{f"{field}__lte": period.end})
    return queryset


# --------------------------------------------------------------------------
# Shared scoping
# --------------------------------------------------------------------------

APPROVED_FARMER = {
    "role": UserRole.FARMER,
    "account_status": AccountStatus.APPROVED,
}


def _approved_farmers():
    return User.objects.filter(**APPROVED_FARMER)


def _display_name(user) -> str:
    return user.get_full_name() or user.email


def _optional_int(raw: str, field: str) -> int | None:
    if raw in (None, "", "all"):
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        raise ReportError(f"{field} must be a numeric id.")


# --------------------------------------------------------------------------
# Report builders
#
# Each returns a dict the frontend renders directly and the PDF writer
# consumes unchanged, so the screen and the printed page can never disagree.
# --------------------------------------------------------------------------


def _build_farmer_registration(period: Period, filters: dict) -> dict:
    farmers = User.objects.filter(role=UserRole.FARMER)
    scoped = _apply_period(farmers, "date_joined__date", period)

    buckets = scoped.aggregate(
        total=Count("id"),
        approved=Count("id", filter=Q(account_status=AccountStatus.APPROVED)),
        pending=Count("id", filter=Q(account_status=AccountStatus.PENDING)),
        rejected=Count("id", filter=Q(account_status=AccountStatus.REJECTED)),
        suspended=Count("id", filter=Q(account_status=AccountStatus.SUSPENDED)),
    )

    rows = [
        {
            "farmer": _display_name(u),
            "email": u.email,
            "status": u.get_account_status_display(),
            "registered": u.date_joined.date().isoformat(),
        }
        for u in scoped.order_by("-date_joined")[:500]
    ]

    return {
        "stats": [
            {"label": "Total Farmers", "value": buckets["total"]},
            {"label": "Active", "value": buckets["approved"], "tone": "low"},
            {"label": "Pending", "value": buckets["pending"], "tone": "medium"},
            {"label": "Suspended", "value": buckets["suspended"], "tone": "high"},
            {"label": "Rejected", "value": buckets["rejected"]},
        ],
        "tables": [
            {
                "title": "Farmer Registrations",
                "columns": ["Farmer", "Status", "Registered"],
                "keys": ["farmer", "status", "registered"],
                "widths": [3, 1.5, 1.5],
                "rows": rows,
            }
        ],
    }


def _build_plants(period: Period, filters: dict) -> dict:
    from plants.models import Plant, PlantStatus

    today = timezone.localdate()
    queryset = (
        Plant.objects.filter(
            farmer__role=UserRole.FARMER,
            farmer__account_status=AccountStatus.APPROVED,
        )
        # Without these the row loop below would issue two extra queries per
        # plant for the farmer and the crop.
        .select_related("farmer", "crop")
    )
    queryset = _apply_period(queryset, "planting_date", period)
    if filters.get("farmer_id"):
        queryset = queryset.filter(farmer_id=filters["farmer_id"])
    if filters.get("crop_id"):
        queryset = queryset.filter(crop_id=filters["crop_id"])

    rows = []
    for p in queryset.order_by("-planting_date")[:500]:
        age = (today - p.planting_date).days
        if p.expected_harvest_end < today:
            harvest = "Window closed"
        elif p.expected_harvest_start <= today:
            harvest = "Window open"
        elif (p.expected_harvest_start - today).days <= HARVEST_APPROACHING_DAYS:
            harvest = "Approaching"
        else:
            harvest = "Not yet due"
        rows.append(
            {
                "farmer": _display_name(p.farmer),
                "crop": p.crop.name,
                "plant": p.display_name,
                "crop_plant": f"{p.crop.name} - {p.display_name}",
                "planted": p.planting_date.isoformat(),
                "harvest_start": p.expected_harvest_start.isoformat(),
                "age": f"{age} days ({age // 7} wk)",
                "status": p.get_status_display(),
                "harvest_status": harvest,
                "harvest": f"{p.expected_harvest_start.isoformat()} ({harvest})",
            }
        )

    counts = queryset.aggregate(
        total=Count("id"),
        growing=Count("id", filter=Q(status=PlantStatus.GROWING)),
        ready=Count("id", filter=Q(status=PlantStatus.READY_FOR_HARVEST)),
        harvested=Count("id", filter=Q(status=PlantStatus.HARVESTED)),
    )

    return {
        "stats": [
            {"label": "Plants", "value": counts["total"]},
            {"label": "Growing", "value": counts["growing"], "tone": "low"},
            {"label": "Ready for Harvest", "value": counts["ready"], "tone": "medium"},
            {"label": "Harvested", "value": counts["harvested"]},
        ],
        "tables": [
            {
                "title": "Plant Records",
                "columns": ["Farmer", "Plant", "Planted", "Harvest From", "Status"],
                "keys": ["farmer", "crop_plant", "planted", "harvest", "status"],
                "widths": [2, 2.2, 1.3, 2.3, 1.5],
                "rows": rows,
            }
        ],
    }


def _assessment_queryset(period: Period, filters: dict):
    from plants.models import Assessment

    queryset = (
        Assessment.objects.filter(
            plant__farmer__role=UserRole.FARMER,
            plant__farmer__account_status=AccountStatus.APPROVED,
        )
        .select_related("plant", "plant__crop", "plant__farmer", "risk")
    )
    queryset = _apply_period(queryset, "assessment_date", period)
    if filters.get("farmer_id"):
        queryset = queryset.filter(plant__farmer_id=filters["farmer_id"])
    if filters.get("crop_id"):
        queryset = queryset.filter(plant__crop_id=filters["crop_id"])
    return queryset


def _first_or_blank(items, key=None):
    if not items:
        return ""
    first = items[0]
    if key and isinstance(first, dict):
        return str(first.get(key, ""))
    return str(first)


def _build_risk(period: Period, filters: dict) -> dict:
    queryset = _assessment_queryset(period, filters)

    level = (filters.get("risk_level") or "").upper()
    if level in ("LOW", "MEDIUM", "HIGH"):
        queryset = queryset.filter(risk__risk_level=level)
    elif level not in ("", "ALL"):
        raise ReportError("risk_level must be LOW, MEDIUM, HIGH or ALL.")

    rows = []
    for a in queryset.order_by("-assessment_date", "-created_at")[:500]:
        risk = getattr(a, "risk", None)
        analysed = risk is not None and risk.status == "completed"
        rows.append(
            {
                "farmer": _display_name(a.plant.farmer),
                "plant": f"{a.plant.crop.name} - {a.plant.display_name}",
                "date": a.assessment_date.isoformat(),
                "level": risk.get_risk_level_display() if analysed and risk.risk_level else "No reading",
                "summary": (risk.summary if analysed else "")
                or (risk.failure_reason if risk else "")
                # Never invent an assessment the model did not produce.
                or "AI recommendation not available",
                "reason": _first_or_blank(risk.risk_factors, "factor") if analysed else "",
                "action": _first_or_blank(risk.recommended_actions, "recommendation")
                or _first_or_blank(risk.recommended_actions)
                if analysed
                else "",
                "evidence": "Photo attached" if a.evidence_image else "No evidence submitted",
                "assessment_id": a.pk,
                "has_evidence": bool(a.evidence_image),
            }
        )

    counts = queryset.aggregate(
        total=Count("id"),
        high=Count("id", filter=Q(risk__risk_level="HIGH")),
        medium=Count("id", filter=Q(risk__risk_level="MEDIUM")),
        low=Count("id", filter=Q(risk__risk_level="LOW")),
        unanalysed=Count("id", filter=Q(risk__isnull=True)),
    )

    return {
        "stats": [
            {"label": "Assessments", "value": counts["total"]},
            {"label": "High Risk", "value": counts["high"], "tone": "high"},
            {"label": "Medium Risk", "value": counts["medium"], "tone": "medium"},
            {"label": "Low Risk", "value": counts["low"], "tone": "low"},
            {"label": "No AI Reading", "value": counts["unanalysed"]},
        ],
        "tables": [
            {
                "title": "Risk Assessments",
                "columns": ["Farmer", "Plant", "Date", "Risk", "Finding", "Recommended Action"],
                "keys": ["farmer", "plant", "date", "level", "summary", "action"],
                "widths": [1.4, 1.7, 1.3, 1.3, 3, 2.6],
                "tone_key": "level",
                "rows": rows,
            }
        ],
    }


def _build_monitoring(period: Period, filters: dict) -> dict:
    """
    Field monitoring has no table of its own. Everything an Officer would
    want from a monitoring log - condition, watering, observations, notes -
    is recorded on the weekly Assessment, so this reports those columns
    rather than inventing a second source of truth.
    """
    queryset = _assessment_queryset(period, filters)

    rows = []
    for a in queryset.order_by("-assessment_date", "-created_at")[:500]:
        risk = getattr(a, "risk", None)
        observations = " / ".join(
            part
            for part in (
                a.pest_observation.strip(),
                a.disease_observation.strip(),
                a.environmental_observations.strip(),
            )
            if part
        )
        rows.append(
            {
                "farmer": _display_name(a.plant.farmer),
                "crop": a.plant.crop.name,
                "date": a.assessment_date.isoformat(),
                "condition": f"{a.get_health_condition_display()} / {a.get_growth_condition_display()}",
                "watering": a.get_watering_frequency_display(),
                "moisture": a.get_soil_moisture_display() if a.soil_moisture else "Not recorded",
                "observations": observations or "None reported",
                "risk": risk.get_risk_level_display() if risk and risk.risk_level else "No reading",
                "notes": a.notes.strip() or "No notes",
            }
        )

    return {
        "stats": [
            {"label": "Monitoring Entries", "value": queryset.count()},
            {"label": "Plants Covered", "value": queryset.values("plant_id").distinct().count()},
            {"label": "Farmers Reporting", "value": queryset.values("plant__farmer_id").distinct().count()},
        ],
        "tables": [
            {
                "title": "Field Monitoring Log",
                "columns": ["Farmer", "Crop", "Date", "Condition", "Observations", "Risk"],
                "keys": ["farmer", "crop", "date", "condition", "observations", "risk"],
                "widths": [1.5, 1.2, 1.3, 2.1, 3.2, 1.3],
                "tone_key": "risk",
                "rows": rows,
            }
        ],
    }


def _build_summary(period: Period, filters: dict) -> dict:
    from plants.models import Assessment, Plant, PlantStatus, SoilRecommendation

    today = timezone.localdate()
    farmers = _apply_period(User.objects.filter(role=UserRole.FARMER), "date_joined__date", period)
    farmer_counts = farmers.aggregate(
        total=Count("id"),
        approved=Count("id", filter=Q(account_status=AccountStatus.APPROVED)),
    )

    plants = Plant.objects.filter(
        farmer__role=UserRole.FARMER, farmer__account_status=AccountStatus.APPROVED
    ).exclude(status__in=[PlantStatus.HARVESTED, PlantStatus.ARCHIVED])

    assessments = _apply_period(
        Assessment.objects.filter(
            plant__farmer__role=UserRole.FARMER,
            plant__farmer__account_status=AccountStatus.APPROVED,
        ),
        "assessment_date",
        period,
    )
    risk = assessments.aggregate(
        high=Count("id", filter=Q(risk__risk_level="HIGH")),
        medium=Count("id", filter=Q(risk__risk_level="MEDIUM")),
        low=Count("id", filter=Q(risk__risk_level="LOW")),
    )

    soil = _apply_period(
        SoilRecommendation.objects.filter(farmer__account_status=AccountStatus.APPROVED),
        "created_at__date",
        period,
    ).count()

    upcoming = plants.filter(
        expected_harvest_end__gte=today,
        expected_harvest_start__lte=today + timedelta(days=HARVEST_APPROACHING_DAYS),
    ).count()

    recent_registrations = [
        {
            "farmer": _display_name(u),
            "status": u.get_account_status_display(),
            "registered": u.date_joined.date().isoformat(),
        }
        for u in farmers.order_by("-date_joined")[:10]
    ]

    recent_activity = [
        {
            "farmer": _display_name(a.plant.farmer),
            "crop": a.plant.crop.name,
            "date": a.assessment_date.isoformat(),
            "risk": a.risk.get_risk_level_display()
            if getattr(a, "risk", None) and a.risk.risk_level
            else "No reading",
        }
        for a in assessments.select_related(
            "plant", "plant__crop", "plant__farmer", "risk"
        ).order_by("-assessment_date", "-created_at")[:10]
    ]

    return {
        "stats": [
            {"label": "Total Farmers", "value": farmer_counts["total"]},
            {"label": "Active Farmers", "value": farmer_counts["approved"], "tone": "low"},
            {"label": "Active Plants", "value": plants.count()},
            {"label": "High Risk", "value": risk["high"], "tone": "high"},
            {"label": "Medium Risk", "value": risk["medium"], "tone": "medium"},
            {"label": "Low Risk", "value": risk["low"], "tone": "low"},
            {"label": "Soil Assessments", "value": soil},
            {"label": "Upcoming Harvests", "value": upcoming},
        ],
        "tables": [
            {
                "title": "Recent Monitoring Activity",
                "columns": ["Farmer", "Crop", "Date", "Risk"],
                "keys": ["farmer", "crop", "date", "risk"],
                "tone_key": "risk",
                "rows": recent_activity,
            },
            {
                "title": "Recent Farmer Registrations",
                "columns": ["Farmer", "Status", "Registered"],
                "keys": ["farmer", "status", "registered"],
                "rows": recent_registrations,
            },
        ],
    }


def _analytics_filters(period: Period, filters: dict):
    """The report's parameters as the analytics module's filters."""
    from analytics.filters import Filters

    return Filters(
        date_from=period.start,
        date_to=period.end,
        soil_type=filters.get("soil_type") or None,
        crop_id=filters.get("crop_id") or None,
        farmer_id=filters.get("farmer_id"),
    )


def _build_crop_recommendations(period: Period, filters: dict) -> dict:
    from analytics import services

    data = services.crop_recommendations(_analytics_filters(period, filters))
    crops = data["crops"]
    return {
        "stats": [
            {"label": "Analysed soil records", "value": data["analysed_records"]},
            {"label": "Crops recommended", "value": len(crops)},
            {"label": "Recommendations made", "value": data["row_count"], "tone": "low"},
        ],
        "tables": [
            {
                "title": "Most recommended crops",
                "columns": ["Crop", "Times recommended", "Recommendation rate", "Wet season", "Dry season", "Soil types"],
                "keys": ["crop", "count", "rate", "wet", "dry", "soil"],
                "widths": [2, 1.3, 1.4, 1, 1, 2.4],
                "rows": [
                    {
                        "crop": c["name"],
                        "count": c["count"],
                        "rate": f"{c['rate']}%",
                        "wet": c["by_season"]["wet"],
                        "dry": c["by_season"]["dry"],
                        "soil": ", ".join(f"{x['label']} ({x['count']})" for x in c["by_soil"]),
                    }
                    for c in crops
                ],
            },
            {
                "title": "Recommendations",
                "columns": ["Date", "Farmer", "Crop", "Soil type", "Season"],
                "keys": ["date", "farmer", "crop", "soil_type", "season"],
                "widths": [1.2, 2, 1.8, 1.4, 1.8],
                "rows": data["rows"],
            },
        ],
    }


def _build_harvest(period: Period, filters: dict) -> dict:
    from analytics import services

    data = services.harvest_trends(_analytics_filters(period, filters))
    table = data["table"]
    planted = sum(r["planted"] for r in table)
    harvested = sum(r["harvested"] for r in table)
    return {
        "stats": [
            {"label": "Harvests recorded", "value": data["total_harvests"], "tone": "low"},
            {"label": "Plants planted", "value": planted},
            {"label": "Ready for harvest", "value": sum(r["ready"] for r in table), "tone": "medium"},
            {"label": "Harvest rate (%)", "value": round(100 * harvested / planted) if planted else 0},
        ],
        "tables": [
            {
                "title": "Productivity by crop",
                "columns": ["Crop", "Planted", "Harvested", "Harvest rate", "Avg. days to harvest", "Expected days", "Ready now"],
                "keys": ["name", "planted", "harvested", "rate", "days", "expected_days", "ready"],
                "widths": [2, 1, 1, 1.1, 1.4, 1.2, 1],
                "rows": [
                    {
                        **r,
                        "rate": f"{r['harvest_rate']}%",
                        "days": r["avg_days_to_harvest"] if r["avg_days_to_harvest"] is not None else "No harvest yet",
                    }
                    for r in table
                ],
            },
            {
                "title": "Planting and harvest by month",
                "columns": ["Month", "Planted", "Harvested"],
                "keys": ["month", "planted", "harvested"],
                "widths": [2, 1, 1],
                "rows": [
                    {"month": m, "planted": pl, "harvested": hv}
                    for m, pl, hv in zip(data["months"], data["planted"], data["harvested"])
                    if pl or hv
                ],
            },
        ],
    }


# --------------------------------------------------------------------------
# Catalog
# --------------------------------------------------------------------------

REPORTS = {
    "agricultural-summary": {
        "title": "Agricultural Summary",
        "category": "Executive Overview",
        "description": "Farm-wide totals across farmers, plants, risk readings, soil assessments and upcoming harvests.",
        "icon": "chart",
        "builder": _build_summary,
        "supports": ["period"],
    },
    "risk-assessment": {
        "title": "Risk Assessment Report",
        "category": "Technical Report",
        "description": "Weekly AI risk readings with what was found and the recommended action for each assessment.",
        "icon": "radar",
        "builder": _build_risk,
        "supports": ["period", "area", "farmer", "crop", "risk_level"],
    },
    "plant-crop": {
        "title": "Plant & Crop Report",
        "category": "Performance Report",
        "description": "Every registered plant with its planting date, harvest window and status.",
        "icon": "sprout",
        "builder": _build_plants,
        "supports": ["period", "farmer", "crop"],
    },
    "farm-monitoring": {
        "title": "Farm Monitoring Report",
        "category": "Field Records",
        "description": "Plant condition and field observations recorded in each weekly assessment.",
        "icon": "activity",
        "builder": _build_monitoring,
        "supports": ["period", "farmer", "crop"],
    },
    "farmer-registration": {
        "title": "Farmer Registration Report",
        "category": "Administrative",
        "description": "Farmer accounts by status with registration dates.",
        "icon": "users",
        "builder": _build_farmer_registration,
        "supports": ["period", "area"],
    },
    "crop-recommendation": {
        "title": "Crop Recommendation Report",
        "category": "Analytics",
        "description": "Crops recommended from soil records: how often, in which season and on which soil types. Advisory, based on farmer-provided soil inputs.",
        "icon": "flask",
        "builder": _build_crop_recommendations,
        "supports": ["period", "area", "farmer", "crop", "soil_type"],
    },
    "harvest": {
        "title": "Harvest Report",
        "category": "Analytics",
        "description": "Harvests recorded per crop and month, the harvest rate, and days from planting to harvest. Harvests are counted, not weighed.",
        "icon": "sprout",
        "builder": _build_harvest,
        "supports": ["period", "area", "farmer", "crop"],
    },
}


def _latest_activity(slug: str):
    """
    The most recent record the report covers, so the catalog can show a real
    "updated" date instead of the time the page happened to be opened.
    """
    from plants.models import Assessment, Plant

    if slug == "farmer-registration":
        row = _approved_farmers().order_by("-date_joined").values_list("date_joined", flat=True).first()
        return row.date() if row else None
    if slug == "crop-recommendation":
        from plants.models import SoilRecommendation

        row = (
            SoilRecommendation.objects.filter(farmer__account_status=AccountStatus.APPROVED, ai_generated=True)
            .order_by("-created_at")
            .values_list("created_at", flat=True)
            .first()
        )
        return timezone.localtime(row).date() if row else None
    if slug == "harvest":
        row = (
            Plant.objects.filter(farmer__account_status=AccountStatus.APPROVED, harvested_at__isnull=False)
            .order_by("-harvested_at")
            .values_list("harvested_at", flat=True)
            .first()
        )
        return timezone.localtime(row).date() if row else None
    if slug == "plant-crop":
        return (
            Plant.objects.filter(farmer__account_status=AccountStatus.APPROVED)
            .order_by("-planting_date")
            .values_list("planting_date", flat=True)
            .first()
        )
    # risk, monitoring and the summary all track the assessment table.
    return (
        Assessment.objects.filter(plant__farmer__account_status=AccountStatus.APPROVED)
        .order_by("-assessment_date")
        .values_list("assessment_date", flat=True)
        .first()
    )


def catalog() -> list[dict]:
    """The Available Reports list, newest activity first."""
    items = []
    for slug, spec in REPORTS.items():
        updated = _latest_activity(slug)
        items.append(
            {
                "slug": slug,
                "title": spec["title"],
                "category": spec["category"],
                "description": spec["description"],
                "icon": spec["icon"],
                "supports": spec["supports"],
                "updated": updated.isoformat() if updated else None,
            }
        )
    items.sort(key=lambda i: (i["updated"] or ""), reverse=True)
    if items:
        items[0]["latest"] = True
    return items


def build(slug: str, period: Period, filters: dict, prepared_by: str = "") -> dict:
    spec = REPORTS.get(slug)
    if spec is None:
        raise ReportError(f"Unknown report '{slug}'.")

    payload = spec["builder"](period, filters)
    return {
        "slug": slug,
        "title": spec["title"],
        "category": spec["category"],
        "description": spec["description"],
        "icon": spec["icon"],
        "supports": spec["supports"],
        "farm": {"name": FARM_NAME, "location": FARM_LOCATION},
        "period": {
            "key": period.key,
            "label": period.label,
            "range": period.describe(),
            "start": period.start.isoformat() if period.start else None,
            "end": period.end.isoformat() if period.end else None,
        },
        "generated_at": timezone.now().isoformat(),
        # The signed-in Officer, for the "Prepared by" line on a printout.
        "prepared_by": prepared_by,
        "stats": payload.get("stats", []),
        "tables": payload.get("tables", []),
    }


def filter_options() -> dict:
    """Farmer and crop choices for the filter bar, from real rows only."""
    from plants.models import Crop

    return {
        "farmers": [
            {"id": u.id, "name": _display_name(u)}
            for u in _approved_farmers().order_by("first_name", "last_name", "email")
        ],
        "crops": [
            {"id": c.id, "name": c.name}
            for c in Crop.objects.filter(is_active=True).order_by("name")
        ],
        "periods": [{"key": k, "label": v} for k, v in PERIOD_LABELS.items()],
        # One farm today; kept as a parameter so a report states its area.
        "areas": [{"key": "layuan", "label": FARM_NAME}],
        "soil_types": _soil_type_options(),
        "risk_levels": [
            {"key": "ALL", "label": "All Levels"},
            {"key": "HIGH", "label": "High Risk"},
            {"key": "MEDIUM", "label": "Medium Risk"},
            {"key": "LOW", "label": "Low Risk"},
        ],
    }


def parse_filters(params) -> dict:
    return {
        "farmer_id": _optional_int(params.get("farmer", ""), "farmer"),
        "crop_id": (params.get("crop") or "").strip() or None,
        "risk_level": (params.get("risk_level") or "").strip(),
        "soil_type": _soil_type(params.get("soil_type", "")),
        "area": _area(params.get("area", "")),
    }


def _soil_type_options() -> list[dict]:
    from plants.models import SoilRecommendation

    return [
        {"key": key, "label": label}
        for key, label in SoilRecommendation.SoilType.choices
        if key not in ("unknown", "other")
    ] + [{"key": "not_recorded", "label": "Not recorded"}]


def _soil_type(raw: str):
    value = (raw or "").strip().lower()
    if value in ("", "all"):
        return None
    if value not in {o["key"] for o in _soil_type_options()}:
        raise ReportError("Unknown soil_type.")
    return value


def _area(raw: str) -> str:
    value = (raw or "").strip().lower()
    if value not in ("", "all", "layuan"):
        raise ReportError("Unknown area.")
    return "layuan"

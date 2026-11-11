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


def _build_harvest_outcomes(period: Period, filters: dict) -> dict:
    """
    How harvested plants turned out, from each Farmer's harvest report (the
    final assessment). Plants harvested before reports existed are not in it.
    """
    from plants.harvest_report import losses_in_scope, outcomes, reports_in_scope

    queryset = _apply_period(reports_in_scope(), "harvested_on", period)
    losses = losses_in_scope()
    if period.start:
        losses = losses.filter(lost_at__date__gte=period.start)
    if period.end:
        losses = losses.filter(lost_at__date__lte=period.end)
    if filters.get("farmer_id"):
        queryset = queryset.filter(plant__farmer_id=filters["farmer_id"])
        losses = losses.filter(plant__farmer_id=filters["farmer_id"])
    if filters.get("crop_id"):
        queryset = queryset.filter(plant__crop_id=filters["crop_id"])
        losses = losses.filter(plant__crop_id=filters["crop_id"])
    data = outcomes(queryset[:500], recent=500, losses=losses[:500])

    def pct(value):
        return f"{value}%" if value is not None else "-"

    def amount(report):
        if report.yield_amount is None:
            return "Not given"
        return f"{report.yield_amount.normalize():f} {report.get_yield_unit_display()}"

    return {
        "stats": [
            {"label": "Harvest reports", "value": data["total"], "tone": "low"},
            {"label": "Healthy at harvest (%)", "value": data["healthy_rate"] or 0, "tone": "low"},
            {"label": "Advice helped (%)", "value": data["advice_helped_rate"] or 0},
            {"label": "Harvested on time (%)", "value": data["on_time_rate"] or 0},
            {
                "label": "Recovered from High risk",
                "value": f"{data['recovered_healthy']} of {data['reached_high_risk']}",
                "tone": "medium",
            },
            {"label": "Plants lost", "value": data["lost_total"], "tone": "high"},
            {"label": "Survival rate (%)", "value": data["survival_rate"] or 0},
            {
                "label": "Warned before loss",
                "value": f"{data['warned_before_loss']} of {data['lost_total']}",
            },
        ],
        "tables": [
            {
                "title": "Outcomes by crop",
                "columns": ["Crop", "Harvests", "Healthy", "Good quality", "On time", "Avg. days", "Avg. yield"],
                "keys": ["crop", "harvests", "healthy", "good", "on_time", "days", "yield"],
                "widths": [1.6, 1, 1, 1.1, 1, 1, 1.8],
                "rows": [
                    {
                        "crop": c["crop"],
                        "harvests": c["harvests"],
                        "healthy": pct(c["healthy_rate"]),
                        "good": pct(c["good_quality_rate"]),
                        "on_time": pct(c["on_time_rate"]),
                        "days": c["average_days"],
                        "yield": "; ".join(
                            f"{y['average']:g} {y['unit_label']}" for y in c["average_yield"]
                        )
                        or "Not given",
                    }
                    for c in data["by_crop"]
                ],
            },
            {
                "title": "Harvest reports",
                "columns": ["Harvested", "Farmer", "Plant", "Amount", "Quality", "Health", "Advice helped", "Timing", "Highest risk"],
                "keys": ["date", "farmer", "plant", "amount", "quality", "health", "advice", "timing", "risk"],
                "widths": [1.1, 1.5, 1.5, 1.1, 0.9, 1.2, 1, 0.9, 1],
                "rows": [
                    {
                        "date": r.harvested_on.isoformat(),
                        "farmer": _display_name(r.plant.farmer),
                        "plant": r.plant.display_name,
                        "amount": amount(r),
                        "quality": r.get_quality_display(),
                        "health": r.get_final_health_display(),
                        "advice": r.get_advice_helped_display(),
                        "timing": r.get_timing_display(),
                        "risk": (r.highest_risk.title() if r.highest_risk else "No reading"),
                    }
                    for r in data["recent"]
                ],
            },
            {
                "title": "Causes of loss",
                "columns": ["Cause", "Plants lost"],
                "keys": ["label", "count"],
                "widths": [2, 1],
                "rows": [c for c in data["causes"] if c["count"]],
            },
            {
                "title": "Lost plants",
                "columns": ["Reported", "Farmer", "Plant", "Cause", "Noticed", "Age (days)", "Last risk", "Warned before"],
                "keys": ["date", "farmer", "plant", "cause", "noticed", "age", "risk", "warned"],
                "widths": [1.1, 1.5, 1.5, 1.3, 1, 0.9, 1, 1],
                "rows": [
                    {
                        "date": timezone.localtime(r.lost_at).date().isoformat(),
                        "farmer": _display_name(r.plant.farmer),
                        "plant": r.plant.display_name,
                        "cause": r.get_cause_display(),
                        "noticed": r.get_noticed_display(),
                        "age": r.age_days,
                        "risk": r.last_risk.title() if r.last_risk else "No reading",
                        "warned": "Yes" if r.warned_before else "No",
                    }
                    for r in data["recent_losses"]
                ],
            },
        ],
    }


# --------------------------------------------------------------------------
# Catalog
# --------------------------------------------------------------------------

REPORTS = {
    "risk-assessment": {
        "title": "Risk Assessment Report",
        "category": "Technical Report",
        "description": "Weekly AI risk readings with what was found and the recommended action for each assessment.",
        "icon": "radar",
        "builder": _build_risk,
        "supports": ["period", "area", "farmer", "crop", "risk_level"],
    },
    "farmer-registration": {
        "title": "Farmer Registration Report",
        "category": "Administrative",
        "description": "Farmer accounts by status with registration dates.",
        "icon": "users",
        "builder": _build_farmer_registration,
        "supports": ["period", "area"],
    },
    "harvest-outcomes": {
        "title": "Harvest Outcomes Report",
        "category": "System Effectiveness",
        "description": "How monitored plants turned out, from each farmer's harvest and loss reports: health, quality, timing, recovery from High risk, survival, causes of loss, and whether the advice and warnings helped.",
        "icon": "sprout",
        "builder": _build_harvest_outcomes,
        "supports": ["period", "farmer", "crop"],
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
    if slug == "harvest-outcomes":
        from plants.harvest_report import reports_in_scope

        return reports_in_scope().order_by("-harvested_on").values_list("harvested_on", flat=True).first()
    # The risk report tracks the assessment table.
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


def build(
    slug: str, period: Period, filters: dict, prepared_by: str = "", prepared_by_role: str = ""
) -> dict:
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
        # Their position, under the signature line.
        "prepared_by_role": prepared_by_role or "LGU Agricultural Officer",
        # Key findings in plain sentences, where a report has them.
        "findings": payload.get("findings", []),
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

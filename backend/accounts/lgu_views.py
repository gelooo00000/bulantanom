"""
LGU Officer read-only monitoring API.

Every statistic here is computed from MySQL via the Django ORM. Nothing is
hardcoded and nothing is accepted from the client — the frontend only
displays what these endpoints return.

Scope note: Farmer accounts, Plants, Assessments, Risk evaluations, Soil
Recommendations and upcoming Harvest windows are all reported with real
figures. Harvest windows are derived from `Plant.expected_harvest_start`,
which Django calculated from the Crop table at planting time — the same
stored dates the Harvest screen and `notify_harvest_windows` already use, so
every surface agrees.

What still has no model is the *actual harvest record* (what was picked, when
and how much). Nothing here claims otherwise: this counts windows that are
open or approaching, never yield.
"""

from django.db.models import Count, Q
from django.http import HttpResponse
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import AccountStatus, User, UserRole
from .permissions import IsLguOfficer
from .serializers import UserSerializer

FARM_NAME = "Layuan Farm"
FARM_LOCATION = "Layuan Nature Integrated Farm, Bulan, Sorsogon"

# Metrics the LGU dashboard is designed to show but which have no backing
# model yet. Surfaced to the frontend so the UI can render an honest
# "not yet available" state instead of a fabricated number.
#
# Currently empty: every figure on the dashboard is now queried. The list and
# its frontend notice are kept because they are the mechanism that stops a
# future unbacked metric being shown as a plausible-looking 0.
UNAVAILABLE_METRICS = []


# Matches APPROACHING_WINDOW_DAYS in
# notifications/management/commands/notify_harvest_windows.py, so a plant
# counted here is the same one the system notifies about.
HARVEST_APPROACHING_DAYS = 7


def _plant_counts():
    """
    Real plant totals across approved Farmers, straight from MySQL. Excludes
    plants belonging to non-approved Farmers so the LGU view matches the
    active-Farmer figure beside it.
    """
    from plants.models import Plant

    queryset = Plant.objects.filter(
        farmer__role=UserRole.FARMER, farmer__account_status=AccountStatus.APPROVED
    )
    return {
        "total": queryset.count(),
        "growing": queryset.filter(status="GROWING").count(),
        "ready_for_harvest": queryset.filter(status="READY_FOR_HARVEST").count(),
        "harvested": queryset.filter(status="HARVESTED").count(),
    }


def _upcoming_harvest_count(farmer=None):
    """
    Plants whose harvest window is open or opens within the next week.

    Read from `Plant.expected_harvest_start/end`, which Django calculated
    from the Crop table at planting time — no date is invented here and no
    Gemini call is made. Plants already harvested or archived are excluded,
    as are plants whose window has closed.

    This is a real query, so 0 truthfully means "queried and found none".
    It counts *windows*, never yield: actual harvest records still have no
    model.
    """
    from datetime import timedelta

    from django.utils import timezone

    from plants.models import Plant, PlantStatus

    today = timezone.localdate()
    queryset = Plant.objects.filter(
        farmer__role=UserRole.FARMER,
        farmer__account_status=AccountStatus.APPROVED,
        expected_harvest_end__gte=today,
        expected_harvest_start__lte=today + timedelta(days=HARVEST_APPROACHING_DAYS),
    ).exclude(status__in=[PlantStatus.HARVESTED, PlantStatus.ARCHIVED])

    if farmer is not None:
        queryset = queryset.filter(farmer=farmer)
    return queryset.count()


def _soil_recommendation_counts(farmer=None):
    """
    Real soil-recommendation totals from MySQL. `generated` counts rows where
    Gemini actually returned advice, so the LGU can tell a saved-but-
    unanalysed assessment apart from a complete one.
    """
    from plants.models import SoilRecommendation

    queryset = SoilRecommendation.objects.all()
    if farmer is not None:
        queryset = queryset.filter(farmer=farmer)
    else:
        queryset = queryset.filter(farmer__account_status=AccountStatus.APPROVED)

    total = queryset.count()
    generated = queryset.filter(ai_generated=True).count()
    return {
        "total": total,
        "generated": generated,
        "pending_analysis": total - generated,
    }


def _assessment_count():
    """Total weekly assessments submitted by approved Farmers."""
    from plants.models import Assessment

    return Assessment.objects.filter(
        plant__farmer__role=UserRole.FARMER,
        plant__farmer__account_status=AccountStatus.APPROVED,
    ).count()


def _farmer_counts():
    """
    One conditional-aggregation query for every Farmer status bucket,
    rather than five separate COUNT queries.
    """
    return User.objects.filter(role=UserRole.FARMER).aggregate(
        total=Count("id"),
        approved=Count("id", filter=Q(account_status=AccountStatus.APPROVED)),
        pending=Count("id", filter=Q(account_status=AccountStatus.PENDING)),
        rejected=Count("id", filter=Q(account_status=AccountStatus.REJECTED)),
        suspended=Count("id", filter=Q(account_status=AccountStatus.SUSPENDED)),
    )


@api_view(["GET"])
@permission_classes([IsLguOfficer])
def lgu_dashboard(request):
    """GET /api/lgu/dashboard/ — aggregated Layuan Farm summary."""
    counts = _farmer_counts()
    officer_count = User.objects.filter(
        role=UserRole.LGU_OFFICER, account_status=AccountStatus.APPROVED
    ).count()

    return Response(
        {
            "farm": {"name": FARM_NAME, "location": FARM_LOCATION},
            "farmers": {
                # "active" is the headline figure: approved Farmers only.
                "active": counts["approved"],
                "pending": counts["pending"],
                "rejected": counts["rejected"],
                "suspended": counts["suspended"],
                "total": counts["total"],
            },
            "lgu_officers": officer_count,
            # Real, queried from the Plant / Assessment / Risk tables.
            "plants": _plant_counts(),
            "risk": _risk_counts(),
            "assessments": _assessment_count(),
            # Real: plants whose stored harvest window is open or opens
            # within the next week. 0 here means "queried and found none".
            "harvest": _upcoming_harvest_count(),
            # Real, queried from the SoilRecommendation table.
            "soil_recommendations": _soil_recommendation_counts(),
            "unavailable_metrics": UNAVAILABLE_METRICS,
        }
    )


class LguFarmerListView(generics.ListAPIView):
    """
    GET /api/lgu/farmers/         — approved Farmers (the LGU's working set)
    GET /api/lgu/farmers/?status=PENDING — filter by account status
    GET /api/lgu/farmers/?status=ALL     — every Farmer regardless of status

    Returns only the safe UserSerializer fields; never a password or hash.
    """

    serializer_class = UserSerializer
    permission_classes = [IsLguOfficer]

    def get_queryset(self):
        queryset = User.objects.filter(role=UserRole.FARMER)
        requested = self.request.query_params.get("status", AccountStatus.APPROVED)
        if requested == "ALL":
            return queryset
        if requested in AccountStatus.values:
            return queryset.filter(account_status=requested)
        return queryset.filter(account_status=AccountStatus.APPROVED)


class LguFarmerDetailView(generics.RetrieveAPIView):
    """GET /api/lgu/farmers/{id}/ — one Farmer's safe profile."""

    serializer_class = UserSerializer
    permission_classes = [IsLguOfficer]
    queryset = User.objects.filter(role=UserRole.FARMER)

    def retrieve(self, request, *args, **kwargs):
        from plants.models import Assessment

        user = self.get_object()
        assessments = Assessment.objects.filter(plant__farmer=user)
        # A plant is counted once, on its latest reading only — so a plant
        # that recovered is not still counted as high risk.
        high_risk = sum(
            1
            for a in _latest_assessments_for_farmer(user)
            if getattr(a, "risk", None) and a.risk.risk_level == "HIGH"
        )
        return Response(
            {
                "farmer": UserSerializer(user).data,
                # Real: this Farmer's own records, queried from MySQL.
                "plants": user.plants.count(),
                "assessments": assessments.count(),
                "high_risk": high_risk,
                "upcoming_harvest": _upcoming_harvest_count(user),
                "soil_recommendations": _soil_recommendation_counts(user),
                "unavailable_metrics": UNAVAILABLE_METRICS,
            }
        )


@api_view(["GET"])
@permission_classes([IsLguOfficer])
def lgu_farm_overview(request):
    """GET /api/lgu/farm/ — single-farm (Layuan) overview. No multi-farm support by design."""
    counts = _farmer_counts()
    return Response(
        {
            "farm": {"name": FARM_NAME, "location": FARM_LOCATION},
            "farmers": {"active": counts["approved"], "total": counts["total"]},
            "plants": _plant_counts(),
            "unavailable_metrics": UNAVAILABLE_METRICS,
        }
    )


# ---------------------------------------------------------------------------
# LGU risk monitoring — real aggregation from the Assessment / RiskAssessment
# tables. Read-only: Officers can view Farmer data but never modify it.
# ---------------------------------------------------------------------------


def _latest_assessment_per_plant(plants):
    """Most recent assessment for each plant in `plants`, as a list of rows."""
    from plants.models import Assessment

    latest = []
    for plant in plants.select_related("crop", "farmer"):
        assessment = (
            Assessment.objects.filter(plant=plant)
            .select_related("risk", "plant__crop", "plant__farmer")
            .order_by("-assessment_date", "-created_at")
            .first()
        )
        if assessment:
            latest.append(assessment)
    return latest


def _latest_assessments_for_approved_farmers():
    """Most recent assessment per plant, across approved Farmers only."""
    from plants.models import Plant

    return _latest_assessment_per_plant(
        Plant.objects.filter(
            farmer__role=UserRole.FARMER, farmer__account_status=AccountStatus.APPROVED
        )
    )


def _latest_assessments_for_farmer(farmer):
    """Most recent assessment per plant for one Farmer."""
    from plants.models import Plant

    return _latest_assessment_per_plant(Plant.objects.filter(farmer=farmer))


def _risk_counts():
    """
    One entry per plant, not per assessment: a plant that has never been
    assessed counts as `unassessed`, so the four numbers always add up to
    the plant total rather than silently hiding unmonitored plants.
    """
    from plants.models import Plant

    counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "unassessed": 0}
    total_plants = Plant.objects.filter(
        farmer__role=UserRole.FARMER, farmer__account_status=AccountStatus.APPROVED
    ).count()

    for assessment in _latest_assessments_for_approved_farmers():
        risk = getattr(assessment, "risk", None)
        level = risk.risk_level if risk and risk.risk_level else None
        if level in ("LOW", "MEDIUM", "HIGH"):
            counts[level] += 1
        else:
            counts["unassessed"] += 1

    counted = counts["LOW"] + counts["MEDIUM"] + counts["HIGH"] + counts["unassessed"]
    counts["unassessed"] += total_plants - counted
    return counts


def _serialize_case(assessment, request):
    from plants.serializers import AssessmentSerializer

    farmer = assessment.plant.farmer
    data = AssessmentSerializer(assessment, context={"request": request}).data
    data["farmer"] = {
        "id": farmer.id,
        "full_name": farmer.get_full_name(),
        "email": farmer.email,
    }
    return data


@api_view(["GET"])
@permission_classes([IsLguOfficer])
def lgu_risk_overview(request):
    """GET /api/lgu/risk/overview/ — real risk distribution across Layuan Farm."""
    return Response(
        {
            "counts": _risk_counts(),
            "cases": [
                _serialize_case(a, request)
                for a in _latest_assessments_for_approved_farmers()
            ],
        }
    )


@api_view(["GET"])
@permission_classes([IsLguOfficer])
def lgu_high_risk(request):
    """GET /api/lgu/risk/high-risk/ — plants whose latest reading is HIGH or MEDIUM."""
    cases = [
        a
        for a in _latest_assessments_for_approved_farmers()
        if getattr(a, "risk", None) and a.risk.risk_level in ("HIGH", "MEDIUM")
    ]
    # Highest severity first.
    cases.sort(key=lambda a: 0 if a.risk.risk_level == "HIGH" else 1)
    return Response([_serialize_case(a, request) for a in cases])


@api_view(["GET"])
@permission_classes([IsLguOfficer])
def lgu_assessment_history(request):
    """GET /api/lgu/assessments/history/ — all assessments from approved Farmers."""
    from plants.models import Assessment

    assessments = (
        Assessment.objects.filter(
            plant__farmer__role=UserRole.FARMER,
            plant__farmer__account_status=AccountStatus.APPROVED,
        )
        .select_related("plant", "plant__crop", "plant__farmer", "risk")
        .order_by("-assessment_date", "-created_at")
    )
    return Response([_serialize_case(a, request) for a in assessments])


class LguSoilRecommendationListView(generics.ListAPIView):
    """
    GET /api/lgu/soil-recommendations/            — all approved Farmers' records
    GET /api/lgu/soil-recommendations/?farmer=<id> — one Farmer's records

    Read-only monitoring, newest first. Restricted to approved Farmers so the
    list matches the active-Farmer figure shown beside it on the dashboard.
    """

    permission_classes = [IsLguOfficer]

    def get_serializer_class(self):
        from plants.serializers import LguSoilRecommendationSerializer

        return LguSoilRecommendationSerializer

    def get_queryset(self):
        from plants.models import SoilRecommendation

        queryset = SoilRecommendation.objects.select_related("farmer").filter(
            farmer__account_status=AccountStatus.APPROVED
        )
        farmer_id = self.request.query_params.get("farmer")
        if farmer_id and farmer_id.isdigit():
            queryset = queryset.filter(farmer_id=int(farmer_id))
        return queryset


@api_view(["GET"])
@permission_classes([IsLguOfficer])
def lgu_plants(request):
    """
    GET /api/lgu/plants/ — every plant belonging to an approved Farmer.

    Backs both the LGU Plants and Harvest screens, which previously rendered
    a hardcoded "the Plant model is not implemented" placeholder even though
    the model has been live for some time. Scoped to approved Farmers so the
    list matches the active-Farmer figure on the dashboard.

    The latest risk level is attached per plant using the same
    "one reading per plant" helper the risk screens use, so a plant that has
    recovered is not still reported at its worst historical level.
    """
    from plants.models import Plant
    from plants.serializers import PlantSerializer

    plants = (
        Plant.objects.filter(
            farmer__role=UserRole.FARMER,
            farmer__account_status=AccountStatus.APPROVED,
        )
        .select_related("crop", "farmer")
        .order_by("expected_harvest_start")
    )

    # Latest reading per plant, resolved once rather than per row.
    latest_risk = {}
    for assessment in _latest_assessment_per_plant(plants):
        risk = getattr(assessment, "risk", None)
        latest_risk[assessment.plant_id] = {
            "risk_level": risk.risk_level if risk and risk.risk_level else None,
            "assessment_id": assessment.pk,
            "assessment_date": assessment.assessment_date,
            "has_evidence": bool(assessment.evidence_image),
        }

    payload = []
    for plant in plants:
        data = PlantSerializer(plant, context={"request": request}).data
        data["farmer"] = {
            "id": plant.farmer_id,
            "full_name": plant.farmer.get_full_name(),
            "email": plant.farmer.email,
        }
        data["latest_risk"] = latest_risk.get(plant.pk)
        payload.append(data)

    return Response(payload)


# --------------------------------------------------------------------------
# Detailed Reports
#
# Guarded by IsLguOfficer like every other route in this module, so the
# authorization is enforced by the server and not by the frontend route.
# --------------------------------------------------------------------------


@api_view(["GET"])
@permission_classes([IsLguOfficer])
def lgu_report_catalog(request):
    """GET /api/lgu/reports/ - available reports plus real filter choices."""
    from . import lgu_reports

    return Response(
        {"reports": lgu_reports.catalog(), "filters": lgu_reports.filter_options()}
    )


def _report_from_request(request, slug):
    """Shared parsing for the detail and PDF routes."""
    from . import lgu_reports

    period = lgu_reports.resolve_period(
        request.query_params.get("period", "all_time"),
        request.query_params.get("date_from", ""),
        request.query_params.get("date_to", ""),
    )
    filters = lgu_reports.parse_filters(request.query_params)
    return lgu_reports.build(slug, period, filters)


@api_view(["GET"])
@permission_classes([IsLguOfficer])
def lgu_report_detail(request, slug):
    """GET /api/lgu/reports/<slug>/ - the report, built from live MySQL rows."""
    from .lgu_reports import ReportError

    try:
        return Response(_report_from_request(request, slug))
    except ReportError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([IsLguOfficer])
def lgu_report_pdf(request, slug):
    """
    GET /api/lgu/reports/<slug>/pdf/ - the same report as a real PDF.

    Rendered server-side from the stored rows, so it never depends on the
    browser's theme and contains selectable text rather than a screenshot.
    """
    from . import report_pdf
    from .lgu_reports import ReportError

    try:
        report = _report_from_request(request, slug)
    except ReportError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    pdf = report_pdf.render(report)
    filename = f"bulantanom-{slug}-{report['period']['key']}.pdf"
    response = HttpResponse(pdf, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    # A report is a snapshot of the moment it was asked for.
    response["Cache-Control"] = "private, max-age=0, no-store"
    return response

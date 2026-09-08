import logging
import os
from datetime import date

from django.conf import settings
from django.db import transaction
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.generics import ListAPIView
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import AccountStatus, UserRole
from accounts.permissions import IsApproved, IsFarmer
from notifications.services import (
    notify_assessment_evaluated,
    notify_assessment_submitted,
    notify_evidence_result,
    notify_plant_added,
    notify_plant_updated,
    notify_risk_level_changed,
    notify_soil_recommendation,
    notify_soil_warning,
)

from . import evidence_token
from .assessment_schedule import eligibility, with_last_assessment_date
from .crop_intelligence_service import get_or_create_crop_intelligence, is_configured
from .soil_recommendation_service import (
    apply_recommendation,
    generate_soil_recommendation,
)
from .models import Assessment, Crop, Plant, RiskStatus, SoilRecommendation
from .serializers import (
    AssessmentSerializer,
    CropIntelligenceSerializer,
    CropSerializer,
    PlantSerializer,
    SoilRecommendationSerializer,
    validate_evidence_file,
)

logger = logging.getLogger(__name__)

UNAVAILABLE_MESSAGE = (
    "Crop intelligence is temporarily unavailable. Your plant can still be added."
)


class CropListView(ListAPIView):
    """
    GET /api/farmer/crops/ — the authoritative crop catalog from MySQL.
    Available to any approved account so the picker works for every role
    that may eventually need it.
    """

    serializer_class = CropSerializer
    permission_classes = [IsApproved]
    queryset = Crop.objects.filter(is_active=True)


class FarmerPlantViewSet(viewsets.ModelViewSet):
    """
    /api/farmer/plants/  (list, create)
    /api/farmer/plants/{id}/  (retrieve, update, partial_update, destroy)

    Ownership is enforced in `get_queryset` — the queryset is *always*
    filtered to `request.user`, so requesting another Farmer's plant id
    returns 404 rather than leaking that it exists. `perform_create` sets
    the owner from the authenticated user; a `farmer` field in the request
    body is ignored because the serializer does not declare one.
    """

    serializer_class = PlantSerializer
    permission_classes = [IsFarmer]

    def get_queryset(self):
        # Annotated so each plant's weekly-assessment eligibility is derived
        # without a per-row query when listing.
        return with_last_assessment_date(
            Plant.objects.filter(farmer=self.request.user).select_related("crop")
        ).order_by("-created_at")

    def perform_create(self, serializer):
        plant = serializer.save(farmer=self.request.user)
        # Queued for after commit, so a rolled-back create notifies nobody.
        notify_plant_added(plant)

    def perform_update(self, serializer):
        plant = serializer.save()
        notify_plant_updated(plant)


@api_view(["GET"])
@permission_classes([IsFarmer])
def crop_intelligence(request, crop_id):
    """
    GET /api/farmer/crops/{crop_id}/intelligence/?planting_date=YYYY-MM-DD

    Returns the calculated harvest window (always, from the Crop table) plus
    cached Gemini crop intelligence (best-effort).

    Gemini is never a hard dependency: on any failure this still returns 200
    with `intelligence: null` and an `unavailable_reason`, so the Add Plant
    flow can proceed and the Farmer can save their plant.
    """
    try:
        crop = Crop.objects.get(pk=crop_id, is_active=True)
    except Crop.DoesNotExist:
        return Response(
            {"detail": "Please select a valid crop."}, status=status.HTTP_404_NOT_FOUND
        )

    harvest_start = harvest_end = None
    planting_date_raw = request.query_params.get("planting_date")
    planting_date = None
    if planting_date_raw:
        try:
            planting_date = date.fromisoformat(planting_date_raw)
        except ValueError:
            return Response(
                {"detail": "Please select a valid planting date."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        harvest_start, harvest_end = Plant.calculate_harvest_window(crop, planting_date)

    intelligence, generated_now = get_or_create_crop_intelligence(crop)

    return Response(
        {
            "crop": CropSerializer(crop).data,
            # Calculated by Django from crop metadata — never AI-generated.
            "harvest_window": (
                {
                    "planting_date": planting_date.isoformat(),
                    "expected_harvest_start": harvest_start.isoformat(),
                    "expected_harvest_end": harvest_end.isoformat(),
                    "growing_duration_days": crop.growing_duration_days,
                    "harvest_window_days": crop.harvest_window_days,
                    "source": "crop_database_calculation",
                }
                if planting_date
                else None
            ),
            "intelligence": (
                CropIntelligenceSerializer(intelligence).data if intelligence else None
            ),
            "intelligence_generated_now": generated_now,
            "unavailable_reason": (
                None
                if intelligence
                else (
                    UNAVAILABLE_MESSAGE
                    if is_configured()
                    else "Crop intelligence is not configured on this server."
                )
            ),
        }
    )


# ---------------------------------------------------------------------------
# Weekly assessments + AI risk evaluation
# ---------------------------------------------------------------------------


def _run_risk_evaluation(assessment):
    """
    Evaluates an assessment and persists the result.

    On any Gemini failure the RiskAssessment row is still created, with
    status FAILED and risk_level left NULL — the farmer's assessment and
    evidence are never lost, and no risk level is fabricated.
    """
    from .models import RiskAssessment, RiskStatus
    from .risk_evaluation_service import evaluate_assessment, is_configured

    result = evaluate_assessment(assessment)

    if result is None:
        return RiskAssessment.objects.create(
            assessment=assessment,
            status=RiskStatus.FAILED,
            failure_reason=(
                "AI risk analysis is temporarily unavailable."
                if is_configured()
                else "AI risk analysis is not configured on this server."
            ),
            model_name=settings.GEMINI_MODEL if is_configured() else "",
        )

    return RiskAssessment.objects.create(
        assessment=assessment,
        status=RiskStatus.COMPLETED,
        risk_level=result["risk_level"],
        summary=result["summary"],
        reality_vs_expectation=result["reality_vs_expectation"],
        visual_observations=result["visual_observations"],
        risk_factors=result["risk_factors"],
        possible_causes=result["possible_causes"],
        recommended_actions=result["recommended_actions"],
        monitoring_advice=result["monitoring_advice"],
        limitations=result["limitations"],
        next_assessment_days=result["next_assessment_days"],
        image_analyzed=result["image_analyzed"],
        model_name=settings.GEMINI_MODEL,
    )


EVIDENCE_UNAVAILABLE_MESSAGE = (
    "Plant evidence could not be verified right now. Please try again in a moment."
)


def _read_upload(image) -> tuple[bytes, str]:
    """Bytes and MIME type of an uploaded evidence image, without saving it."""
    image.seek(0)
    data = image.read()
    image.seek(0)
    name = (getattr(image, "name", "") or "").lower()
    content_type = (getattr(image, "content_type", "") or "").lower()
    mime = "image/png" if name.endswith(".png") or content_type == "image/png" else "image/jpeg"
    return data, mime


def _verify_evidence(request, plant, image) -> dict:
    """
    Confirm the uploaded photo shows this plant's crop.

    Returns {"outcome": "verified"|"rejected"|"unavailable", "result": ...}.

    A client may present the token issued by the validate-evidence endpoint to
    skip a second Gemini call. That token is an HMAC bound to these exact
    image bytes, this plant and this farmer, so it proves *this server*
    already validated *this* image — it is not the client's word being
    trusted. Without a valid token the check simply runs again here.
    """
    from .evidence_validation_service import validate_crop_evidence

    image_bytes, mime = _read_upload(image)

    token = request.data.get("evidence_token")
    if token and evidence_token.verify(token, request.user.id, plant.id, image_bytes):
        return {
            "outcome": "verified",
            "result": {
                "evidence_valid": True,
                "verdict": "match",
                "expected_crop": plant.crop.name,
                "verified_at_upload": True,
            },
        }

    result = validate_crop_evidence(plant.crop, image_bytes, mime)
    if result is None:
        # Fail closed: an unavailable check is never treated as a pass.
        return {"outcome": "unavailable", "result": None}
    if not result["evidence_valid"]:
        return {"outcome": "rejected", "result": result}
    return {"outcome": "verified", "result": result}


@api_view(["GET"])
@permission_classes([IsFarmer])
def plant_assessment_eligibility(request, plant_id):
    """
    GET /api/farmer/plants/{plant_id}/assessments/eligibility/

    The authoritative answer to "can this plant be assessed today?". The
    plant is scoped to the authenticated Farmer, so this cannot be used to
    probe another Farmer's schedule.
    """
    plant = get_object_or_404(Plant, pk=plant_id, farmer=request.user)
    return Response(eligibility(plant))


@api_view(["POST"])
@permission_classes([IsFarmer])
def validate_plant_evidence(request, plant_id):
    """
    POST /api/farmer/plants/{plant_id}/evidence/validate/

    Checks an uploaded photo against the plant's crop *before* the assessment
    is submitted. The image is held in memory only — nothing is written to
    disk here, so a rejected photo leaves no orphan file and the Farmer keeps
    their in-progress form.

    On success a short-lived signed token is returned so submitting the same
    image does not pay for a second Gemini call.
    """
    plant = get_object_or_404(
        Plant.objects.select_related("crop"), pk=plant_id, farmer=request.user
    )

    image = request.FILES.get("evidence_image")
    if image is None:
        return Response(
            {"detail": "No plant photo was uploaded."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        validate_evidence_file(image)
    except DRFValidationError as exc:
        return Response(
            {"evidence_image": exc.detail}, status=status.HTTP_400_BAD_REQUEST
        )

    from .evidence_validation_service import validate_crop_evidence

    image_bytes, mime = _read_upload(image)
    result = validate_crop_evidence(plant.crop, image_bytes, mime)

    if result is None:
        return Response(
            {
                "detail": EVIDENCE_UNAVAILABLE_MESSAGE,
                "evidence_validation_unavailable": True,
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    notify_evidence_result(plant, accepted=result["evidence_valid"])

    payload = dict(result)
    if result["evidence_valid"]:
        payload["evidence_token"] = evidence_token.issue(
            request.user.id, plant.id, image_bytes
        )
    return Response(payload)


class PlantAssessmentListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/farmer/plants/{plant_id}/assessments/  — this plant's history
    POST /api/farmer/plants/{plant_id}/assessments/  — submit a weekly assessment

    The plant is resolved from the URL *scoped to request.user*, so a Farmer
    cannot post an assessment onto someone else's plant.
    """

    serializer_class = AssessmentSerializer
    permission_classes = [IsFarmer]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_plant(self):
        return get_object_or_404(
            Plant, pk=self.kwargs["plant_id"], farmer=self.request.user
        )

    def get_queryset(self):
        return (
            Assessment.objects.filter(plant=self.get_plant())
            .select_related("plant", "plant__crop", "risk")
            .order_by("-assessment_date", "-created_at")
        )

    def create(self, request, *args, **kwargs):
        plant = self.get_plant()

        # 1. Weekly eligibility, decided from MySQL — not from the client.
        schedule = eligibility(plant)
        if not schedule["can_assess"]:
            return Response(
                {
                    "detail": (
                        "You have already completed this week's assessment for this "
                        f"plant. The next one is available on "
                        f"{schedule['next_assessment_date']}."
                    ),
                    "assessment_eligibility": schedule,
                },
                status=status.HTTP_409_CONFLICT,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        assessment_date = timezone.localdate()
        if assessment_date < plant.planting_date:
            return Response(
                {"detail": "Assessment date cannot be before the planting date."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Evidence is required, and must be verified before any risk work.
        image = serializer.validated_data.get("evidence_image")
        if not image:
            return Response(
                {
                    "detail": "A plant photo is required so the evidence can be verified.",
                    "evidence_required": True,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        verification = _verify_evidence(request, plant, image)
        if verification["outcome"] == "unavailable":
            return Response(
                {
                    "detail": EVIDENCE_UNAVAILABLE_MESSAGE,
                    "evidence_validation_unavailable": True,
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if verification["outcome"] == "rejected":
            return Response(
                {
                    "detail": verification["result"]["reason"],
                    "evidence_validation": verification["result"],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Plant age is computed here — never accepted from the client.
        age_days = (assessment_date - plant.planting_date).days

        assessment = serializer.save(
            plant=plant,
            assessment_date=assessment_date,
            plant_age_days=age_days,
            evidence_validated=True,
            evidence_validation=verification["result"],
        )

        # 3. Only now does the risk evaluation run, on verified evidence. Its
        #    existing graceful failure is preserved: a Gemini outage records a
        #    FAILED risk rather than losing the farmer's assessment.
        risk = _run_risk_evaluation(assessment)
        assessment.refresh_from_db()

        # 4. Notify only once the assessment and its risk row are stored, and
        #    only from the stored values — no extra Gemini call is made to
        #    write notification text. A failed evaluation produces no risk
        #    notification, because there is no level to report.
        notify_assessment_submitted(assessment, eligibility(plant))
        notify_assessment_evaluated(assessment, risk)
        # Separate from the reading above: only fires if the level moved.
        notify_risk_level_changed(assessment, risk)

        return Response(
            self.get_serializer(assessment).data, status=status.HTTP_201_CREATED
        )


class AssessmentDetailView(generics.RetrieveAPIView):
    """GET /api/farmer/assessments/{id}/ — own assessments only."""

    serializer_class = AssessmentSerializer
    permission_classes = [IsFarmer]

    def get_queryset(self):
        return Assessment.objects.filter(plant__farmer=self.request.user).select_related(
            "plant", "plant__crop", "risk"
        )


@api_view(["POST"])
@permission_classes([IsFarmer])
def reanalyze_assessment(request, pk):
    """
    POST /api/farmer/assessments/{id}/reanalyze/

    Re-runs the AI evaluation for an assessment whose analysis previously
    failed. The stored answers and evidence photo are reused untouched, so
    this is a pure retry — never a way to edit a submitted assessment.
    Assessments that already completed are left alone.
    """
    assessment = get_object_or_404(
        Assessment.objects.select_related("plant", "plant__crop", "risk"),
        pk=pk,
        plant__farmer=request.user,
    )

    existing = getattr(assessment, "risk", None)
    if existing and existing.status == RiskStatus.COMPLETED:
        return Response(
            AssessmentSerializer(assessment, context={"request": request}).data
        )

    if existing:
        existing.delete()
    risk = _run_risk_evaluation(assessment)
    assessment.refresh_from_db()
    # A retry that finally succeeds still notifies once — the earlier failed
    # attempt produced no risk notification, and the dedupe key makes a
    # second success a no-op.
    notify_assessment_evaluated(assessment, risk)
    notify_risk_level_changed(assessment, risk)
    return Response(
        AssessmentSerializer(assessment, context={"request": request}).data
    )


@api_view(["GET"])
@permission_classes([IsFarmer])
def farmer_risk_overview(request):
    """
    GET /api/farmer/risk/
    Latest risk per plant for the authenticated Farmer, plus real counts.
    """
    plants = Plant.objects.filter(farmer=request.user).select_related("crop")
    counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "unassessed": 0}
    items = []

    for plant in plants:
        latest = (
            Assessment.objects.filter(plant=plant)
            .select_related("risk", "plant__crop")
            .order_by("-assessment_date", "-created_at")
            .first()
        )
        risk = getattr(latest, "risk", None) if latest else None
        level = risk.risk_level if risk and risk.risk_level else None
        if level in counts:
            counts[level] += 1
        else:
            counts["unassessed"] += 1

        items.append(
            {
                "plant": PlantSerializer(plant).data,
                "latest_assessment": (
                    AssessmentSerializer(latest, context={"request": request}).data
                    if latest
                    else None
                ),
            }
        )

    return Response({"counts": counts, "plants": items})


@api_view(["GET"])
@permission_classes([IsFarmer])
def farmer_risk_history(request):
    """GET /api/farmer/risk/history/ — every assessment this Farmer has submitted."""
    assessments = (
        Assessment.objects.filter(plant__farmer=request.user)
        .select_related("plant", "plant__crop", "risk")
        .order_by("-assessment_date", "-created_at")
    )
    return Response(
        AssessmentSerializer(assessments, many=True, context={"request": request}).data
    )


class SoilRecommendationListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/farmer/soil-recommendations/  — this Farmer's saved history.
    POST /api/farmer/soil-recommendations/  — save soil info, then generate.
    POST /api/farmer/soil-recommendations/?analyze=0 — save only, no Gemini.

    Gemini runs on POST only, and `analyze=0` skips even that. It backs
    "Back to Dashboard": the Farmer's soil information is persisted straight
    away without waiting on (or spending) an AI call, and the row is returned
    with `ai_generated: false`. Listing and retrieving read straight from
    MySQL, so opening a past recommendation never spends quota.

    A Gemini failure does not fail the request: the soil assessment is
    already committed and is returned with `ai_generated: false` plus a
    message, so the Farmer never loses what they typed.
    """

    # Soil fields compared when deciding whether a save is a duplicate.
    SOIL_FIELDS = (
        "soil_type",
        "soil_texture",
        "drainage",
        "soil_moisture",
        "ph_level",
        "nitrogen",
        "phosphorus",
        "potassium",
        "organic_matter",
        "notes",
    )

    serializer_class = SoilRecommendationSerializer
    permission_classes = [IsFarmer, IsApproved]

    def get_queryset(self):
        return SoilRecommendation.objects.filter(farmer=self.request.user)

    def _existing_unanalysed(self, data):
        """
        This Farmer's already-saved, not-yet-analysed assessment holding
        exactly this soil information, if one exists.

        Double-clicking "Back to Soil Information" fires two identical POSTs;
        without this the second would land as a second identical row. Only
        un-analysed rows are matched, so a completed recommendation is never
        silently reused.
        """
        lookup = {
            field: data.get(field, "" if field == "notes" else None)
            for field in self.SOIL_FIELDS
        }
        return (
            SoilRecommendation.objects.filter(
                farmer=self.request.user, ai_generated=False, **lookup
            )
            .order_by("-created_at")
            .first()
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        save_only = request.query_params.get("analyze") in {"0", "false", "no"}
        if save_only:
            # Serialised per Farmer: a double-click fires two POSTs that
            # overlap, and without a lock both would look up "no existing
            # row" before either committed and each would insert one.
            #
            # The lock is taken over this Farmer's own soil rows, not their
            # accounts_user row: the insert below already needs a shared lock
            # on that parent row for the foreign key, so holding it
            # exclusively here deadlocked under concurrency. Locking the child
            # range takes InnoDB next-key locks that serialise concurrent
            # inserts for this Farmer without touching the parent.
            #
            # Only the save-only path locks, so a Gemini call is never delayed.
            with transaction.atomic():
                list(
                    SoilRecommendation.objects.select_for_update()
                    .filter(farmer=request.user, ai_generated=False)
                    .values_list("pk", flat=True)
                )

                existing = self._existing_unanalysed(serializer.validated_data)
                if existing is not None:
                    # Idempotent: return the row we already hold rather than
                    # stacking up identical assessments.
                    return Response(self.get_serializer(existing).data)

                self.perform_create(serializer)

            headers = self.get_success_headers(serializer.data)
            return Response(
                serializer.data, status=status.HTTP_201_CREATED, headers=headers
            )

        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )

    def perform_create(self, serializer):
        # Save the Farmer's input first so it survives any AI outage.
        soil = serializer.save(farmer=self.request.user)

        # `analyze=0` means "persist what they typed, skip the AI" — used by
        # the Back button so leaving the page is instant and costs no quota.
        if self.request.query_params.get("analyze") in {"0", "false", "no"}:
            notify_soil_recommendation(soil, analyzed=False)
            # Concerning readings are worth flagging even without an AI result.
            notify_soil_warning(soil)
            return

        analyzed = apply_recommendation(soil, generate_soil_recommendation(soil))
        notify_soil_recommendation(soil, analyzed=analyzed)
        notify_soil_warning(soil)


class SoilRecommendationDetailView(generics.RetrieveAPIView):
    """
    GET /api/farmer/soil-recommendations/{id}/

    Pure database read — re-opening a saved result costs no Gemini quota.
    """

    serializer_class = SoilRecommendationSerializer
    permission_classes = [IsFarmer, IsApproved]

    def get_queryset(self):
        return SoilRecommendation.objects.filter(farmer=self.request.user)


@api_view(["GET"])
@permission_classes([IsFarmer, IsApproved])
def latest_soil_recommendation(request):
    """
    GET /api/farmer/soil-recommendations/latest/

    Lets the page restore the Farmer's most recent result on load without
    calling Gemini. Returns 204 when they have never submitted one.
    """
    soil = SoilRecommendation.objects.filter(farmer=request.user).first()
    if soil is None:
        return Response(status=status.HTTP_204_NO_CONTENT)
    return Response(SoilRecommendationSerializer(soil).data)


class AssessmentEvidenceView(APIView):
    """
    GET /api/farmer/assessments/{id}/evidence/
    GET /api/lgu/assessments/{id}/evidence/

    Serves a plant-evidence photo only after authorizing the caller.

    Previously these files sat under a public MEDIA_URL route: the random
    filename was the only thing standing between an anonymous request and a
    Farmer's photo, which is obscurity rather than access control.

    Nothing in the path is trusted. The Assessment is resolved from the
    database by primary key and every decision is made from the stored row,
    so a forged farmer/plant segment or filename cannot reach another
    Farmer's file. A caller who may not see the row gets the same 404 as one
    asking for a row that does not exist, so the endpoint never confirms that
    someone else's evidence exists.
    """

    permission_classes = [IsApproved]

    # Mirrors the upload validation — evidence is only ever JPEG or PNG.
    CONTENT_TYPES = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
    }

    def _may_view(self, user, assessment) -> bool:
        """
        Reuses the roles the rest of the API already enforces rather than
        inventing a second policy:

        * Farmer  — their own assessments only.
        * Officer — assessments belonging to approved Farmers, exactly the
          scope `accounts.lgu_views` already reports on.
        * Admin   — same scope as an Officer, for support and moderation.
        """
        farmer = assessment.plant.farmer

        if user.role == UserRole.FARMER:
            return assessment.plant.farmer_id == user.pk

        if user.role in (UserRole.LGU_OFFICER, UserRole.ADMIN):
            return (
                farmer.role == UserRole.FARMER
                and farmer.account_status == AccountStatus.APPROVED
            )

        return False

    def get(self, request, pk):
        assessment = (
            Assessment.objects.select_related("plant", "plant__farmer")
            .filter(pk=pk)
            .first()
        )

        # One indistinguishable 404 for "no such row", "not yours" and "no
        # photo attached" — otherwise the status code leaks which it was.
        if (
            assessment is None
            or not assessment.evidence_image
            or not self._may_view(request.user, assessment)
        ):
            return Response(
                {"detail": "Evidence not found."}, status=status.HTTP_404_NOT_FOUND
            )

        name = assessment.evidence_image.name
        extension = os.path.splitext(name)[1].lower()
        content_type = self.CONTENT_TYPES.get(extension, "application/octet-stream")

        try:
            handle = assessment.evidence_image.open("rb")
        except (FileNotFoundError, OSError):
            # The row survived but the file did not — report it as missing
            # rather than raising a 500 that exposes a filesystem path.
            logger.warning("Evidence file missing for assessment %s.", assessment.pk)
            return Response(
                {"detail": "Evidence not found."}, status=status.HTTP_404_NOT_FOUND
            )

        response = FileResponse(handle, content_type=content_type)
        # Never let a shared cache hold a per-user authorized image.
        response["Cache-Control"] = "private, max-age=0, no-store"
        return response

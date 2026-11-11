import logging
import os
from datetime import date

from django.conf import settings
from django.db import transaction
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.generics import ListAPIView
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import AccountStatus, UserRole
from accounts.permissions import IsAdmin, IsApproved, IsFarmer, IsLguOfficer, IsLguOrAdmin
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

from . import dashboard_service, evidence_token, harvest_report
from .ai_language import from_request
from .assessment_questions import not_applicable
from .growth_stage import growing_days
from .assessment_schedule import eligibility, with_last_assessment_date
from .crop_intelligence_service import get_or_create_crop_intelligence, is_configured
from .soil_recommendation_service import (
    apply_recommendation,
    generate_soil_recommendation,
    is_outdated,
)
from .models import (
    Assessment,
    Crop,
    CropVariant,
    HarvestReport,
    LossReport,
    Plant,
    PlantStatus,
    RiskStatus,
    SoilRecommendation,
)
from .serializers import (
    AssessmentSerializer,
    CropIntelligenceSerializer,
    CropSerializer,
    CropVariantSerializer,
    HarvestOutcomeReportSerializer,
    HarvestReportSerializer,
    LossOutcomeReportSerializer,
    LossReportSerializer,
    PlantLossSerializer,
    PlantSerializer,
    SoilRecommendationSerializer,
    validate_evidence_file,
)

logger = logging.getLogger(__name__)

# The Add Plant screen follows this with its own translated "Your plant can
# still be added", so it is not repeated here.
UNAVAILABLE_MESSAGE = "Crop intelligence is temporarily unavailable."


class CropListView(ListAPIView):
    """
    GET /api/farmer/crops/ — the authoritative crop catalog from MySQL.
    Available to any approved account so the picker works for every role
    that may eventually need it.
    """

    serializer_class = CropSerializer
    permission_classes = [IsApproved]
    queryset = Crop.objects.filter(is_active=True).prefetch_related("variants")


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
            Plant.objects.filter(farmer=self.request.user)
            .select_related("crop", "variant", "harvest_report", "loss_report")
            .prefetch_related("crop__variants")
        ).order_by("-created_at")

    def perform_create(self, serializer):
        plant = serializer.save(farmer=self.request.user)
        # Queued for after commit, so a rolled-back create notifies nobody.
        notify_plant_added(plant)

    def perform_update(self, serializer):
        before = serializer.instance.status
        was_harvested = before == PlantStatus.HARVESTED
        with transaction.atomic():
            plant = serializer.save()
            if was_harvested and plant.status != PlantStatus.HARVESTED:
                # Undone within the 24 hours: the report goes with it, and a
                # new one is written if the plant is harvested again.
                HarvestReport.objects.filter(plant=plant).delete()
                plant._state.fields_cache.pop("harvest_report", None)
            if before == PlantStatus.LOST and plant.status != PlantStatus.LOST:
                # A loss reported by mistake, undone within the 24 hours.
                LossReport.objects.filter(plant=plant).delete()
                plant._state.fields_cache.pop("loss_report", None)
        # Marking a plant harvested from the Harvest page says so, rather
        # than a generic "plant information updated".
        notify_plant_updated(
            plant, harvested=not was_harvested and plant.status == PlantStatus.HARVESTED
        )

    @action(
        detail=True,
        methods=["post"],
        parser_classes=[MultiPartParser, FormParser, JSONParser],
    )
    def harvest(self, request, pk=None):
        """
        POST /api/farmer/plants/{id}/harvest/

        Marks the plant harvested together with its harvest report (the final
        assessment). Quality, health and "did the advice help" are required;
        amount, photo and notes are optional.
        """
        plant = self.get_object()
        if plant.status in (PlantStatus.HARVESTED, PlantStatus.ARCHIVED, PlantStatus.LOST):
            return Response(
                {"detail": "This plant is already harvested or lost."},
                status=status.HTTP_409_CONFLICT,
            )
        if plant.is_planned:
            return Response(
                {"detail": "This plant is not in the ground yet."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = HarvestReportSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        answers = dict(serializer.validated_data)
        if answers.get("photo") is None:
            answers.pop("photo", None)
        harvest_report.record_harvest(plant, answers)
        notify_plant_updated(plant, harvested=True)
        plant = self.get_queryset().get(pk=plant.pk)
        return Response(
            self.get_serializer(plant).data, status=status.HTTP_201_CREATED
        )

    @action(
        detail=True,
        methods=["post"],
        parser_classes=[MultiPartParser, FormParser, JSONParser],
    )
    def lost(self, request, pk=None):
        """
        POST /api/farmer/plants/{id}/lost/

        Reports that the plant died, with what happened and when it was
        noticed (required) and an optional photo and note. The plant and its
        history are kept, not deleted.
        """
        plant = self.get_object()
        if plant.status in (PlantStatus.HARVESTED, PlantStatus.ARCHIVED, PlantStatus.LOST):
            return Response(
                {"detail": "This plant is already harvested or lost."},
                status=status.HTTP_409_CONFLICT,
            )
        serializer = LossReportSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        answers = dict(serializer.validated_data)
        if answers.get("photo") is None:
            answers.pop("photo", None)
        harvest_report.record_loss(plant, answers)
        plant = self.get_queryset().get(pk=plant.pk)
        return Response(self.get_serializer(plant).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsFarmer])
def crop_intelligence(request, crop_id):
    """
    GET /api/farmer/crops/{crop_id}/intelligence/
        ?planting_date=YYYY-MM-DD&variant=<variant_id>&lang=<en|fil|bik>

    Returns the calculated harvest window (always, from the Crop table) plus
    cached Gemini crop intelligence (best-effort).

    `variant` matters: this endpoint powers the review screen the Farmer
    confirms, and saving the plant applies the variety's own durations. Left
    out, the preview was computed from the parent crop and disagreed with the
    plant that was then created - 25 days apart for Sweet Corn against Corn.
    The variety has to be part of the question for the answer to match.

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

    variant = None
    variant_id = request.query_params.get("variant")
    if variant_id:
        variant = CropVariant.objects.filter(
            pk=variant_id, crop=crop, is_active=True
        ).first()
        if variant is None:
            return Response(
                {"detail": "That variety does not belong to the selected crop."},
                status=status.HTTP_400_BAD_REQUEST,
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
        harvest_start, harvest_end = Plant.calculate_harvest_window(
            crop, planting_date, variant
        )

    # The farmer's app language ("en", "fil" or "bik"); anything else is English.
    intelligence, generated_now = get_or_create_crop_intelligence(
        crop, variant=variant, language=from_request(request)
    )

    return Response(
        {
            "crop": CropSerializer(crop).data,
            "variant": CropVariantSerializer(variant).data if variant else None,
            # Calculated by Django from crop metadata — never AI-generated.
            "harvest_window": (
                {
                    "planting_date": planting_date.isoformat(),
                    "expected_harvest_start": harvest_start.isoformat(),
                    "expected_harvest_end": harvest_end.isoformat(),
                    # The variety's numbers when one was chosen, so the
                    # review screen quotes the same figures the saved plant
                    # will use.
                    "growing_duration_days": (
                        variant.growing_duration_days
                        if variant
                        else crop.growing_duration_days
                    ),
                    "harvest_window_days": (
                        variant.harvest_window_days
                        if variant
                        else crop.harvest_window_days
                    ),
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


def _run_risk_evaluation(assessment, language="en"):
    """
    Evaluates an assessment and persists the result, written in the
    farmer's app `language`.

    On any Gemini failure the RiskAssessment row is still created, with
    status FAILED and risk_level left NULL — the farmer's assessment and
    evidence are never lost, and no risk level is fabricated.
    """
    from .risk_evaluation_service import evaluate_assessment

    return _store_risk(assessment, evaluate_assessment(assessment, language), language)


def _conflict_message(conflicts) -> str:
    return (
        "Your answers don't match the photo, so this assessment can't be evaluated. "
        "Please correct your answers or take a new photo: " + " ".join(conflicts)
    )


def _store_risk(assessment, result, language="en"):
    """Persist an evaluation result (or its failure) as the RiskAssessment."""
    from .models import RiskAssessment, RiskStatus
    from .risk_evaluation_service import is_configured

    if result is not None and not result.get("answers_match_photo", True):
        # No reading is ever issued on answers the photo contradicts.
        return RiskAssessment.objects.create(
            assessment=assessment,
            status=RiskStatus.FAILED,
            failure_reason=_conflict_message(result.get("answer_conflicts", [])),
            model_name=result.get("model_name", settings.GEMINI_MODEL),
            language=language,
        )

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
            language=language,
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
        fertilizer=result.get("fertilizer", {}),
        monitoring_advice=result["monitoring_advice"],
        limitations=result["limitations"],
        next_assessment_days=result["next_assessment_days"],
        image_analyzed=result["image_analyzed"],
        date_mismatch=result.get("date_mismatch", False),
        # A fallback model may have answered when GEMINI_MODEL was busy.
        model_name=result.get("model_name", settings.GEMINI_MODEL),
        language=language,
    )


EVIDENCE_UNAVAILABLE_MESSAGE = (
    "Plant evidence could not be verified right now. Please try again in a moment."
)

EVIDENCE_STORAGE_FAILED_MESSAGE = (
    "Your plant photo could not be saved right now. Please try again in a moment."
)


def _reused_photo_result(plant, image_bytes) -> dict | None:
    """
    A rejection if these exact bytes were already submitted as evidence, by
    anyone. Each weekly assessment needs a fresh photo of the plant as it is
    now; re-sending last week's (or someone else's) is not evidence.
    """
    digest = evidence_token.image_digest(image_bytes)
    if not Assessment.objects.filter(evidence_validation__image_sha256=digest).exists():
        return None
    crop = plant.crop.name.lower()
    return {
        "evidence_valid": False,
        "verdict": "not_genuine",
        "confidence": 1.0,
        "detected_subject": "a photo already used in an earlier assessment",
        "expected_crop": plant.crop.name,
        "reason": "This exact photo was already used in an earlier assessment.",
        "message": f"Take a new photo of your {crop} plant as it looks today.",
    }


def _read_upload(image) -> tuple[bytes, str]:
    """Bytes and MIME type of an uploaded evidence image, without saving it."""
    image.seek(0)
    data = image.read()
    image.seek(0)
    name = (getattr(image, "name", "") or "").lower()
    content_type = (getattr(image, "content_type", "") or "").lower()
    mime = "image/png" if name.endswith(".png") or content_type == "image/png" else "image/jpeg"
    return data, mime


def _previous_check(plant):
    """
    The plant's last assessment for the photo check to compare against, or
    None for a first assessment. The photo is attached only if its file can
    still be read; the stage seen then comes from the database either way.
    """
    from .evidence_validation_service import PreviousCheck

    last = (
        Assessment.objects.filter(plant=plant)
        .order_by("-assessment_date", "-created_at")
        .first()
    )
    if last is None:
        return None

    image_bytes, mime = None, "image/jpeg"
    if last.evidence_image:
        try:
            with last.evidence_image.open("rb") as stored:
                image_bytes = stored.read() or None
            if last.evidence_image.name.lower().endswith(".png"):
                mime = "image/png"
        except Exception as exc:  # noqa: BLE001 - optional context, never fatal
            # A lost file (FileNotFoundError), and on object storage also a
            # credentials or network error: the check runs without the photo.
            logger.warning(
                "Previous evidence photo unreadable for assessment %s: %s",
                last.pk, type(exc).__name__,
            )
            image_bytes = None

    return PreviousCheck(
        days_ago=max(0, (timezone.localdate() - last.assessment_date).days),
        observed_stage=(last.evidence_validation or {}).get("observed_stage"),
        image_bytes=image_bytes,
        mime_type=mime,
    )


def _age_today(plant) -> int:
    """Days since planting, as the photo check judges the photo against."""
    return max(0, (timezone.localdate() - plant.planting_date).days)


def _notify_safely(assessment, *senders) -> None:
    """
    Sends an assessment's notifications. By now the assessment and its
    reading are saved, so a notification bug is logged, never turned into an
    error for the farmer: on 2026-11-10 one did, and the farmer saw
    "Something went wrong" for an assessment that had in fact been recorded.
    """
    for send in senders:
        try:
            send()
        except Exception:  # noqa: BLE001 - a notification must not undo a saved assessment
            logger.exception("Notification failed for assessment %s", assessment.pk)


def _assessment_weather() -> dict:
    """The farm's last week of weather for a new assessment, or {} if unknown."""
    if not settings.ATTACH_WEATHER_TO_ASSESSMENTS:
        return {}
    from .weather_service import recent_weather

    weather = recent_weather()
    return weather if weather.get("available") else {}


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

    reused = _reused_photo_result(plant, image_bytes)
    if reused:
        return {"outcome": "rejected", "result": reused}

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

    result = validate_crop_evidence(
        plant.crop, image_bytes, mime, from_request(request), _age_today(plant),
        growing_days(plant), _previous_check(plant),
    )
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
        Plant.objects.select_related("crop", "variant").prefetch_related("crop__variants"),
        pk=plant_id,
        farmer=request.user,
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
    result = _reused_photo_result(plant, image_bytes) or validate_crop_evidence(
        plant.crop, image_bytes, mime, from_request(request), _age_today(plant),
        growing_days(plant), _previous_check(plant),
    )

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
    # No suggestion for a question this crop is not asked (fruit on ginger).
    skipped = not_applicable(plant.crop)
    payload["suggested_answers"] = {
        field: value
        for field, value in (result.get("suggested_answers") or {}).items()
        if field not in skipped
    }
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
                        "This plant is planned for "
                        f"{schedule['next_assessment_date']} and is not in the ground "
                        "yet. You can assess it from that day."
                        if schedule.get("planned")
                        # Newly planted: there is nothing to judge yet, so the
                        # first assessment waits a week rather than producing a
                        # risk level with nothing behind it.
                        else "This plant was only just planted. Its first assessment "
                        f"opens on {schedule['next_assessment_date']}."
                        if schedule.get("too_young")
                        else "You have already completed this week's assessment for "
                        f"this plant. The next one is available on "
                        f"{schedule['next_assessment_date']}."
                    ),
                    "assessment_eligibility": schedule,
                },
                status=status.HTTP_409_CONFLICT,
            )

        serializer = self.get_serializer(
            data=request.data, context={**self.get_serializer_context(), "plant": plant}
        )
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

        image_bytes, _mime = _read_upload(image)
        weather = _assessment_weather()
        # The photo is stored before the row is inserted, so a storage
        # failure (e.g. Cloudinary rejecting bad credentials) leaves nothing
        # behind; it is logged in full and the farmer is told what failed.
        try:
            with transaction.atomic():
                assessment = serializer.save(
                    plant=plant,
                    assessment_date=assessment_date,
                    plant_age_days=age_days,
                    weather=weather,
                    evidence_validated=True,
                    evidence_validation={
                        **verification["result"],
                        # Lets a later submission of the same photo be refused.
                        "image_sha256": evidence_token.image_digest(image_bytes),
                    },
                )
        except Exception:  # noqa: BLE001 - any storage backend's error
            logger.exception("Evidence photo could not be stored for plant %s", plant.id)
            return Response(
                {
                    "detail": EVIDENCE_STORAGE_FAILED_MESSAGE,
                    "evidence_storage_failed": True,
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # 3. Only now does the risk evaluation run, on verified evidence. Its
        #    existing graceful failure is preserved: a Gemini outage records a
        #    FAILED risk rather than losing the farmer's assessment.
        from .risk_evaluation_service import evaluate_assessment

        language = from_request(request)
        result = evaluate_assessment(assessment, language)

        # 3b. The answers must agree with the photo. If the photo clearly
        #     contradicts them, nothing is kept and no reading is issued: the
        #     farmer corrects the form (or the photo) and submits again, and
        #     the week stays open because no assessment was recorded.
        if result is not None and not result.get("answers_match_photo", True):
            assessment.evidence_image.delete(save=False)
            assessment.delete()
            return Response(
                {
                    "detail": "Your answers don't match the photo, so this assessment "
                    "can't be evaluated. Please correct the answers below or take "
                    "a new photo.",
                    "answers_mismatch": True,
                    "answer_conflicts": result.get("answer_conflicts", []),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        risk = _store_risk(assessment, result, language)
        assessment.refresh_from_db()

        # 4. Notify only once the assessment and its risk row are stored, and
        #    only from the stored values — no extra Gemini call is made to
        #    write notification text. A failed evaluation produces no risk
        #    notification, because there is no level to report.
        _notify_safely(
            assessment,
            lambda: notify_assessment_submitted(assessment, eligibility(plant)),
            lambda: notify_assessment_evaluated(assessment, risk),
            # Separate from the reading above: only fires if the level moved.
            lambda: notify_risk_level_changed(assessment, risk),
        )

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
        # A finished reading is left alone - except one made before fertilizer
        # advice existed, which may be updated once with the same answers and
        # photo. If the AI cannot answer, the old reading stays as it was.
        if existing.fertilizer:
            return Response(
                AssessmentSerializer(assessment, context={"request": request}).data
            )
        from .risk_evaluation_service import evaluate_assessment

        result = evaluate_assessment(assessment, from_request(request))
        if result is None or not result.get("answers_match_photo", True):
            return Response(
                {
                    "detail": (
                        "The reading could not be updated right now. Your earlier "
                        "reading is kept; please try again later."
                    )
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        with transaction.atomic():
            existing.delete()
            _store_risk(assessment, result, from_request(request))
        assessment.refresh_from_db()
        return Response(
            AssessmentSerializer(assessment, context={"request": request}).data
        )

    if existing:
        existing.delete()
    risk = _run_risk_evaluation(assessment, from_request(request))
    assessment.refresh_from_db()
    # A retry that finally succeeds still notifies once — the earlier failed
    # attempt produced no risk notification, and the dedupe key makes a
    # second success a no-op.
    _notify_safely(
        assessment,
        lambda: notify_assessment_evaluated(assessment, risk),
        lambda: notify_risk_level_changed(assessment, risk),
    )
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
    # Harvested and lost plants are finished: they live in the Archive, not here.
    plants = list(
        with_last_assessment_date(
            Plant.objects.filter(farmer=request.user)
            .exclude(status__in=[PlantStatus.HARVESTED, PlantStatus.ARCHIVED, PlantStatus.LOST])
            .select_related("crop", "variant")
            .prefetch_related("crop__variants")
        )
    )
    # Every assessment of these plants in one query, newest first per plant,
    # rather than one query per plant.
    history = {}
    for assessment in (
        Assessment.objects.filter(plant__in=plants)
        .select_related("risk", "plant", "plant__crop", "plant__variant")
        .order_by("plant_id", "-assessment_date", "-created_at")
    ):
        history.setdefault(assessment.plant_id, []).append(assessment)

    counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "unassessed": 0}
    items = []

    for plant in plants:
        rows = history.get(plant.pk, [])
        latest = rows[0] if rows else None
        # The reading before the latest one, for "Low -> High" on the card.
        previous_level = next(
            (
                row.risk.risk_level
                for row in rows[1:]
                if getattr(row, "risk", None) is not None
                and row.risk.status == RiskStatus.COMPLETED
                and row.risk.risk_level in ("LOW", "MEDIUM", "HIGH")
            ),
            None,
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
                "previous_risk_level": previous_level,
            }
        )

    return Response({"counts": counts, "plants": items})


@api_view(["GET"])
@permission_classes([IsFarmer])
def farmer_dashboard(request):
    """
    GET /api/farmer/dashboard/

    Everything the Farmer dashboard shows, in one read. Assembled in
    `dashboard_service` from MySQL — no AI call, and nothing estimated.
    """
    return Response(dashboard_service.build(request.user))


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

    # Sensor readings compared when deciding whether a save is a duplicate.
    # The legacy_* columns are deliberately absent: nothing writes to them,
    # so including them would compare two identical defaults on every row.
    SOIL_FIELDS = (
        "soil_temperature",
        "soil_moisture",
        "soil_conductivity",
        "soil_ph",
        "nitrogen",
        "phosphorus",
        "potassium",
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

        analyzed = apply_recommendation(
            soil, generate_soil_recommendation(soil, from_request(self.request))
        )
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


@api_view(["POST"])
@permission_classes([IsFarmer, IsApproved])
def reanalyze_soil_recommendation(request, pk):
    """
    POST /api/farmer/soil-recommendations/{id}/reanalyze/

    Backs "Try Again": re-runs Gemini for a saved soil assessment that has no
    AI result - its analysis failed, or it was saved with `analyze=0`. The
    stored soil information is reused untouched, so this is a pure retry and
    never a way to edit an assessment. One that already has a recommendation
    is returned as it is, without spending quota - unless it was written
    with older advice instructions, in which case it is rewritten once.
    """
    soil = get_object_or_404(SoilRecommendation, pk=pk, farmer=request.user)
    if is_outdated(soil):
        data = generate_soil_recommendation(soil, from_request(request))
        # A rewrite that fails keeps the advice the farmer already has.
        if data is not None:
            apply_recommendation(soil, data)
        return Response(SoilRecommendationSerializer(soil).data)
    if soil.ai_generated:
        return Response(SoilRecommendationSerializer(soil).data)

    if apply_recommendation(soil, generate_soil_recommendation(soil, from_request(request))):
        # Only a success is news - the save itself was announced when it was
        # submitted, so a retry that fails again stays quiet.
        notify_soil_recommendation(soil, analyzed=True)
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


@api_view(["GET"])
def farm_weather(request):
    """
    GET /api/weather/ — current weather at Layuan Farm, for the header.

    Any signed-in role may read it; the header is shared by all of them.
    Served from a cache, so this never waits on Open-Meteo more than once
    per cache window, and it never fails: an outage returns
    `{"available": false}`.
    """
    from .weather_service import current_weather

    return Response(current_weather())




class HarvestPhotoView(APIView):
    """
    GET /api/farmer/harvest-reports/{pk}/photo/
    GET /api/lgu/harvest-reports/{pk}/photo/

    The harvest photo, served only to its Farmer and to LGU Officers and
    Admins - the same rule as assessment evidence (AssessmentEvidenceView).
    """

    permission_classes = [IsApproved]
    model = HarvestReport

    def get(self, request, pk):
        report = self.model.objects.select_related("plant", "plant__farmer").filter(pk=pk).first()
        allowed = report is not None and report.photo and (
            AssessmentEvidenceView()._may_view(request.user, report)
        )
        if not allowed:
            return Response({"detail": "Photo not found."}, status=status.HTTP_404_NOT_FOUND)

        extension = os.path.splitext(report.photo.name)[1].lower()
        content_type = AssessmentEvidenceView.CONTENT_TYPES.get(
            extension, "application/octet-stream"
        )
        try:
            handle = report.photo.open("rb")
        except (FileNotFoundError, OSError):
            logger.warning("Harvest photo missing for report %s.", report.pk)
            return Response({"detail": "Photo not found."}, status=status.HTTP_404_NOT_FOUND)
        response = FileResponse(handle, content_type=content_type)
        response["Cache-Control"] = "private, max-age=0, no-store"
        return response


class LossPhotoView(HarvestPhotoView):
    """GET /api/{farmer,lgu}/loss-reports/{pk}/photo/ - same rules, loss photos."""

    model = LossReport


# The Admin page pages through lost plants four at a time, so it gets them
# all (up to this many), not just the latest ten.
RECENT_LOSSES = 200


def _outcomes_response(request):
    data = harvest_report.outcomes(recent_losses=RECENT_LOSSES)
    data["recent"] = HarvestOutcomeReportSerializer(
        data["recent"], many=True, context={"request": request}
    ).data
    data["recent_losses"] = LossOutcomeReportSerializer(
        data["recent_losses"], many=True, context={"request": request}
    ).data
    return Response(data)


@api_view(["GET"])
@permission_classes([IsLguOfficer])
def lgu_harvest_outcomes(request):
    """GET /api/lgu/harvest-outcomes/ - how harvested plants turned out."""
    return _outcomes_response(request)


@api_view(["GET"])
@permission_classes([IsAdmin])
def admin_harvest_outcomes(request):
    """GET /api/admin/harvest-outcomes/ - the same figures for the Admin."""
    return _outcomes_response(request)


@api_view(["GET"])
@permission_classes([IsLguOrAdmin])
def lgu_plant_losses(request):
    """
    GET /api/lgu/plant-losses/ - plants that died before harvest: totals,
    causes (calamities apart), High-risk plants that were not saved, and
    every loss, newest first. Officers read it on Plant Loss; Officers and
    Admins both read it on Agricultural Analytics.
    """
    from . import loss_report

    losses = list(harvest_report.losses_in_scope().order_by("-lost_at"))
    data = loss_report.summary(losses, harvested=harvest_report.reports_in_scope().count())
    data["losses"] = PlantLossSerializer(losses, many=True, context={"request": request}).data
    return Response(data)

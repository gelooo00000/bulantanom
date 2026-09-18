from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from . import crop_calendar
from .models import (
    Assessment,
    Crop,
    CropIntelligence,
    CropVariant,
    Plant,
    RiskAssessment,
    SoilRecommendation,
)


def validate_evidence_file(image):
    """
    Content-based validation of an uploaded evidence photo.

    The filename extension is never trusted: Pillow must actually decode the
    file and the detected format must be JPEG or PNG, which blocks e.g. an
    SVG or GIF renamed to .jpg. Shared by the assessment serializer and the
    standalone evidence-validation endpoint so both apply identical rules.
    """
    if image is None:
        return image

    if image.size > settings.MAX_EVIDENCE_IMAGE_BYTES:
        limit_mb = settings.MAX_EVIDENCE_IMAGE_BYTES // (1024 * 1024)
        raise serializers.ValidationError(
            f"Image is too large. Please upload a photo under {limit_mb}MB."
        )

    content_type = getattr(image, "content_type", "") or ""
    if content_type not in settings.ALLOWED_EVIDENCE_CONTENT_TYPES:
        raise serializers.ValidationError("Only JPEG and PNG photos are accepted.")

    try:
        from PIL import Image

        image.seek(0)
        probe = Image.open(image)
        probe.verify()  # raises if the file is not a real, intact image
        detected = (probe.format or "").upper()
    except Exception as exc:
        raise serializers.ValidationError(
            "That file could not be read as a valid image."
        ) from exc
    finally:
        image.seek(0)

    if detected not in ("JPEG", "PNG"):
        raise serializers.ValidationError("Only JPEG and PNG photos are accepted.")

    return image


class CropVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = CropVariant
        fields = [
            "id",
            "name",
            "description",
            "growing_duration_days",
            "harvest_window_days",
            "search_terms",
        ]
        read_only_fields = fields


class CropSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    variants = serializers.SerializerMethodField()
    planting_window = serializers.SerializerMethodField()

    class Meta:
        model = Crop
        fields = [
            "id",
            "name",
            "category",
            "category_label",
            "emoji",
            "growing_duration_days",
            "harvest_window_days",
            "description",
            "search_terms",
            "variants",
            "planting_window",
        ]
        read_only_fields = fields

    def get_variants(self, crop):
        return CropVariantSerializer(
            [v for v in crop.variants.all() if v.is_active], many=True
        ).data

    def get_planting_window(self, crop):
        """
        The crop's season, sent once so the picker can react to the farmer
        changing the planting date without another round trip.

        Only the month lists travel as data the client tests against; every
        line of wording comes from here, so the agronomic text has exactly
        one home. Null when no window is on record, which is the signal to
        render nothing rather than guess.
        """
        preferred = list(crop.planting_months or [])
        caution = list(crop.planting_caution_months or [])
        if not preferred and not caution:
            return None
        return {
            "preferred_months": preferred,
            "caution_months": caution,
            "preferred_label": crop_calendar.month_range_label(preferred),
            "reason": crop.planting_reason,
            "risk": crop.planting_risk,
            "caution_note": crop.planting_caution_note,
        }


class CropIntelligenceSerializer(serializers.ModelSerializer):
    crop_overview = serializers.CharField(source="overview", read_only=True)

    class Meta:
        model = CropIntelligence
        fields = [
            "crop_overview",
            "growing_notes",
            "care_guidance",
            "harvest_guidance",
            "important_factors",
            "model_name",
            "generated_at",
        ]
        read_only_fields = fields


class PlantSerializer(serializers.ModelSerializer):
    """
    Read/write serializer for a Farmer's own plant.

    `farmer` is deliberately absent — ownership is taken from
    `request.user` in the view, never from the request body, so a client
    cannot create or reassign a plant to another Farmer.
    """

    crop = CropSerializer(read_only=True)
    crop_id = serializers.PrimaryKeyRelatedField(
        source="crop", queryset=Crop.objects.filter(is_active=True), write_only=True
    )
    variant = CropVariantSerializer(read_only=True)
    variant_id = serializers.PrimaryKeyRelatedField(
        source="variant",
        queryset=CropVariant.objects.filter(is_active=True),
        write_only=True,
        required=False,
        allow_null=True,
    )
    planting_advice = serializers.SerializerMethodField()
    display_name = serializers.CharField(read_only=True)
    age_days = serializers.IntegerField(read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    assessment_eligibility = serializers.SerializerMethodField()

    class Meta:
        model = Plant
        fields = [
            "id",
            "crop",
            "crop_id",
            "variant",
            "variant_id",
            "planting_advice",
            "label",
            "display_name",
            "planting_date",
            "expected_harvest_start",
            "expected_harvest_end",
            "status",
            "status_label",
            "age_days",
            "assessment_eligibility",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "crop",
            "variant",
            "planting_advice",
            "display_name",
            "expected_harvest_start",
            "expected_harvest_end",
            "status_label",
            "age_days",
            "assessment_eligibility",
            "created_at",
            "updated_at",
        ]

    def get_assessment_eligibility(self, obj):
        """
        The 7-day weekly-assessment state, computed server-side. The UI
        renders this; it never decides eligibility from the browser clock.
        """
        from .assessment_schedule import eligibility

        return eligibility(obj)

    def get_planting_advice(self, obj):
        """
        Whether this plant went into the ground in its crop's season. Read
        from the stored planting date, so it stays true for the life of the
        record instead of drifting with the current month.
        """
        return obj.crop.planting_advice(obj.planting_date.month)

    def validate_crop_id(self, value):
        if value is None:
            raise serializers.ValidationError("Please select a valid crop.")
        return value

    def validate_planting_date(self, value):
        if value is None:
            raise serializers.ValidationError("Please select a valid planting date.")
        # A plant record represents something already in the ground, so a
        # future planting date is rejected. (DRF already rejects malformed
        # and impossible calendar dates such as 2026-02-31.)
        if value > timezone.localdate():
            raise serializers.ValidationError("Planting date cannot be in the future.")
        # Guard against obvious typos like year 1900.
        if value.year < 1980:
            raise serializers.ValidationError("Please enter a more recent planting date.")
        return value

    def validate(self, attrs):
        """
        A variety belongs to exactly one crop. Rejecting the mismatch here
        stops a Sweet Corn plant being filed under Eggplant and then having
        its harvest window computed from the wrong durations.
        """
        crop = attrs.get("crop") or getattr(self.instance, "crop", None)
        variant = attrs.get("variant", serializers.empty)
        if variant is serializers.empty:
            variant = getattr(self.instance, "variant", None)
        if variant is not None and crop is not None and variant.crop_id != crop.id:
            raise serializers.ValidationError(
                {"variant_id": "That variety does not belong to the selected crop."}
            )
        return attrs

    def create(self, validated_data):
        crop = validated_data["crop"]
        variant = validated_data.get("variant")
        planting_date = validated_data["planting_date"]
        start, end = Plant.calculate_harvest_window(crop, planting_date, variant)
        validated_data["expected_harvest_start"] = start
        validated_data["expected_harvest_end"] = end
        return super().create(validated_data)

    def update(self, instance, validated_data):
        crop = validated_data.get("crop", instance.crop)
        variant = validated_data.get("variant", instance.variant)
        planting_date = validated_data.get("planting_date", instance.planting_date)
        start, end = Plant.calculate_harvest_window(crop, planting_date, variant)
        validated_data["expected_harvest_start"] = start
        validated_data["expected_harvest_end"] = end
        return super().update(instance, validated_data)


class RiskAssessmentSerializer(serializers.ModelSerializer):
    risk_level_label = serializers.SerializerMethodField()

    class Meta:
        model = RiskAssessment
        fields = [
            "risk_level",
            "risk_level_label",
            "status",
            "summary",
            "reality_vs_expectation",
            "visual_observations",
            "risk_factors",
            "possible_causes",
            "recommended_actions",
            "monitoring_advice",
            "limitations",
            "next_assessment_days",
            "image_analyzed",
            "model_name",
            "failure_reason",
            "generated_at",
        ]
        read_only_fields = fields

    def get_risk_level_label(self, obj):
        return obj.get_risk_level_display() if obj.risk_level else None


class AssessmentSerializer(serializers.ModelSerializer):
    """
    Read/write serializer for a weekly assessment.

    `plant`, `plant_age_days` and the owning farmer are all set server-side.
    A client cannot submit a plant age or attach an assessment to a plant it
    does not own (the view scopes the plant queryset to request.user).
    """

    risk = RiskAssessmentSerializer(read_only=True)
    evidence_image_url = serializers.SerializerMethodField()
    plant_id = serializers.IntegerField(source="plant.id", read_only=True)
    plant_display_name = serializers.CharField(source="plant.display_name", read_only=True)
    crop_name = serializers.CharField(source="plant.crop.name", read_only=True)
    crop_emoji = serializers.CharField(source="plant.crop.emoji", read_only=True)

    class Meta:
        model = Assessment
        fields = [
            "id",
            "plant_id",
            "plant_display_name",
            "crop_name",
            "crop_emoji",
            "assessment_date",
            "plant_age_days",
            "plant_height_cm",
            "growth_condition",
            "health_condition",
            "leaf_condition",
            "flowering_status",
            "fruiting_status",
            "watering_frequency",
            "soil_moisture",
            "pest_observation",
            "disease_observation",
            "environmental_observations",
            "notes",
            "evidence_image",
            "evidence_image_url",
            "evidence_validated",
            "evidence_validation",
            "created_at",
            "risk",
        ]
        read_only_fields = [
            "id",
            "plant_id",
            "plant_display_name",
            "crop_name",
            "crop_emoji",
            "assessment_date",
            "plant_age_days",
            "evidence_image_url",
            # Set by the server from the Gemini check — never client-supplied.
            "evidence_validated",
            "evidence_validation",
            "created_at",
            "risk",
        ]
        extra_kwargs = {"evidence_image": {"write_only": True, "required": False}}

    def get_evidence_image_url(self, obj):
        """
        URL of the *authorized* evidence endpoint, never the raw media path.

        The role prefix is taken from the requesting user so each caller gets
        a link their own role can actually open. Authorization is enforced by
        the view regardless of which prefix is used — the prefix is only a
        naming convention.
        """
        if not obj.evidence_image:
            return None

        request = self.context.get("request")
        user = getattr(request, "user", None)
        prefix = "lgu" if getattr(user, "role", None) in ("LGU_OFFICER", "ADMIN") else "farmer"
        path = f"/api/{prefix}/assessments/{obj.pk}/evidence/"
        return request.build_absolute_uri(path) if request else path

    def validate_evidence_image(self, image):
        return validate_evidence_file(image)

    def validate_plant_height_cm(self, value):
        if value is not None and (value < 0 or value > 5000):
            raise serializers.ValidationError("Please enter a realistic plant height in cm.")
        return value


class SoilRecommendationSerializer(serializers.ModelSerializer):
    """
    Read/write serializer for one soil assessment and its AI result.

    Only the soil inputs are writable — every AI field is read-only, so a
    client can never inject or edit recommendation content. `farmer` is set
    by the view from `request.user`, never from the payload.
    """

    ai_available = serializers.SerializerMethodField()

    class Meta:
        model = SoilRecommendation
        fields = [
            "id",
            # Farmer-provided soil information (writable)
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
            # Gemini result — exactly six sections (read-only)
            "suitable_fruits",
            "suitable_vegetables",
            "suitable_crops",
            "fertilizer_recommendations",
            "soil_improvement_watering",
            "important_warnings",
            "ai_generated",
            "ai_available",
            "failure_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "suitable_fruits",
            "suitable_vegetables",
            "suitable_crops",
            "fertilizer_recommendations",
            "soil_improvement_watering",
            "important_warnings",
            "ai_generated",
            "ai_available",
            "failure_reason",
            "created_at",
            "updated_at",
        ]

    def get_ai_available(self, obj) -> bool:
        return bool(obj.ai_generated)

    def validate_ph_level(self, value):
        # Blank is legitimate — Farmers are not required to own a pH meter.
        if value is not None and not (0 <= value <= 14):
            raise serializers.ValidationError("Soil pH must be between 0 and 14.")
        return value

    def validate_notes(self, value):
        if value and len(value) > 2000:
            raise serializers.ValidationError(
                "Please keep additional soil information under 2000 characters."
            )
        return value


class LguSoilRecommendationSerializer(serializers.ModelSerializer):
    """
    Read-only view of a Farmer's soil assessment for LGU Officers.

    Adds the owning Farmer's identity (the Farmer-facing serializer omits it
    because the row is always their own) and exposes the human-readable
    choice labels, so the LGU table shows "Sandy Loam" rather than the
    stored "sandy_loam". Never writable from this endpoint.
    """

    farmer_id = serializers.IntegerField(source="farmer.id", read_only=True)
    farmer_name = serializers.CharField(source="farmer.get_full_name", read_only=True)
    farmer_email = serializers.EmailField(source="farmer.email", read_only=True)

    soil_type_label = serializers.CharField(
        source="get_soil_type_display", read_only=True
    )
    soil_texture_label = serializers.CharField(
        source="get_soil_texture_display", read_only=True
    )
    drainage_label = serializers.CharField(source="get_drainage_display", read_only=True)
    soil_moisture_label = serializers.CharField(
        source="get_soil_moisture_display", read_only=True
    )
    nitrogen_label = serializers.CharField(source="get_nitrogen_display", read_only=True)
    phosphorus_label = serializers.CharField(
        source="get_phosphorus_display", read_only=True
    )
    potassium_label = serializers.CharField(
        source="get_potassium_display", read_only=True
    )
    organic_matter_label = serializers.CharField(
        source="get_organic_matter_display", read_only=True
    )

    class Meta:
        model = SoilRecommendation
        fields = [
            "id",
            "farmer_id",
            "farmer_name",
            "farmer_email",
            # Reported soil information, with display labels for the table.
            "soil_type",
            "soil_type_label",
            "soil_texture",
            "soil_texture_label",
            "drainage",
            "drainage_label",
            "soil_moisture",
            "soil_moisture_label",
            "ph_level",
            "nitrogen",
            "nitrogen_label",
            "phosphorus",
            "phosphorus_label",
            "potassium",
            "potassium_label",
            "organic_matter",
            "organic_matter_label",
            "notes",
            # The AI result, exactly as the Farmer saw it.
            "suitable_fruits",
            "suitable_vegetables",
            "suitable_crops",
            "fertilizer_recommendations",
            "soil_improvement_watering",
            "important_warnings",
            "ai_generated",
            "created_at",
        ]
        read_only_fields = fields

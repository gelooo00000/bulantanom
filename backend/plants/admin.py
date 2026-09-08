from django.contrib import admin

from .models import Assessment, Crop, CropIntelligence, Plant, RiskAssessment


@admin.register(Crop)
class CropAdmin(admin.ModelAdmin):
    list_display = (
        "emoji",
        "name",
        "category",
        "growing_duration_days",
        "harvest_window_days",
        "is_active",
    )
    list_filter = ("category", "is_active")
    search_fields = ("id", "name")
    ordering = ("category", "name")


@admin.register(Plant)
class PlantAdmin(admin.ModelAdmin):
    list_display = (
        "display_name",
        "farmer",
        "crop",
        "planting_date",
        "expected_harvest_start",
        "status",
    )
    list_filter = ("status", "crop__category")
    search_fields = ("farmer__email", "crop__name", "label")
    readonly_fields = ("expected_harvest_start", "expected_harvest_end", "created_at", "updated_at")
    ordering = ("-created_at",)


@admin.register(CropIntelligence)
class CropIntelligenceAdmin(admin.ModelAdmin):
    """AI-generated content — read-only so it can never overwrite Crop metadata."""

    list_display = ("crop", "model_name", "generated_at")
    readonly_fields = (
        "crop",
        "overview",
        "growing_notes",
        "care_guidance",
        "harvest_guidance",
        "important_factors",
        "model_name",
        "generated_at",
    )


@admin.register(Assessment)
class AssessmentAdmin(admin.ModelAdmin):
    list_display = ("plant", "assessment_date", "plant_age_days", "health_condition", "leaf_condition")
    list_filter = ("health_condition", "leaf_condition", "growth_condition")
    search_fields = ("plant__crop__name", "plant__farmer__email")
    readonly_fields = ("plant_age_days", "created_at")


@admin.register(RiskAssessment)
class RiskAssessmentAdmin(admin.ModelAdmin):
    """AI output — read-only so it can never be hand-edited into the record."""

    list_display = ("assessment", "risk_level", "status", "model_name", "generated_at")
    list_filter = ("risk_level", "status")
    readonly_fields = [f.name for f in RiskAssessment._meta.fields]

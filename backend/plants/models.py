import os
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.utils import timezone


class CropCategory(models.TextChoices):
    FRUIT = "fruit", "Fruit"
    VEGETABLE = "vegetable", "Vegetables & Crops"


class Crop(models.Model):
    """
    Authoritative crop catalog. This is the source of truth for growing
    durations and harvest windows — the backend calculates harvest dates
    from these values, never from an AI-generated guess (see
    `crop_intelligence_service`).

    Designed so a future Admin screen can maintain names, emoji, durations
    and notes without a code change.
    """

    # Slug primary key so it matches the frontend's stable crop ids and
    # stays readable in the database.
    id = models.SlugField(primary_key=True, max_length=64)
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=20, choices=CropCategory.choices)
    emoji = models.CharField(
        max_length=16,
        blank=True,
        help_text="Visual aid only — the crop name is always displayed alongside it.",
    )
    growing_duration_days = models.PositiveIntegerField(
        help_text="Indicative days from planting to the start of the harvest window."
    )
    harvest_window_days = models.PositiveIntegerField(
        help_text="Indicative length of the harvest window in days."
    )
    description = models.TextField(blank=True)
    search_terms = models.JSONField(
        default=list, blank=True, help_text="Local/alternate names used for searching."
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["category", "name"]

    def __str__(self):
        return self.name


class PlantStatus(models.TextChoices):
    GROWING = "GROWING", "Growing"
    READY_FOR_HARVEST = "READY_FOR_HARVEST", "Ready for harvest"
    HARVESTED = "HARVESTED", "Harvested"
    ARCHIVED = "ARCHIVED", "Archived"


class Plant(models.Model):
    """
    A crop planting owned by exactly one Farmer.

    Ownership is enforced server-side: every queryset is filtered by
    `farmer=request.user`, and the client never supplies a farmer id.
    Future Monitoring / Assessment / Harvest records attach to this model
    via ForeignKey so they inherit the same ownership chain.
    """

    farmer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="plants"
    )
    crop = models.ForeignKey(Crop, on_delete=models.PROTECT, related_name="plants")
    label = models.CharField(
        max_length=120, blank=True, help_text="Optional farmer label, e.g. 'North Row'."
    )
    planting_date = models.DateField()

    # Denormalised so the harvest window is stable even if the crop's
    # configured duration is later edited by an Admin.
    expected_harvest_start = models.DateField()
    expected_harvest_end = models.DateField()

    status = models.CharField(
        max_length=32, choices=PlantStatus.choices, default=PlantStatus.GROWING
    )

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["farmer", "-created_at"])]

    def __str__(self):
        return f"{self.crop.name} ({self.farmer.email})"

    @staticmethod
    def calculate_harvest_window(crop, planting_date):
        """Harvest window comes from crop metadata + planting date — never from AI."""
        start = planting_date + timedelta(days=crop.growing_duration_days)
        end = start + timedelta(days=crop.harvest_window_days)
        return start, end

    def save(self, *args, **kwargs):
        if not self.expected_harvest_start or not self.expected_harvest_end:
            start, end = self.calculate_harvest_window(self.crop, self.planting_date)
            self.expected_harvest_start = start
            self.expected_harvest_end = end
        super().save(*args, **kwargs)

    @property
    def display_name(self):
        return self.label or self.crop.name

    @property
    def age_days(self):
        return max(0, (timezone.localdate() - self.planting_date).days)


def evidence_upload_path(instance, filename):
    """
    Namespaced by farmer/plant so files are traceable, with a random name so
    a user-supplied filename can never drive the path (no traversal, no
    collisions, no executable extensions).
    """
    ext = os.path.splitext(filename)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png"):
        ext = ".jpg"
    return (
        f"evidence/farmer_{instance.plant.farmer_id}/plant_{instance.plant_id}/"
        f"{uuid.uuid4().hex}{ext}"
    )


class Assessment(models.Model):
    """
    One weekly observation of a Plant by its owning Farmer.

    Immutable history: each week creates a new row, so a plant's progression
    (and each week's own evidence image) is preserved rather than overwritten.
    """

    class GrowthCondition(models.TextChoices):
        FASTER = "faster_than_expected", "Faster than expected"
        AS_EXPECTED = "as_expected", "About as expected"
        SLOWER = "slower_than_expected", "Slower than expected"
        STUNTED = "stunted", "Stunted / barely growing"

    class HealthCondition(models.TextChoices):
        HEALTHY = "healthy", "Healthy"
        SLIGHTLY_UNHEALTHY = "slightly_unhealthy", "Slightly unhealthy"
        UNHEALTHY = "unhealthy", "Unhealthy"

    class LeafCondition(models.TextChoices):
        HEALTHY = "healthy", "Healthy green leaves"
        SLIGHT_YELLOWING = "slight_yellowing", "Slight yellowing"
        YELLOWING = "yellowing", "Noticeable yellowing"
        SPOTS = "spots", "Spots or lesions"
        WILTING = "wilting", "Wilting or drooping"
        DAMAGED = "damaged", "Visible damage / holes"

    class FloweringStatus(models.TextChoices):
        NOT_FLOWERING = "not_flowering", "Not flowering"
        STARTING = "starting", "Starting to flower"
        FLOWERING = "flowering", "Flowering"
        FINISHED = "finished", "Flowering finished"

    class FruitingStatus(models.TextChoices):
        NOT_FRUITING = "not_fruiting", "Not fruiting"
        FORMING = "forming", "Fruit forming"
        DEVELOPING = "developing", "Fruit developing"
        RIPENING = "ripening", "Fruit ripening"

    class WateringFrequency(models.TextChoices):
        DAILY = "daily", "Daily"
        EVERY_OTHER_DAY = "every_other_day", "Every other day"
        TWICE_WEEKLY = "twice_weekly", "Twice a week"
        WEEKLY = "weekly", "Weekly"
        RAIN_FED = "rain_fed", "Rain-fed only"

    class SoilMoisture(models.TextChoices):
        DRY = "dry", "Dry"
        SLIGHTLY_DRY = "slightly_dry", "Slightly dry"
        MOIST = "moist", "Moist"
        WET = "wet", "Wet"
        WATERLOGGED = "waterlogged", "Waterlogged"

    plant = models.ForeignKey(Plant, on_delete=models.CASCADE, related_name="assessments")
    assessment_date = models.DateField(default=timezone.localdate)

    # Plant age is recomputed server-side at submission; never taken from the client.
    plant_age_days = models.PositiveIntegerField()

    plant_height_cm = models.DecimalField(
        max_digits=6, decimal_places=1, null=True, blank=True
    )
    growth_condition = models.CharField(max_length=32, choices=GrowthCondition.choices)
    health_condition = models.CharField(max_length=32, choices=HealthCondition.choices)
    leaf_condition = models.CharField(max_length=32, choices=LeafCondition.choices)
    flowering_status = models.CharField(
        max_length=32, choices=FloweringStatus.choices, blank=True
    )
    fruiting_status = models.CharField(
        max_length=32, choices=FruitingStatus.choices, blank=True
    )
    watering_frequency = models.CharField(max_length=32, choices=WateringFrequency.choices)
    soil_moisture = models.CharField(max_length=32, choices=SoilMoisture.choices, blank=True)

    pest_observation = models.TextField(blank=True)
    disease_observation = models.TextField(blank=True)
    environmental_observations = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    evidence_image = models.ImageField(upload_to=evidence_upload_path, blank=True, null=True)

    # Result of the pre-submission check that the photo actually shows this
    # crop. Recorded so the Farmer and the LGU can see that the evidence
    # backing a risk reading was verified, not just uploaded.
    evidence_validated = models.BooleanField(default=False)
    evidence_validation = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-assessment_date", "-created_at"]
        indexes = [models.Index(fields=["plant", "-assessment_date"])]
        constraints = [
            # One assessment per plant per day — blocks accidental double
            # submissions while still allowing a new record each week.
            models.UniqueConstraint(
                fields=["plant", "assessment_date"], name="unique_plant_assessment_per_day"
            )
        ]

    def __str__(self):
        return f"{self.plant.display_name} — {self.assessment_date}"

    @property
    def farmer(self):
        return self.plant.farmer


class RiskLevel(models.TextChoices):
    LOW = "LOW", "Low"
    MEDIUM = "MEDIUM", "Medium"
    HIGH = "HIGH", "High"


class RiskStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"


class RiskAssessment(models.Model):
    """
    AI risk evaluation for one Assessment.

    `risk_level` is nullable on purpose: when Gemini is unavailable the row is
    stored with status FAILED/PENDING and *no* level, so the system never
    fabricates a LOW/MEDIUM/HIGH the AI did not actually produce.
    """

    assessment = models.OneToOneField(
        Assessment, on_delete=models.CASCADE, related_name="risk"
    )
    risk_level = models.CharField(
        max_length=10, choices=RiskLevel.choices, null=True, blank=True
    )
    status = models.CharField(
        max_length=16, choices=RiskStatus.choices, default=RiskStatus.PENDING
    )

    summary = models.TextField(blank=True)
    reality_vs_expectation = models.JSONField(default=dict, blank=True)
    visual_observations = models.JSONField(default=list, blank=True)
    risk_factors = models.JSONField(default=list, blank=True)
    possible_causes = models.JSONField(default=list, blank=True)
    recommended_actions = models.JSONField(default=list, blank=True)
    monitoring_advice = models.JSONField(default=list, blank=True)
    limitations = models.JSONField(default=list, blank=True)
    next_assessment_days = models.PositiveIntegerField(null=True, blank=True)

    image_analyzed = models.BooleanField(default=False)
    model_name = models.CharField(max_length=100, blank=True)
    failure_reason = models.TextField(blank=True)
    generated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-generated_at"]

    def __str__(self):
        return f"{self.assessment.plant.display_name} — {self.risk_level or self.status}"


class CropIntelligence(models.Model):
    """
    Cached, AI-generated educational information about a crop.

    Deliberately separate from `Crop` so generated text can never overwrite
    the authoritative agronomic metadata the harvest calculation depends on.
    Cached per-crop because "about guava" is identical for every Farmer —
    only the harvest window is personalised, and that is computed in Django.
    """

    crop = models.OneToOneField(Crop, on_delete=models.CASCADE, related_name="intelligence")
    overview = models.TextField()
    growing_notes = models.JSONField(default=list)
    care_guidance = models.JSONField(default=list)
    harvest_guidance = models.TextField(blank=True)
    important_factors = models.JSONField(default=list)
    model_name = models.CharField(max_length=100, blank=True)
    generated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name_plural = "Crop intelligence"

    def __str__(self):
        return f"Intelligence: {self.crop.name}"


@receiver(post_delete, sender=Assessment)
def delete_evidence_file(sender, instance, **kwargs):
    """
    Remove the evidence photo from disk when its assessment is deleted.

    Django detaches the FileField row but leaves the file behind, so without
    this every deleted assessment (or cascaded plant/farmer deletion) would
    orphan an image in MEDIA_ROOT forever.
    """
    if instance.evidence_image:
        instance.evidence_image.delete(save=False)


class SoilRecommendation(models.Model):
    """
    A Farmer's soil assessment plus the Gemini recommendation generated from
    it.

    The soil inputs and the AI result live on one row deliberately: the
    recommendation is only meaningful next to the exact soil information it
    was derived from, and storing them together means re-opening a saved
    recommendation never needs another Gemini call.

    Every AI field defaults to empty. A row with `ai_generated=False` is a
    successfully saved soil assessment whose recommendation failed — the
    Farmer's input is never discarded because Gemini was unavailable.
    """

    class SoilType(models.TextChoices):
        LOAMY = "loamy", "Loamy"
        CLAY = "clay", "Clay"
        SANDY = "sandy", "Sandy"
        SILTY = "silty", "Silty"
        SANDY_LOAM = "sandy_loam", "Sandy Loam"
        CLAY_LOAM = "clay_loam", "Clay Loam"
        OTHER = "other", "Other"
        UNKNOWN = "unknown", "Unknown"

    class SoilTexture(models.TextChoices):
        SANDY = "sandy", "Sandy"
        LOOSE = "loose", "Loose"
        FINE = "fine", "Fine"
        STICKY = "sticky", "Sticky"
        HEAVY = "heavy", "Heavy"
        SMOOTH = "smooth", "Smooth"
        GRAINY = "grainy", "Grainy"
        UNKNOWN = "unknown", "Unknown"

    class Drainage(models.TextChoices):
        GOOD = "good", "Good"
        MODERATE = "moderate", "Moderate"
        POOR = "poor", "Poor"
        UNKNOWN = "unknown", "Unknown"

    class SoilMoisture(models.TextChoices):
        VERY_DRY = "very_dry", "Very Dry"
        DRY = "dry", "Dry"
        MODERATE = "moderate", "Moderate"
        MOIST = "moist", "Moist"
        VERY_WET = "very_wet", "Very Wet"
        UNKNOWN = "unknown", "Unknown"

    class NutrientLevel(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        UNKNOWN = "unknown", "Unknown"

    farmer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="soil_recommendations",
    )

    # --- Farmer-provided soil information -------------------------------
    # Only soil_type and soil_texture are effectively required; everything
    # else may be "unknown"/blank, because Farmers should never be forced to
    # supply lab measurements they do not have.
    soil_type = models.CharField(
        max_length=20, choices=SoilType.choices, default=SoilType.UNKNOWN
    )
    soil_texture = models.CharField(
        max_length=20, choices=SoilTexture.choices, default=SoilTexture.UNKNOWN
    )
    drainage = models.CharField(
        max_length=20, choices=Drainage.choices, default=Drainage.UNKNOWN
    )
    soil_moisture = models.CharField(
        max_length=20, choices=SoilMoisture.choices, default=SoilMoisture.UNKNOWN
    )
    ph_level = models.DecimalField(
        max_digits=4, decimal_places=2, null=True, blank=True,
        help_text="Optional. Null means the Farmer does not know the pH.",
    )
    nitrogen = models.CharField(
        max_length=20, choices=NutrientLevel.choices, default=NutrientLevel.UNKNOWN
    )
    phosphorus = models.CharField(
        max_length=20, choices=NutrientLevel.choices, default=NutrientLevel.UNKNOWN
    )
    potassium = models.CharField(
        max_length=20, choices=NutrientLevel.choices, default=NutrientLevel.UNKNOWN
    )
    organic_matter = models.CharField(
        max_length=20, choices=NutrientLevel.choices, default=NutrientLevel.UNKNOWN
    )
    notes = models.TextField(
        blank=True, help_text="Free-text observations, e.g. 'dries out quickly'."
    )
    # --- Gemini result: exactly the six sections, nothing more -----------
    suitable_fruits = models.JSONField(default=list, blank=True)
    suitable_vegetables = models.JSONField(default=list, blank=True)
    suitable_crops = models.JSONField(default=list, blank=True)
    fertilizer_recommendations = models.JSONField(default=list, blank=True)
    soil_improvement_watering = models.JSONField(default=list, blank=True)
    important_warnings = models.JSONField(default=list, blank=True)

    ai_generated = models.BooleanField(default=False)
    model_name = models.CharField(max_length=100, blank=True)
    failure_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Soil recommendation for {self.farmer.email} ({self.created_at:%Y-%m-%d})"

    @property
    def has_npk(self) -> bool:
        """
        True when the Farmer supplied at least one nutrient reading. Drives
        how cautious the fertilizer advice is allowed to be.
        """
        unknown = self.NutrientLevel.UNKNOWN
        return any(
            value != unknown
            for value in (self.nitrogen, self.phosphorus, self.potassium)
        )

from django.urls import path
from rest_framework.routers import DefaultRouter

from notifications.urls import farmer_notification_urlpatterns

from . import views

router = DefaultRouter()
router.register(r"plants", views.FarmerPlantViewSet, basename="farmer-plant")

# Mounted at /api/farmer/
farmer_urlpatterns = [
    path("crops/", views.CropListView.as_view(), name="crop-list"),
    path(
        "crops/<slug:crop_id>/intelligence/",
        views.crop_intelligence,
        name="crop-intelligence",
    ),
    path(
        "plants/<int:plant_id>/assessments/",
        views.PlantAssessmentListCreateView.as_view(),
        name="plant-assessments",
    ),
    path(
        "plants/<int:plant_id>/assessments/eligibility/",
        views.plant_assessment_eligibility,
        name="plant-assessment-eligibility",
    ),
    path(
        "plants/<int:plant_id>/evidence/validate/",
        views.validate_plant_evidence,
        name="plant-evidence-validate",
    ),
    path(
        "assessments/<int:pk>/",
        views.AssessmentDetailView.as_view(),
        name="assessment-detail",
    ),
    path(
        "assessments/<int:pk>/evidence/",
        views.AssessmentEvidenceView.as_view(),
        name="assessment-evidence",
    ),
    path(
        "assessments/<int:pk>/reanalyze/",
        views.reanalyze_assessment,
        name="assessment-reanalyze",
    ),
    path(
        "soil-recommendations/",
        views.SoilRecommendationListCreateView.as_view(),
        name="soil-recommendation-list",
    ),
    path(
        "soil-recommendations/latest/",
        views.latest_soil_recommendation,
        name="soil-recommendation-latest",
    ),
    path(
        "soil-recommendations/<int:pk>/",
        views.SoilRecommendationDetailView.as_view(),
        name="soil-recommendation-detail",
    ),
    path("risk/", views.farmer_risk_overview, name="farmer-risk"),
    path("risk/history/", views.farmer_risk_history, name="farmer-risk-history"),
    *farmer_notification_urlpatterns,
    *router.urls,
]

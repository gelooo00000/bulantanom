from django.urls import path

from notifications.urls import (
    admin_notification_urlpatterns,
    lgu_notification_urlpatterns,
)
from plants import views as plant_views

from . import lgu_views, views

# Mounted at /api/auth/
auth_urlpatterns = [
    path("farmer/signup/", views.FarmerSignupView.as_view(), name="farmer-signup"),
    path("farmer/login/", views.FarmerLoginView.as_view(), name="farmer-login"),
    path("lgu/login/", views.LguLoginView.as_view(), name="lgu-login"),
    path("admin/login/", views.AdminLoginView.as_view(), name="admin-login"),
    path("refresh/", views.RefreshView.as_view(), name="auth-refresh"),
    path("me/", views.MeView.as_view(), name="auth-me"),
    path("logout/", views.LogoutView.as_view(), name="auth-logout"),
]

# Mounted at /api/admin/ — every route below is IsAdmin-guarded.
admin_urlpatterns = [
    path("users/", views.AdminUserListView.as_view(), name="admin-users"),
    path("farmers/<int:user_id>/approve/", views.approve_farmer, name="admin-approve-farmer"),
    path("farmers/<int:user_id>/reject/", views.reject_farmer, name="admin-reject-farmer"),
    path("farmers/<int:user_id>/suspend/", views.suspend_farmer, name="admin-suspend-farmer"),
    path("lgu-officers/", views.AdminCreateLguOfficerView.as_view(), name="admin-create-lgu"),
    path("officers/<int:user_id>/suspend/", views.suspend_officer, name="admin-suspend-officer"),
    path(
        "officers/<int:user_id>/reactivate/",
        views.reactivate_officer,
        name="admin-reactivate-officer",
    ),
    path("accounts/<int:user_id>/", views.delete_account, name="admin-delete-account"),
    path("dashboard/", views.admin_dashboard, name="admin-dashboard"),
    # The legacy pending-registration feed moved aside so /notifications/ can
    # serve the real Notification model, the same as the other two roles.
    path("registrations/", views.pending_registrations, name="admin-registrations"),
    *admin_notification_urlpatterns,
]

# Mounted at /api/lgu/ — every route below is IsLguOfficer-guarded.
lgu_urlpatterns = [
    path("dashboard/", lgu_views.lgu_dashboard, name="lgu-dashboard"),
    path("farmers/", lgu_views.LguFarmerListView.as_view(), name="lgu-farmers"),
    path("farmers/<int:pk>/", lgu_views.LguFarmerDetailView.as_view(), name="lgu-farmer-detail"),
    path("farm/", lgu_views.lgu_farm_overview, name="lgu-farm"),
    path("plants/", lgu_views.lgu_plants, name="lgu-plants"),
    path("risk/overview/", lgu_views.lgu_risk_overview, name="lgu-risk-overview"),
    path("risk/high-risk/", lgu_views.lgu_high_risk, name="lgu-high-risk"),
    path("assessments/history/", lgu_views.lgu_assessment_history, name="lgu-assessments"),
    path(
        "assessments/<int:pk>/evidence/",
        plant_views.AssessmentEvidenceView.as_view(),
        name="lgu-assessment-evidence",
    ),
    path(
        "soil-recommendations/",
        lgu_views.LguSoilRecommendationListView.as_view(),
        name="lgu-soil-recommendations",
    ),
    # Same views as the Farmer mount; the recipient is always request.user.
    path("reports/", lgu_views.lgu_report_catalog, name="lgu-reports"),
    path("reports/<slug:slug>/", lgu_views.lgu_report_detail, name="lgu-report-detail"),
    path("reports/<slug:slug>/pdf/", lgu_views.lgu_report_pdf, name="lgu-report-pdf"),
    *lgu_notification_urlpatterns,
]

urlpatterns = auth_urlpatterns

from django.urls import path

from . import views

# Mounted at /api/analytics/ - every route is IsLguOrAdmin and read-only.
analytics_urlpatterns = [
    path("filters/", views.filter_options, name="analytics-filters"),
    path("summary/", views.summary, name="analytics-summary"),
    path("overview/", views.overview, name="analytics-overview"),
    path("crop-recommendations/", views.crop_recommendations, name="analytics-crop-recommendations"),
    path("recommended-vs-planted/", views.recommended_vs_planted, name="analytics-recommended-vs-planted"),
    path("harvest-trends/", views.harvest_trends, name="analytics-harvest-trends"),
    path("insights/", views.insights, name="analytics-insights"),
]

# Mounted at /api/reports/
report_urlpatterns = [
    path("", views.report_history, name="report-history"),
]

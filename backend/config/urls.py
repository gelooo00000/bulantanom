from django.contrib import admin
from django.urls import include, path

from accounts.urls import admin_urlpatterns, auth_urlpatterns, lgu_urlpatterns
from analytics.urls import analytics_urlpatterns, report_urlpatterns, soil_record_urlpatterns
from plants.urls import farmer_urlpatterns
from plants.views import farm_weather

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include((auth_urlpatterns, "auth"))),
    path("api/admin/", include((admin_urlpatterns, "api-admin"))),
    path("api/lgu/", include((lgu_urlpatterns, "api-lgu"))),
    path("api/farmer/", include((farmer_urlpatterns, "api-farmer"))),
    path("api/analytics/", include((analytics_urlpatterns, "api-analytics"))),
    path("api/soil-records/", include((soil_record_urlpatterns, "api-soil-records"))),
    path("api/reports/", include((report_urlpatterns, "api-reports"))),
    path("api/weather/", farm_weather, name="farm-weather"),
]

# MEDIA_URL is deliberately NOT served here, in development or anywhere else.
# Evidence photos are private: they are streamed by
# `plants.views.AssessmentEvidenceView` only after the caller is authorized
# against the stored Assessment. Re-adding a static() route would silently
# reopen unauthenticated access to every uploaded image.

"""
Read-only Agricultural Analytics endpoints, for LGU Officers and Admins.

Each takes the global filters as query parameters (date_from, date_to,
season, soil_type, crop, farmer) and answers 400 for a malformed one.
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsLguOrAdmin

from . import services
from .filters import FilterError, parse
from .models import ReportLog


def _filtered(builder):
    @api_view(["GET"])
    @permission_classes([IsLguOrAdmin])
    def view(request):
        try:
            filters = parse(request.query_params)
        except FilterError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(builder(filters))

    view.__name__ = builder.__name__
    view.__doc__ = builder.__doc__
    return view


summary = _filtered(services.summary)
overview = _filtered(services.overview)
crop_recommendations = _filtered(services.crop_recommendations)
recommended_vs_planted = _filtered(services.recommended_vs_planted)
harvest_trends = _filtered(services.harvest_trends)
soil_map = _filtered(services.soil_map)
insights = _filtered(services.insights)
audit = _filtered(services.audit)
soil_records = _filtered(services.soil_record_rows)


@api_view(["GET"])
@permission_classes([IsLguOrAdmin])
def filter_options(request):
    """GET /api/analytics/filters/ - the choices for the filter bar, from real rows."""
    return Response(services.filter_options())


@api_view(["GET"])
@permission_classes([IsLguOrAdmin])
def report_history(request):
    """GET /api/reports/ - the most recent report exports, newest first."""
    logs = ReportLog.objects.select_related("user")[:100]
    return Response(
        {
            "results": [
                {
                    "id": log.id,
                    "report": log.report,
                    "title": log.title,
                    "params": log.params,
                    "format": log.export_format,
                    "created_at": log.created_at.isoformat(),
                    "by": (log.user.get_full_name() or log.user.email) if log.user else None,
                }
                for log in logs
            ]
        }
    )

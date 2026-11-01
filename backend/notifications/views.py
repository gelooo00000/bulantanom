"""
Notification API.

Every queryset here is filtered to `request.user`. The recipient is never
read from a query parameter or request body, so `?user_id=` cannot expose
another account's notifications — the parameter simply does not exist.
"""

import hmac
import io
import logging

from django.conf import settings
from django.core.management import call_command
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsApproved

from .models import Notification
from .serializers import NotificationSerializer

logger = logging.getLogger(__name__)

DAILY_JOBS = ("notify_harvest_windows", "retry_failed_emails")


class NotificationPagination(PageNumberPagination):
    """The bell opens a page at a time — never the full history."""

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


def own_notifications(user):
    return Notification.objects.filter(recipient=user).select_related("recipient")


class NotificationListView(generics.ListAPIView):
    """
    GET notifications/            — newest first, paginated
    GET notifications/?unread=true — unread only
    """

    serializer_class = NotificationSerializer
    permission_classes = [IsApproved]
    pagination_class = NotificationPagination

    def get_queryset(self):
        queryset = own_notifications(self.request.user)
        if self.request.query_params.get("unread") == "true":
            queryset = queryset.filter(is_read=False)
        return queryset


class UnreadCountView(APIView):
    """GET notifications/unread-count/ — counted in MySQL, never in the UI."""

    permission_classes = [IsApproved]

    def get(self, request):
        unread = own_notifications(request.user).filter(is_read=False).count()
        return Response({"unread": unread})


class MarkReadView(APIView):
    """
    POST notifications/{id}/read/

    Scoped to the caller's own rows, so another user's id returns 404 rather
    than revealing that the notification exists.
    """

    permission_classes = [IsApproved]

    def post(self, request, pk):
        notification = own_notifications(request.user).filter(pk=pk).first()
        if notification is None:
            return Response(
                {"detail": "Notification not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        notification.mark_read()
        return Response(NotificationSerializer(notification).data)


class MarkAllReadView(APIView):
    """POST notifications/read-all/ — one UPDATE over the caller's unread rows."""

    permission_classes = [IsApproved]

    def post(self, request):
        updated = (
            own_notifications(request.user)
            .filter(is_read=False)
            .update(is_read=True, read_at=timezone.now())
        )
        return Response({"updated": updated, "unread": 0})


class DailyJobsView(APIView):
    """
    POST /api/jobs/daily/ with an X-Jobs-Secret header.

    The free Render plan has no cron, so a scheduled GitHub Action calls this
    (.github/workflows/daily-jobs.yml). Both commands are safe to run twice.
    A wrong or missing secret gets a 404, so the route does not advertise
    itself. One job failing does not stop the other, and answers 500 so the
    Action shows as failed.
    """

    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        secret = settings.DAILY_JOBS_SECRET
        supplied = request.headers.get("X-Jobs-Secret", "")
        if not secret or not hmac.compare_digest(secret.encode(), supplied.encode()):
            return Response(status=status.HTTP_404_NOT_FOUND)

        results = {}
        failed = False
        for job in DAILY_JOBS:
            output = io.StringIO()
            try:
                call_command(job, stdout=output)
                results[job] = output.getvalue().strip()
            except Exception:
                logger.exception("Daily job %s failed", job)
                results[job] = "failed"
                failed = True
        return Response(
            results,
            status=status.HTTP_500_INTERNAL_SERVER_ERROR if failed else status.HTTP_200_OK,
        )

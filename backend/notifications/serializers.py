from rest_framework import serializers

from accounts.models import UserRole

from .models import Notification, RelatedType


def build_route(notification) -> str | None:
    """
    Where clicking this notification should go.

    Derived at serialization time from `related_type` + the recipient's role,
    never stored — so a route change is a code change, not a data migration,
    and old notifications keep working.
    """
    role = notification.recipient.role
    related_id = notification.related_id

    if notification.related_type == RelatedType.ASSESSMENT and related_id:
        if role == UserRole.LGU_OFFICER:
            # The LGU has no per-assessment page; high risk belongs in the
            # High-Risk Cases queue, everything else in the history list.
            return (
                "/lgu/high-risk"
                if notification.notification_type == "RISK_HIGH"
                else "/lgu/assessments"
            )
        return f"/farmer/assessments/{related_id}"

    if notification.related_type == RelatedType.PLANT and related_id:
        if role == UserRole.LGU_OFFICER:
            return "/lgu/plants"
        return f"/farmer/plants/{related_id}"

    if notification.related_type == RelatedType.FARMER:
        if role == UserRole.LGU_OFFICER:
            return "/lgu/farmers"
        return "/farmer/dashboard"

    return None


class NotificationSerializer(serializers.ModelSerializer):
    route = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "notification_type",
            "severity",
            "title",
            "message",
            "related_type",
            "related_id",
            "metadata",
            "route",
            "is_read",
            "read_at",
            "created_at",
        ]
        # Everything is written by the notification service; a client can
        # only ever change read state, and only through the read endpoints.
        read_only_fields = fields

    def get_route(self, obj):
        return build_route(obj)

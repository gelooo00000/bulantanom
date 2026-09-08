"""
Notification routes.

Mounted under both /api/farmer/ and /api/lgu/. The recipient is always the
authenticated user, so the prefix never selects *whose* notifications are
returned — but each mount is additionally role-gated, so a Farmer calling the
LGU URL is rejected outright rather than quietly served their own rows.
"""

from django.urls import path

from accounts.permissions import IsAdmin, IsApproved, IsFarmer, IsLguOfficer

from . import views


def _notification_urlpatterns(role_permission):
    """
    One role-scoped copy of the notification routes.

    Permissions are passed to `as_view()` per mount rather than set on the
    view classes, so the two mounts cannot overwrite each other's rules and
    the queryset logic stays in exactly one place.
    """
    permissions = [role_permission, IsApproved]

    return [
        path(
            "notifications/",
            views.NotificationListView.as_view(permission_classes=permissions),
            name="notification-list",
        ),
        path(
            "notifications/unread-count/",
            views.UnreadCountView.as_view(permission_classes=permissions),
            name="notification-unread-count",
        ),
        path(
            "notifications/read-all/",
            views.MarkAllReadView.as_view(permission_classes=permissions),
            name="notification-read-all",
        ),
        path(
            "notifications/<int:pk>/read/",
            views.MarkReadView.as_view(permission_classes=permissions),
            name="notification-read",
        ),
    ]


farmer_notification_urlpatterns = _notification_urlpatterns(IsFarmer)
lgu_notification_urlpatterns = _notification_urlpatterns(IsLguOfficer)
admin_notification_urlpatterns = _notification_urlpatterns(IsAdmin)

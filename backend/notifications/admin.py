from django.contrib import admin

from .models import EmailLog, Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """
    Read-only. Notifications are created by the notification service from
    real events; hand-authoring one here would be exactly the fabricated
    data the system is built to avoid.
    """

    list_display = ("created_at", "recipient", "notification_type", "title", "is_read")
    list_filter = ("notification_type", "severity", "is_read")
    search_fields = ("recipient__email", "title", "message")
    ordering = ("-created_at",)
    readonly_fields = [f.name for f in Notification._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    """
    Read-only record of lifecycle emails. Editable rows would let someone
    mark a failed send as delivered, which is exactly the fiction this table
    exists to prevent.
    """

    list_display = ("created_at", "to_email", "event_key", "status", "attempts")
    list_filter = ("status", "event_key")
    search_fields = ("to_email", "recipient__email", "event_key")
    readonly_fields = [f.name for f in EmailLog._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

from django.conf import settings
from django.db import models
from django.utils import timezone


class ReportLog(models.Model):
    """
    One exported report: who exported which report, with which parameters,
    in which format. The report itself is not stored; it is rebuilt from
    the parameters, so a re-download reflects the records as they are now.
    """

    class Format(models.TextChoices):
        PDF = "pdf", "PDF"
        CSV = "csv", "CSV"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="report_logs"
    )
    report = models.SlugField(max_length=64)
    title = models.CharField(max_length=160)
    params = models.JSONField(default=dict, blank=True)
    export_format = models.CharField(max_length=8, choices=Format.choices)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.export_format}) {self.created_at:%Y-%m-%d %H:%M}"

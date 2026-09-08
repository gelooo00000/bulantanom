"""
Raise harvest notifications from real, stored harvest windows.

BulanTanom has no scheduler of its own, so this is a management command
meant to be run once a day (cron / Windows Task Scheduler):

    python manage.py notify_harvest_windows

It reads `Plant.expected_harvest_start`, which Django calculated from the
Crop table when the plant was created — no date is invented here, and no
Gemini call is made. Every notification is deduplicated per plant and stage,
so running the command repeatedly is safe and idempotent.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import AccountStatus, UserRole
from notifications.services import notify_harvest_window
from plants.models import Plant

# How far ahead of the expected start a plant counts as "approaching".
APPROACHING_WINDOW_DAYS = 7


class Command(BaseCommand):
    help = "Create harvest-approaching and harvest-ready notifications from stored plant data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be sent without writing any notifications.",
        )

    def handle(self, *args, **options):
        today = timezone.localdate()
        dry_run = options["dry_run"]

        plants = Plant.objects.filter(
            farmer__role=UserRole.FARMER,
            farmer__account_status=AccountStatus.APPROVED,
            farmer__is_active=True,
            # A harvested or archived plant has nothing left to announce.
            status__in=["GROWING", "READY_FOR_HARVEST"],
        ).select_related("crop", "farmer")

        approaching = ready = 0
        for plant in plants:
            start = plant.expected_harvest_start
            end = plant.expected_harvest_end

            if start <= today <= end:
                ready += 1
                if not dry_run:
                    notify_harvest_window(plant, ready=True)
            elif today >= start - timedelta(days=APPROACHING_WINDOW_DAYS) and today < start:
                approaching += 1
                if not dry_run:
                    notify_harvest_window(plant, ready=False)

        prefix = "[dry run] " if dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix}{plants.count()} active plants checked · "
                f"{approaching} approaching harvest · {ready} within the harvest window."
            )
        )

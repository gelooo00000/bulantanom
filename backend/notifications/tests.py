"""
Notification system tests.

`TransactionTestCase` is used wherever a notification must actually appear:
the service queues writes with `transaction.on_commit`, and in a normal
`TestCase` the surrounding atomic block never commits, so those callbacks
would never run and the assertions would be meaningless.
"""

import io
from datetime import timedelta
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.db import transaction
from django.test import TransactionTestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase, APITransactionTestCase

from accounts.models import AccountStatus, User, UserRole
from plants.models import Assessment, Crop, Plant, RiskAssessment, RiskStatus

from .models import Notification, NotificationType
from .services import create_notification, notify_plant_added

PW = "SecurePassword123!"
FARMER_LOGIN_URL = "/api/auth/farmer/login/"
LGU_LOGIN_URL = "/api/auth/lgu/login/"
FARMER_NOTIFICATIONS = "/api/farmer/notifications/"
LGU_NOTIFICATIONS = "/api/lgu/notifications/"
UNREAD_COUNT = "/api/farmer/notifications/unread-count/"
READ_ALL = "/api/farmer/notifications/read-all/"

VALID_ASSESSMENT = {
    "growth_condition": "as_expected",
    "health_condition": "healthy",
    "leaf_condition": "healthy",
    "watering_frequency": "daily",
}

EVIDENCE_MATCH = {
    "evidence_valid": True,
    "verdict": "match",
    "confidence": 0.93,
    "detected_subject": "guava plant",
    "expected_crop": "Guava",
    "reason": "Looks like guava.",
    "message": "Plant evidence accepted.",
}

EVIDENCE_MISMATCH = {
    **EVIDENCE_MATCH,
    "evidence_valid": False,
    "verdict": "mismatch",
    "detected_subject": "tomato plant",
    "reason": "This looks like a tomato plant.",
    "message": "Please upload a clear photo of your guava plant.",
}


def gemini_result(level="HIGH"):
    return {
        "risk_level": level,
        "summary": f"{level} summary from the stored evaluation.",
        "reality_vs_expectation": {"expected": "e", "observed": "o", "assessment": "a"},
        "visual_observations": [],
        "risk_factors": [],
        "possible_causes": [],
        "recommended_actions": [],
        "monitoring_advice": [],
        "limitations": [],
        "next_assessment_days": 7,
        "image_analyzed": True,
    }


def make_user(email, role=UserRole.FARMER, account_status=AccountStatus.APPROVED):
    return User.objects.create_user(
        email=email, password=PW, first_name="Test", last_name="User",
        role=role, account_status=account_status,
    )


def make_image(name="plant.jpg"):
    buffer = io.BytesIO()
    Image.new("RGB", (80, 80), (40, 120, 60)).save(buffer, format="JPEG")
    buffer.seek(0)
    return SimpleUploadedFile(name, buffer.read(), content_type="image/jpeg")


class NotificationTestMixin:
    def login(self, email, url=FARMER_LOGIN_URL):
        token = self.client.post(
            url, {"email": email, "password": PW}, format="json"
        ).data["access"]
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def ensure_crop(self, crop_id="guava"):
        """
        TransactionTestCase truncates every table between tests, including
        the crop catalog loaded by the seed migration, so the crops these
        tests rely on are recreated explicitly.
        """
        crop, _ = Crop.objects.get_or_create(
            pk=crop_id,
            defaults={
                "name": crop_id.capitalize(),
                "category": "fruit",
                "emoji": "🌱",
                "growing_duration_days": 240,
                "harvest_window_days": 30,
                "description": "Test crop.",
            },
        )
        return crop

    def make_plant(self, farmer, crop_id="guava", days_ago=30):
        return Plant.objects.create(
            farmer=farmer,
            crop=self.ensure_crop(crop_id),
            planting_date=timezone.localdate() - timedelta(days=days_ago),
        )

    def types_for(self, user):
        return set(
            Notification.objects.filter(recipient=user).values_list(
                "notification_type", flat=True
            )
        )


@override_settings(MEDIA_ROOT="/tmp/bulantanom-notification-tests")
class PlantNotificationTests(NotificationTestMixin, APITransactionTestCase):
    """A Farmer adding a plant notifies the Farmer and the LGU."""

    def setUp(self):
        super().setUp()
        self.ensure_crop("guava")
        self.farmer = make_user("farmer@example.com")
        self.officer = make_user("officer@example.com", UserRole.LGU_OFFICER)
        self.auth = self.login("farmer@example.com")

    def test_adding_a_plant_notifies_farmer_and_lgu(self):
        response = self.client.post(
            "/api/farmer/plants/",
            {"crop_id": "guava", "planting_date": timezone.localdate().isoformat()},
            format="json",
            **self.auth,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        farmer_note = Notification.objects.get(
            recipient=self.farmer, notification_type=NotificationType.PLANT_ADDED
        )
        self.assertEqual(farmer_note.title, "Plant Added Successfully")
        self.assertIn("Guava", farmer_note.message)
        self.assertEqual(farmer_note.related_id, response.data["id"])

        lgu_note = Notification.objects.get(
            recipient=self.officer, notification_type=NotificationType.PLANT_ADDED
        )
        self.assertIn("Test User", lgu_note.message)
        self.assertIn("Guava", lgu_note.message)
        self.assertEqual(lgu_note.metadata["crop_name"], "Guava")

    def test_updating_a_plant_notifies_only_the_farmer(self):
        plant = self.make_plant(self.farmer)
        response = self.client.patch(
            f"/api/farmer/plants/{plant.id}/", {"label": "Back Field"},
            format="json", **self.auth,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertIn(NotificationType.PLANT_UPDATED, self.types_for(self.farmer))
        self.assertNotIn(NotificationType.PLANT_UPDATED, self.types_for(self.officer))

    def test_a_failed_create_notifies_nobody(self):
        """Section 35 — notifications follow a committed transaction only."""
        before = Notification.objects.count()
        response = self.client.post(
            "/api/farmer/plants/",
            {"crop_id": "not-a-real-crop", "planting_date": "2026-01-01"},
            format="json",
            **self.auth,
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Notification.objects.count(), before)

    def test_rolled_back_transaction_creates_no_notification(self):
        plant = self.make_plant(self.farmer)
        before = Notification.objects.count()
        try:
            with transaction.atomic():
                notify_plant_added(plant)
                raise RuntimeError("simulated failure after the notify call")
        except RuntimeError:
            pass
        self.assertEqual(Notification.objects.count(), before)


@override_settings(MEDIA_ROOT="/tmp/bulantanom-notification-tests")
class AssessmentNotificationTests(NotificationTestMixin, APITransactionTestCase):
    def setUp(self):
        super().setUp()
        self.farmer = make_user("farmer@example.com")
        self.officer = make_user("officer@example.com", UserRole.LGU_OFFICER)
        self.auth = self.login("farmer@example.com")
        self.plant = self.make_plant(self.farmer)
        self.url = f"/api/farmer/plants/{self.plant.id}/assessments/"

        patcher = patch(
            "plants.evidence_validation_service.validate_crop_evidence",
            return_value=EVIDENCE_MATCH,
        )
        self.mock_evidence = patcher.start()
        self.addCleanup(patcher.stop)

    def submit(self, level="HIGH"):
        with patch(
            "plants.risk_evaluation_service.evaluate_assessment",
            return_value=gemini_result(level),
        ):
            return self.client.post(
                self.url,
                {**VALID_ASSESSMENT, "evidence_image": make_image()},
                **self.auth,
            )

    def test_submission_notifies_farmer_and_lgu(self):
        response = self.submit("LOW")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        farmer_types = self.types_for(self.farmer)
        self.assertIn(NotificationType.ASSESSMENT_SUBMITTED, farmer_types)
        self.assertIn(NotificationType.ASSESSMENT_LOCKED, farmer_types)
        self.assertIn(NotificationType.EVIDENCE_UPLOADED, farmer_types)
        self.assertIn(NotificationType.AI_EVALUATION_COMPLETED, farmer_types)

        lgu_types = self.types_for(self.officer)
        self.assertIn(NotificationType.ASSESSMENT_SUBMITTED, lgu_types)
        self.assertIn(NotificationType.EVIDENCE_UPLOADED, lgu_types)

    def test_submission_notification_carries_the_backend_next_date(self):
        self.submit("LOW")
        note = Notification.objects.get(
            recipient=self.farmer, notification_type=NotificationType.ASSESSMENT_SUBMITTED
        )
        expected = (timezone.localdate() + timedelta(days=7)).isoformat()
        self.assertIn(expected, note.message)
        self.assertEqual(note.metadata["next_assessment_date"], expected)

    def test_high_risk_notifies_both_sides(self):
        self.submit("HIGH")

        farmer_note = Notification.objects.get(
            recipient=self.farmer, notification_type=NotificationType.RISK_HIGH
        )
        self.assertEqual(farmer_note.title, "High Risk Alert — Guava")
        self.assertEqual(farmer_note.severity, "critical")

        lgu_note = Notification.objects.get(
            recipient=self.officer, notification_type=NotificationType.RISK_HIGH
        )
        self.assertIn("Test User", lgu_note.message)
        self.assertIn("HIGH", lgu_note.message)
        self.assertEqual(lgu_note.severity, "critical")
        # Section 26 — evidence availability is called out.
        self.assertTrue(lgu_note.metadata["has_evidence"])
        self.assertIn("evidence", lgu_note.title.lower())

    def test_medium_risk_is_not_as_urgent_as_high(self):
        self.submit("MEDIUM")
        farmer_note = Notification.objects.get(
            recipient=self.farmer, notification_type=NotificationType.RISK_MEDIUM
        )
        self.assertEqual(farmer_note.severity, "warning")
        lgu_note = Notification.objects.get(
            recipient=self.officer, notification_type=NotificationType.RISK_MEDIUM
        )
        self.assertEqual(lgu_note.title, "Medium-Risk Plant")

    def test_low_risk_lgu_message_is_an_assessment_completion(self):
        self.submit("LOW")
        lgu_note = Notification.objects.get(
            recipient=self.officer, notification_type=NotificationType.RISK_LOW
        )
        self.assertEqual(lgu_note.title, "Assessment Completed")
        self.assertEqual(lgu_note.severity, "success")

    def test_failed_evaluation_produces_no_risk_notification(self):
        """No stored level means nothing to report — never a fabricated one."""
        with patch(
            "plants.risk_evaluation_service.evaluate_assessment", return_value=None
        ):
            response = self.client.post(
                self.url,
                {**VALID_ASSESSMENT, "evidence_image": make_image()},
                **self.auth,
            )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        types = self.types_for(self.farmer)
        self.assertIn(NotificationType.ASSESSMENT_SUBMITTED, types)
        for risk_type in (
            NotificationType.RISK_LOW,
            NotificationType.RISK_MEDIUM,
            NotificationType.RISK_HIGH,
            NotificationType.AI_EVALUATION_COMPLETED,
        ):
            self.assertNotIn(risk_type, types)

    def test_rejected_evidence_notifies_farmer_and_lgu(self):
        self.mock_evidence.return_value = EVIDENCE_MISMATCH
        response = self.client.post(
            f"/api/farmer/plants/{self.plant.id}/evidence/validate/",
            {"evidence_image": make_image()},
            **self.auth,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(NotificationType.EVIDENCE_REJECTED, self.types_for(self.farmer))
        self.assertIn(NotificationType.EVIDENCE_REJECTED, self.types_for(self.officer))

    def test_accepted_evidence_notifies_only_the_farmer(self):
        self.client.post(
            f"/api/farmer/plants/{self.plant.id}/evidence/validate/",
            {"evidence_image": make_image()},
            **self.auth,
        )
        self.assertIn(NotificationType.EVIDENCE_ACCEPTED, self.types_for(self.farmer))
        self.assertNotIn(NotificationType.EVIDENCE_ACCEPTED, self.types_for(self.officer))

    def test_no_gemini_call_is_made_to_write_notification_text(self):
        """Section 36 — notifications reuse stored results, never a new call."""
        with patch(
            "plants.risk_evaluation_service.evaluate_assessment",
            return_value=gemini_result("HIGH"),
        ) as mock_risk:
            self.client.post(
                self.url,
                {**VALID_ASSESSMENT, "evidence_image": make_image()},
                **self.auth,
            )
        # One evaluation for the assessment itself, and none for notifications.
        self.assertEqual(mock_risk.call_count, 1)
        note = Notification.objects.get(
            recipient=self.farmer, notification_type=NotificationType.RISK_HIGH
        )
        self.assertEqual(note.metadata["summary"], gemini_result("HIGH")["summary"])


@override_settings(MEDIA_ROOT="/tmp/bulantanom-notification-tests")
class DuplicatePreventionTests(NotificationTestMixin, APITransactionTestCase):
    def setUp(self):
        super().setUp()
        self.farmer = make_user("farmer@example.com")
        self.officer = make_user("officer@example.com", UserRole.LGU_OFFICER)
        self.auth = self.login("farmer@example.com")
        self.plant = self.make_plant(self.farmer)

        patcher = patch(
            "plants.evidence_validation_service.validate_crop_evidence",
            return_value=EVIDENCE_MATCH,
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_repeated_page_loads_create_no_notifications(self):
        with patch(
            "plants.risk_evaluation_service.evaluate_assessment",
            return_value=gemini_result("HIGH"),
        ):
            self.client.post(
                f"/api/farmer/plants/{self.plant.id}/assessments/",
                {**VALID_ASSESSMENT, "evidence_image": make_image()},
                **self.auth,
            )
        baseline = Notification.objects.count()
        self.assertGreater(baseline, 0)

        assessment = Assessment.objects.get()
        for _ in range(3):
            self.client.get("/api/farmer/plants/", **self.auth)
            self.client.get(f"/api/farmer/plants/{self.plant.id}/", **self.auth)
            self.client.get("/api/farmer/risk/", **self.auth)
            self.client.get(f"/api/farmer/assessments/{assessment.id}/", **self.auth)
            self.client.get(FARMER_NOTIFICATIONS, **self.auth)
        self.assertEqual(Notification.objects.count(), baseline)

    def test_notifying_the_same_event_twice_is_a_no_op(self):
        notify_plant_added(self.plant)
        notify_plant_added(self.plant)
        self.assertEqual(
            Notification.objects.filter(
                recipient=self.farmer, notification_type=NotificationType.PLANT_ADDED
            ).count(),
            1,
        )

    def test_undeduplicated_notifications_are_still_distinct_rows(self):
        for _ in range(3):
            create_notification(
                recipient=self.farmer,
                notification_type=NotificationType.SYSTEM,
                title="Notice",
                message="A one-off system notice.",
            )
        self.assertEqual(
            Notification.objects.filter(recipient=self.farmer).count(), 3
        )


class NotificationApiTests(NotificationTestMixin, APITestCase):
    """Listing, read state and the unread count. No on_commit involved."""

    def setUp(self):
        super().setUp()
        self.farmer = make_user("farmer@example.com")
        self.other = make_user("other@example.com")
        self.officer = make_user("officer@example.com", UserRole.LGU_OFFICER)
        self.auth = self.login("farmer@example.com")

        for i in range(3):
            create_notification(
                recipient=self.farmer,
                notification_type=NotificationType.SYSTEM,
                title=f"Mine {i}",
                message="For this farmer.",
            )
        create_notification(
            recipient=self.other,
            notification_type=NotificationType.SYSTEM,
            title="Not yours",
            message="For a different farmer.",
        )

    def test_list_returns_only_my_notifications(self):
        data = self.client.get(FARMER_NOTIFICATIONS, **self.auth).data
        self.assertEqual(data["count"], 3)
        titles = [n["title"] for n in data["results"]]
        self.assertNotIn("Not yours", titles)

    def test_list_is_newest_first(self):
        data = self.client.get(FARMER_NOTIFICATIONS, **self.auth).data
        created = [n["created_at"] for n in data["results"]]
        self.assertEqual(created, sorted(created, reverse=True))

    def test_unread_count_comes_from_the_database(self):
        self.assertEqual(self.client.get(UNREAD_COUNT, **self.auth).data["unread"], 3)

    def test_mark_one_as_read(self):
        note = Notification.objects.filter(recipient=self.farmer).first()
        response = self.client.post(
            f"/api/farmer/notifications/{note.id}/read/", **self.auth
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_read"])

        note.refresh_from_db()
        self.assertTrue(note.is_read)
        self.assertIsNotNone(note.read_at)
        self.assertEqual(self.client.get(UNREAD_COUNT, **self.auth).data["unread"], 2)

    def test_mark_all_as_read(self):
        response = self.client.post(READ_ALL, **self.auth)
        self.assertEqual(response.data["updated"], 3)
        self.assertEqual(self.client.get(UNREAD_COUNT, **self.auth).data["unread"], 0)

    def test_unread_filter(self):
        note = Notification.objects.filter(recipient=self.farmer).first()
        self.client.post(f"/api/farmer/notifications/{note.id}/read/", **self.auth)
        data = self.client.get(f"{FARMER_NOTIFICATIONS}?unread=true", **self.auth).data
        self.assertEqual(data["count"], 2)

    def test_results_are_paginated(self):
        for i in range(30):
            create_notification(
                recipient=self.farmer,
                notification_type=NotificationType.SYSTEM,
                title=f"Bulk {i}",
                message="Filler.",
            )
        data = self.client.get(f"{FARMER_NOTIFICATIONS}?page_size=10", **self.auth).data
        self.assertEqual(len(data["results"]), 10)
        self.assertEqual(data["count"], 33)
        self.assertIsNotNone(data["next"])

    def test_routes_are_role_aware(self):
        plant = self.make_plant(self.farmer)
        assessment = Assessment.objects.create(
            plant=plant, plant_age_days=30, growth_condition="as_expected",
            health_condition="healthy", leaf_condition="healthy",
            watering_frequency="daily",
        )
        create_notification(
            recipient=self.farmer,
            notification_type=NotificationType.RISK_HIGH,
            title="High Risk",
            message="x",
            related_type="assessment",
            related_id=assessment.id,
        )
        create_notification(
            recipient=self.officer,
            notification_type=NotificationType.RISK_HIGH,
            title="High Risk",
            message="x",
            related_type="assessment",
            related_id=assessment.id,
        )

        farmer_route = self.client.get(FARMER_NOTIFICATIONS, **self.auth).data["results"][0]["route"]
        self.assertEqual(farmer_route, f"/farmer/assessments/{assessment.id}")

        officer_auth = self.login("officer@example.com", LGU_LOGIN_URL)
        officer_route = self.client.get(LGU_NOTIFICATIONS, **officer_auth).data["results"][0]["route"]
        self.assertEqual(officer_route, "/lgu/high-risk")


class NotificationSecurityTests(NotificationTestMixin, APITestCase):
    """Section 30 — the recipient always comes from the authenticated user."""

    def setUp(self):
        super().setUp()
        self.farmer_a = make_user("a@example.com")
        self.farmer_b = make_user("b@example.com")
        self.officer = make_user("officer@example.com", UserRole.LGU_OFFICER)

        self.note_a = create_notification(
            recipient=self.farmer_a,
            notification_type=NotificationType.SYSTEM,
            title="A only", message="x",
        )
        self.note_officer = create_notification(
            recipient=self.officer,
            notification_type=NotificationType.SYSTEM,
            title="Officer only", message="x",
        )
        self.auth_a = self.login("a@example.com")
        self.auth_b = self.login("b@example.com")
        self.auth_officer = self.login("officer@example.com", LGU_LOGIN_URL)

    def test_farmer_b_cannot_see_farmer_a_notifications(self):
        data = self.client.get(FARMER_NOTIFICATIONS, **self.auth_b).data
        self.assertEqual(data["count"], 0)

    def test_farmer_cannot_read_lgu_notifications(self):
        titles = [
            n["title"] for n in self.client.get(FARMER_NOTIFICATIONS, **self.auth_a).data["results"]
        ]
        self.assertNotIn("Officer only", titles)

    def test_lgu_cannot_read_a_farmers_personal_notifications(self):
        titles = [
            n["title"]
            for n in self.client.get(LGU_NOTIFICATIONS, **self.auth_officer).data["results"]
        ]
        self.assertNotIn("A only", titles)

    def test_a_user_id_parameter_cannot_widen_the_queryset(self):
        data = self.client.get(
            f"{FARMER_NOTIFICATIONS}?user_id={self.farmer_a.id}&recipient={self.farmer_a.id}",
            **self.auth_b,
        ).data
        self.assertEqual(data["count"], 0)

    def test_cannot_mark_another_users_notification_read(self):
        response = self.client.post(
            f"/api/farmer/notifications/{self.note_a.id}/read/", **self.auth_b
        )
        # 404, not 403 — the existence of the row is not revealed either.
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.note_a.refresh_from_db()
        self.assertFalse(self.note_a.is_read)

    def test_mark_all_read_only_touches_my_own(self):
        self.client.post(READ_ALL, **self.auth_b)
        self.note_a.refresh_from_db()
        self.assertFalse(self.note_a.is_read)

    def test_endpoints_require_authentication(self):
        for url in (FARMER_NOTIFICATIONS, UNREAD_COUNT, LGU_NOTIFICATIONS):
            self.assertEqual(
                self.client.get(url).status_code, status.HTTP_401_UNAUTHORIZED, url
            )
        self.assertEqual(
            self.client.post(READ_ALL).status_code, status.HTTP_401_UNAUTHORIZED
        )

    def test_unapproved_account_cannot_read_notifications(self):
        pending = make_user("pending@example.com", account_status=AccountStatus.PENDING)
        create_notification(
            recipient=pending,
            notification_type=NotificationType.SYSTEM,
            title="Pending", message="x",
        )
        # A pending account cannot obtain a token at all.
        response = self.client.post(
            FARMER_LOGIN_URL, {"email": "pending@example.com", "password": PW},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class AccountNotificationTests(NotificationTestMixin, APITransactionTestCase):
    def setUp(self):
        super().setUp()
        self.officer = make_user("officer@example.com", UserRole.LGU_OFFICER)

    def test_signup_notifies_the_new_farmer_and_the_lgu(self):
        response = self.client.post(
            "/api/auth/farmer/signup/",
            {
                "first_name": "Juan", "last_name": "Dela Cruz",
                "email": "juan@example.com",
                "password": PW, "password_confirm": PW,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        farmer = User.objects.get(email="juan@example.com")
        own = Notification.objects.get(
            recipient=farmer, notification_type=NotificationType.ACCOUNT_CREATED
        )
        self.assertIn("waiting for administrator approval", own.message)

        lgu = Notification.objects.get(
            recipient=self.officer, notification_type=NotificationType.ACCOUNT_CREATED
        )
        self.assertIn("Juan Dela Cruz", lgu.message)
        # Section 18 — never claim approved when it is not.
        self.assertNotIn("approved", lgu.message.lower())

    def test_approval_notifies_the_farmer_and_the_lgu(self):
        farmer = make_user("pending@example.com", account_status=AccountStatus.PENDING)
        admin = User.objects.create_superuser(
            email="root@example.com", password=PW, first_name="Root", last_name="Admin"
        )
        token = self.client.post(
            "/api/auth/admin/login/",
            {"email": admin.email, "password": PW}, format="json",
        ).data["access"]

        response = self.client.patch(
            f"/api/admin/farmers/{farmer.id}/approve/",
            **{"HTTP_AUTHORIZATION": f"Bearer {token}"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertTrue(
            Notification.objects.filter(
                recipient=farmer, notification_type=NotificationType.ACCOUNT_APPROVED
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.officer, notification_type=NotificationType.ACCOUNT_APPROVED
            ).exists()
        )

    def test_rejection_does_not_notify(self):
        farmer = make_user("pending@example.com", account_status=AccountStatus.PENDING)
        admin = User.objects.create_superuser(
            email="root@example.com", password=PW, first_name="Root", last_name="Admin"
        )
        token = self.client.post(
            "/api/auth/admin/login/",
            {"email": admin.email, "password": PW}, format="json",
        ).data["access"]

        self.client.patch(
            f"/api/admin/farmers/{farmer.id}/reject/",
            **{"HTTP_AUTHORIZATION": f"Bearer {token}"},
        )
        self.assertFalse(
            Notification.objects.filter(
                notification_type=NotificationType.ACCOUNT_APPROVED
            ).exists()
        )


class MultipleOfficerTests(NotificationTestMixin, APITransactionTestCase):
    """Section 28 — the officers are one shared Layuan Farm group."""

    def test_every_active_officer_gets_their_own_row(self):
        farmer = make_user("farmer@example.com")
        a = make_user("a.officer@example.com", UserRole.LGU_OFFICER)
        b = make_user("b.officer@example.com", UserRole.LGU_OFFICER)
        suspended = make_user(
            "old.officer@example.com", UserRole.LGU_OFFICER, AccountStatus.SUSPENDED
        )

        plant = self.make_plant(farmer)
        notify_plant_added(plant)

        self.assertTrue(Notification.objects.filter(recipient=a).exists())
        self.assertTrue(Notification.objects.filter(recipient=b).exists())
        self.assertFalse(Notification.objects.filter(recipient=suspended).exists())

    def test_read_state_is_per_officer(self):
        farmer = make_user("farmer@example.com")
        a = make_user("a.officer@example.com", UserRole.LGU_OFFICER)
        b = make_user("b.officer@example.com", UserRole.LGU_OFFICER)
        notify_plant_added(self.make_plant(farmer))

        Notification.objects.filter(recipient=a).first().mark_read()
        self.assertTrue(Notification.objects.filter(recipient=a, is_read=True).exists())
        self.assertFalse(Notification.objects.filter(recipient=b, is_read=True).exists())


class HarvestNotificationTests(NotificationTestMixin, TransactionTestCase):
    """
    Section 15 — harvest notifications come from stored harvest windows.
    The command is idempotent, so a daily schedule cannot spam a farmer.
    """

    def setUp(self):
        super().setUp()
        self.farmer = make_user("farmer@example.com")
        self.crop = self.ensure_crop("guava")

    def _plant_with_harvest_start(self, days_from_today):
        """Build a plant whose stored harvest window starts N days from today."""
        plant = self.make_plant(self.farmer)
        start = timezone.localdate() + timedelta(days=days_from_today)
        Plant.objects.filter(pk=plant.pk).update(
            expected_harvest_start=start,
            expected_harvest_end=start + timedelta(days=self.crop.harvest_window_days),
        )
        plant.refresh_from_db()
        return plant

    def test_approaching_harvest_is_announced(self):
        self._plant_with_harvest_start(3)
        call_command("notify_harvest_windows")
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.farmer,
                notification_type=NotificationType.HARVEST_APPROACHING,
            ).exists()
        )

    def test_plant_inside_the_window_is_announced_as_ready(self):
        self._plant_with_harvest_start(0)
        call_command("notify_harvest_windows")
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.farmer,
                notification_type=NotificationType.HARVEST_READY,
            ).exists()
        )

    def test_a_distant_harvest_is_not_announced(self):
        self._plant_with_harvest_start(60)
        call_command("notify_harvest_windows")
        self.assertEqual(Notification.objects.count(), 0)

    def test_running_daily_does_not_duplicate(self):
        self._plant_with_harvest_start(2)
        for _ in range(5):
            call_command("notify_harvest_windows")
        self.assertEqual(
            Notification.objects.filter(
                notification_type=NotificationType.HARVEST_APPROACHING
            ).count(),
            1,
        )

    def test_dry_run_writes_nothing(self):
        self._plant_with_harvest_start(2)
        call_command("notify_harvest_windows", "--dry-run")
        self.assertEqual(Notification.objects.count(), 0)


class RiskNotificationSourceTests(NotificationTestMixin, TransactionTestCase):
    """The risk notification reports the stored level, never a guess."""

    def test_notification_reflects_the_stored_risk_row(self):
        from notifications.services import notify_assessment_evaluated

        farmer = make_user("farmer@example.com")
        plant = self.make_plant(farmer)
        assessment = Assessment.objects.create(
            plant=plant, plant_age_days=30, growth_condition="as_expected",
            health_condition="healthy", leaf_condition="healthy",
            watering_frequency="daily",
        )
        risk = RiskAssessment.objects.create(
            assessment=assessment, status=RiskStatus.COMPLETED,
            risk_level="MEDIUM", summary="Stored medium summary.",
        )
        notify_assessment_evaluated(assessment, risk)

        note = Notification.objects.get(
            recipient=farmer, notification_type=NotificationType.RISK_MEDIUM
        )
        self.assertEqual(note.metadata["risk_level"], "MEDIUM")
        self.assertEqual(note.metadata["summary"], "Stored medium summary.")

    def test_a_failed_risk_row_reports_nothing(self):
        from notifications.services import notify_assessment_evaluated

        farmer = make_user("farmer@example.com")
        plant = self.make_plant(farmer)
        assessment = Assessment.objects.create(
            plant=plant, plant_age_days=30, growth_condition="as_expected",
            health_condition="healthy", leaf_condition="healthy",
            watering_frequency="daily",
        )
        risk = RiskAssessment.objects.create(
            assessment=assessment, status=RiskStatus.FAILED, risk_level=None
        )
        notify_assessment_evaluated(assessment, risk)
        self.assertEqual(Notification.objects.count(), 0)

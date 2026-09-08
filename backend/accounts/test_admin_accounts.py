"""
Admin management of LGU Officer accounts, and account deletion.

Officers previously had no status management at all — `_transition` was
hardcoded to Farmers — so an Officer could not be suspended even though the
permission layer would have honoured it. Deletion is new and deliberately
conservative; the tests here pin the refusal behaviour, because the failure
mode being guarded against is silently destroying farm history.
"""

from rest_framework import status
from rest_framework.test import APITestCase, APITransactionTestCase

from notifications.models import Notification

from .models import AccountStatus, User, UserRole

FARMER_LOGIN_URL = "/api/auth/farmer/login/"
LGU_LOGIN_URL = "/api/auth/lgu/login/"
ADMIN_LOGIN_URL = "/api/auth/admin/login/"
PW = "SecurePassword123!"


def make_user(email, role=UserRole.FARMER, status_=AccountStatus.APPROVED):
    return User.objects.create_user(
        email=email, password=PW, first_name="Test", last_name="User",
        role=role, account_status=status_,
    )


class AccountsSetupMixin:
    def setUp(self):
        self.admin = make_user("admin@example.com", UserRole.ADMIN)
        self.officer = make_user("officer@example.com", UserRole.LGU_OFFICER)
        self.farmer = make_user("farmer@example.com")

    def auth(self, email, url=ADMIN_LOGIN_URL):
        token = self.client.post(
            url, {"email": email, "password": PW}, format="json"
        ).data["access"]
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


class OfficerManagementTests(AccountsSetupMixin, APITestCase):
    """Officers get the same server-validated transitions as Farmers."""

    def suspend(self, user):
        return self.client.patch(
            f"/api/admin/officers/{user.id}/suspend/", **self.auth("admin@example.com")
        )

    def reactivate(self, user):
        return self.client.patch(
            f"/api/admin/officers/{user.id}/reactivate/",
            **self.auth("admin@example.com"),
        )

    def test_admin_can_suspend_an_officer(self):
        response = self.suspend(self.officer)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.officer.refresh_from_db()
        self.assertEqual(self.officer.account_status, AccountStatus.SUSPENDED)

    def test_admin_can_reactivate_an_officer(self):
        self.suspend(self.officer)
        response = self.reactivate(self.officer)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.officer.refresh_from_db()
        self.assertEqual(self.officer.account_status, AccountStatus.APPROVED)

    def test_suspended_officer_loses_api_access_immediately(self):
        headers = self.auth("officer@example.com", LGU_LOGIN_URL)
        self.assertEqual(
            self.client.get("/api/lgu/dashboard/", **headers).status_code,
            status.HTTP_200_OK,
        )
        self.suspend(self.officer)
        self.assertEqual(
            self.client.get("/api/lgu/dashboard/", **headers).status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_officer_route_cannot_be_pointed_at_a_farmer(self):
        """Role is part of the lookup, so ids cannot cross account types."""
        response = self.client.patch(
            f"/api/admin/officers/{self.farmer.id}/suspend/",
            **self.auth("admin@example.com"),
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.farmer.refresh_from_db()
        self.assertEqual(self.farmer.account_status, AccountStatus.APPROVED)

    def test_farmer_route_cannot_be_pointed_at_an_officer(self):
        response = self.client.patch(
            f"/api/admin/farmers/{self.officer.id}/suspend/",
            **self.auth("admin@example.com"),
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_invalid_officer_transition_is_refused(self):
        response = self.reactivate(self.officer)  # already APPROVED
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_officer_cannot_manage_another_officer(self):
        other = make_user("other-officer@example.com", UserRole.LGU_OFFICER)
        response = self.client.patch(
            f"/api/admin/officers/{other.id}/suspend/",
            **self.auth("officer@example.com", LGU_LOGIN_URL),
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_farmer_cannot_manage_an_officer(self):
        response = self.client.patch(
            f"/api/admin/officers/{self.officer.id}/suspend/",
            **self.auth("farmer@example.com", FARMER_LOGIN_URL),
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_cannot_manage_an_officer(self):
        response = self.client.patch(f"/api/admin/officers/{self.officer.id}/suspend/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class AccountDeletionTests(AccountsSetupMixin, APITestCase):
    """Deletion refuses anything holding farm history."""

    def delete(self, user, as_email="admin@example.com", url=ADMIN_LOGIN_URL):
        return self.client.delete(
            f"/api/admin/accounts/{user.id}/", **self.auth(as_email, url)
        )

    def test_admin_can_delete_an_account_with_no_records(self):
        target = make_user("clean@example.com", status_=AccountStatus.REJECTED)
        response = self.delete(target)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(User.objects.filter(pk=target.pk).exists())

    def test_account_with_farm_records_is_refused(self):
        from datetime import date

        from plants.models import Crop, Plant

        Plant.objects.create(
            farmer=self.farmer,
            crop=Crop.objects.first(),
            planting_date=date(2026, 1, 1),
        )
        response = self.delete(self.farmer)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("Suspend it instead", response.data["detail"])
        self.assertEqual(response.data["history"]["plants"], 1)
        # Both the account and its history must survive the refusal.
        self.assertTrue(User.objects.filter(pk=self.farmer.pk).exists())
        self.assertEqual(Plant.objects.filter(farmer=self.farmer).count(), 1)

    def test_admin_cannot_delete_their_own_account(self):
        response = self.delete(self.admin)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(User.objects.filter(pk=self.admin.pk).exists())

    def test_admin_cannot_delete_another_admin(self):
        other = make_user("admin2@example.com", UserRole.ADMIN)
        response = self.delete(other)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(User.objects.filter(pk=other.pk).exists())

    def test_admin_can_delete_an_officer_with_no_records(self):
        response = self.delete(self.officer)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(User.objects.filter(pk=self.officer.pk).exists())

    def test_farmer_cannot_delete_accounts(self):
        target = make_user("victim@example.com")
        response = self.delete(target, "farmer@example.com", FARMER_LOGIN_URL)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(User.objects.filter(pk=target.pk).exists())

    def test_officer_cannot_delete_accounts(self):
        target = make_user("victim2@example.com")
        response = self.delete(target, "officer@example.com", LGU_LOGIN_URL)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_cannot_delete_accounts(self):
        target = make_user("victim3@example.com")
        response = self.client.delete(f"/api/admin/accounts/{target.id}/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(User.objects.filter(pk=target.pk).exists())


class OfficerNotificationTests(AccountsSetupMixin, APITransactionTestCase):
    """
    Notification assertions need a real COMMIT — every notifier is queued
    with `transaction.on_commit`, matching notifications/tests.py.
    """

    def test_suspension_notifies_the_officer(self):
        self.client.patch(
            f"/api/admin/officers/{self.officer.id}/suspend/",
            **self.auth("admin@example.com"),
        )
        row = Notification.objects.filter(
            recipient=self.officer, notification_type="ACCOUNT_SUSPENDED"
        ).first()
        self.assertIsNotNone(row)
        self.assertIn("suspended", row.message.lower())

    def test_reactivation_notifies_the_officer(self):
        headers = self.auth("admin@example.com")
        self.client.patch(f"/api/admin/officers/{self.officer.id}/suspend/", **headers)
        self.client.patch(
            f"/api/admin/officers/{self.officer.id}/reactivate/", **headers
        )
        rows = Notification.objects.filter(
            recipient=self.officer, notification_type="ACCOUNT_APPROVED"
        )
        self.assertTrue(rows.exists())
        self.assertIn("reactivated", rows.first().message.lower())

    def test_farmer_reactivation_is_not_reported_as_a_first_approval(self):
        headers = self.auth("admin@example.com")
        self.client.patch(f"/api/admin/farmers/{self.farmer.id}/suspend/", **headers)
        self.client.patch(f"/api/admin/farmers/{self.farmer.id}/approve/", **headers)
        titles = set(
            Notification.objects.filter(recipient=self.farmer).values_list(
                "title", flat=True
            )
        )
        self.assertIn("Account Reactivated", titles)


class DeletionAuditTests(AccountsSetupMixin, APITransactionTestCase):
    """
    Deletion was the one destructive action leaving no trace, which made
    "who removed this account?" unanswerable. These pin the audit record.
    """

    def delete(self, user):
        return self.client.delete(
            f"/api/admin/accounts/{user.id}/", **self.auth("admin@example.com")
        )

    def test_deleting_an_account_records_an_admin_audit_notification(self):
        target = make_user("gone@example.com", status_=AccountStatus.REJECTED)
        target_id, target_email = target.id, target.email

        response = self.delete(target)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        row = Notification.objects.filter(
            recipient=self.admin, notification_type="ACCOUNT_DELETED"
        ).first()
        self.assertIsNotNone(row)
        self.assertIn(target_email, row.message)
        self.assertIn("permanently deleted", row.message)
        self.assertEqual(row.metadata["deleted_id"], target_id)
        self.assertEqual(row.metadata["deleted_role"], UserRole.FARMER)

    def test_the_audit_record_names_the_acting_admin(self):
        target = make_user("gone2@example.com", status_=AccountStatus.REJECTED)
        self.delete(target)
        row = Notification.objects.filter(
            recipient=self.admin, notification_type="ACCOUNT_DELETED"
        ).first()
        self.assertIn(self.admin.get_full_name(), row.message)

    def test_the_audit_record_survives_the_deleted_account(self):
        """
        The whole point: the row must outlive the user it describes, whose
        own notifications cascade away.
        """
        target = make_user("gone3@example.com", status_=AccountStatus.REJECTED)
        self.delete(target)

        self.assertFalse(User.objects.filter(email="gone3@example.com").exists())
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.admin, notification_type="ACCOUNT_DELETED"
            ).exists()
        )

    def test_officer_deletion_is_labelled_as_an_officer(self):
        self.delete(self.officer)
        row = Notification.objects.filter(
            recipient=self.admin, notification_type="ACCOUNT_DELETED"
        ).first()
        self.assertEqual(row.title, "LGU Officer Account Deleted")
        self.assertEqual(row.metadata["deleted_role"], UserRole.LGU_OFFICER)

    def test_a_refused_deletion_records_nothing(self):
        """A 409 must not leave an audit trail for something that never happened."""
        from datetime import date

        from plants.models import Crop, Plant

        # TransactionTestCase truncates every table between tests, including
        # the crop catalog loaded by the seed migration, so the crop this
        # test needs is created explicitly instead of looked up.
        crop, _ = Crop.objects.get_or_create(
            pk="guava",
            defaults={
                "name": "Guava",
                "category": "fruit",
                "emoji": "🌱",
                "growing_duration_days": 240,
                "harvest_window_days": 30,
                "description": "Test crop.",
            },
        )
        Plant.objects.create(
            farmer=self.farmer,
            crop=crop,
            planting_date=date(2026, 1, 1),
        )
        response = self.delete(self.farmer)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(
            Notification.objects.filter(notification_type="ACCOUNT_DELETED").exists()
        )

    def test_two_deletions_both_appear(self):
        """Reused ids must not let a stable dedupe key swallow the second."""
        first = make_user("a1@example.com", status_=AccountStatus.REJECTED)
        second = make_user("a2@example.com", status_=AccountStatus.REJECTED)
        self.delete(first)
        self.delete(second)
        self.assertEqual(
            Notification.objects.filter(
                recipient=self.admin, notification_type="ACCOUNT_DELETED"
            ).count(),
            2,
        )

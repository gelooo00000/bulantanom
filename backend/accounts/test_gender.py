"""Gender: asked (optionally) at sign-up, changeable by the user, shown to the Admin."""

from rest_framework import status
from rest_framework.test import APITestCase

from .models import AccountStatus, User, UserRole
from .tests import ADMIN_USERS_URL, ME_URL, SIGNUP_URL, VALID_SIGNUP, make_user


class GenderTests(APITestCase):
    def test_signup_saves_the_gender_given(self):
        response = self.client.post(SIGNUP_URL, {**VALID_SIGNUP, "gender": "FEMALE"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(User.objects.get(email="juan@example.com").gender, "FEMALE")

    def test_signup_without_gender_leaves_it_blank(self):
        response = self.client.post(SIGNUP_URL, VALID_SIGNUP, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(User.objects.get(email="juan@example.com").gender, "")

    def test_signup_rejects_an_unknown_gender(self):
        response = self.client.post(SIGNUP_URL, {**VALID_SIGNUP, "gender": "ROBOT"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_changes_only_their_gender(self):
        farmer = make_user("f@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        self.client.force_authenticate(farmer)
        response = self.client.patch(
            ME_URL, {"gender": "MALE", "role": "ADMIN", "first_name": "Hacked"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["gender"], "MALE")
        farmer.refresh_from_db()
        self.assertEqual(farmer.gender, "MALE")
        self.assertEqual(farmer.role, UserRole.FARMER)
        self.assertEqual(farmer.first_name, "Test")

    def test_admin_list_includes_gender(self):
        make_user("girl@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        User.objects.filter(email="girl@example.com").update(gender="FEMALE")
        admin = make_user("admin@example.com", UserRole.ADMIN, AccountStatus.APPROVED)
        self.client.force_authenticate(admin)
        rows = self.client.get(ADMIN_USERS_URL).data
        row = next(r for r in rows if r["email"] == "girl@example.com")
        self.assertEqual(row["gender"], "FEMALE")

    def test_admin_sets_a_farmers_gender(self):
        farmer = make_user("f@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        admin = make_user("admin@example.com", UserRole.ADMIN, AccountStatus.APPROVED)
        self.client.force_authenticate(admin)
        url = f"/api/admin/accounts/{farmer.pk}/gender/"
        response = self.client.patch(url, {"gender": "FEMALE"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        farmer.refresh_from_db()
        self.assertEqual(farmer.gender, "FEMALE")

    def test_only_an_admin_sets_someone_elses_gender(self):
        farmer = make_user("f@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        other = make_user("o@example.com", UserRole.FARMER, AccountStatus.APPROVED)
        self.client.force_authenticate(other)
        response = self.client.patch(
            f"/api/admin/accounts/{farmer.pk}/gender/", {"gender": "MALE"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        farmer.refresh_from_db()
        self.assertEqual(farmer.gender, "")

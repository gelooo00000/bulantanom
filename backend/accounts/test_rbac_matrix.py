"""
Whole-API RBAC matrix.

Every other test file proves one feature behaves. This one proves the access
boundary holds across the entire surface at once: each endpoint is called by
every role, and by an anonymous caller, and the outcome is asserted for all of
them rather than only for the role the endpoint was written for.

The point is the negative cases. A permission class that is simply missing
from a view is invisible to a happy-path test - the endpoint works, the right
role can use it, and nothing fails until the wrong role tries. Enumerating the
matrix is what turns that into a failing test.

Expected outcomes:
  anonymous        -> 401 (no credentials)
  wrong role       -> 403 (authenticated, not permitted)
  suspended/pending-> 403 (approved-status check, even with a valid token)
  correct role     -> anything except 401/403
"""

from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import AccountStatus, User, UserRole

PW = "MatrixPass!2345"


class RbacMatrixBase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        from plants.models import Assessment, Crop, Plant, RiskAssessment, SoilRecommendation

        def make(email, role, status_=AccountStatus.APPROVED, **kw):
            return User.objects.create_user(
                email=email, password=PW, role=role, account_status=status_, **kw
            )

        cls.farmer = make("m.farmer@example.com", UserRole.FARMER, first_name="Matrix", last_name="Farmer")
        cls.other_farmer = make("m.other@example.com", UserRole.FARMER, first_name="Other", last_name="Farmer")
        cls.lgu = make("m.lgu@example.com", UserRole.LGU_OFFICER, first_name="Matrix", last_name="Officer")
        cls.admin = make("m.admin@example.com", UserRole.ADMIN, first_name="Matrix", last_name="Admin")
        cls.suspended_farmer = make("m.susp@example.com", UserRole.FARMER, AccountStatus.SUSPENDED)
        cls.pending_farmer = make("m.pend@example.com", UserRole.FARMER, AccountStatus.PENDING)

        cls.crop = Crop.objects.create(
            id="matrix-crop", name="Matrix Crop", category="vegetable", emoji="M",
            growing_duration_days=90, harvest_window_days=14,
        )
        today = timezone.localdate()
        cls.plant = Plant.objects.create(
            farmer=cls.farmer, crop=cls.crop, label="Matrix Plot",
            planting_date=today - timedelta(days=30),
            expected_harvest_start=today + timedelta(days=60),
            expected_harvest_end=today + timedelta(days=74),
        )
        cls.other_plant = Plant.objects.create(
            farmer=cls.other_farmer, crop=cls.crop, label="Other Plot",
            planting_date=today - timedelta(days=20),
            expected_harvest_start=today + timedelta(days=70),
            expected_harvest_end=today + timedelta(days=84),
        )
        cls.assessment = Assessment.objects.create(
            plant=cls.plant, assessment_date=today, plant_age_days=30,
            growth_condition="on_track", health_condition="healthy",
            leaf_condition="normal", watering_frequency="daily",
        )
        RiskAssessment.objects.create(
            assessment=cls.assessment, risk_level="LOW", status="completed",
            summary="Healthy.",
        )
        cls.soil = SoilRecommendation.objects.create(
            farmer=cls.farmer, soil_type="loamy", soil_texture="fine",
            drainage="good", soil_moisture="moist",
        )

    LOGIN = {
        UserRole.FARMER: "/api/auth/farmer/login/",
        UserRole.LGU_OFFICER: "/api/auth/lgu/login/",
        UserRole.ADMIN: "/api/auth/admin/login/",
    }

    def auth(self, user):
        """Signs in through the role's own login route, as the app does."""
        response = self.client.post(
            self.LOGIN[user.role], {"email": user.email, "password": PW}, format="json"
        )
        self.assertEqual(
            response.status_code, status.HTTP_200_OK,
            msg=f"login failed for {user.email}: {response.status_code} {response.data}",
        )
        return {"HTTP_AUTHORIZATION": f"Bearer {response.data['access']}"}

    # -- the endpoint inventory -------------------------------------------
    # (url, role allowed to reach it). GET only: these are safe to call
    # repeatedly and the permission check runs before any handler logic, so
    # a denial is proven without mutating anything.

    def farmer_urls(self):
        return [
            "/api/farmer/plants/",
            f"/api/farmer/plants/{self.plant.pk}/",
            f"/api/farmer/plants/{self.plant.pk}/assessments/",
            f"/api/farmer/plants/{self.plant.pk}/assessments/eligibility/",
            f"/api/farmer/assessments/{self.assessment.pk}/",
            "/api/farmer/risk/",
            "/api/farmer/risk/history/",
            "/api/farmer/soil-recommendations/",
            f"/api/farmer/soil-recommendations/{self.soil.pk}/",
            "/api/farmer/soil-recommendations/latest/",
            "/api/farmer/notifications/",
            "/api/farmer/notifications/unread-count/",
        ]

    def lgu_urls(self):
        return [
            "/api/lgu/dashboard/",
            "/api/lgu/farmers/",
            f"/api/lgu/farmers/{self.farmer.pk}/",
            "/api/lgu/farm/",
            "/api/lgu/plants/",
            "/api/lgu/risk/overview/",
            "/api/lgu/risk/high-risk/",
            "/api/lgu/assessments/history/",
            "/api/lgu/soil-recommendations/",
            "/api/lgu/reports/",
            "/api/lgu/reports/agricultural-summary/",
            "/api/lgu/reports/agricultural-summary/pdf/",
            "/api/lgu/notifications/",
            "/api/lgu/notifications/unread-count/",
        ]

    def admin_urls(self):
        return [
            "/api/admin/dashboard/",
            "/api/admin/users/",
            "/api/admin/registrations/",
            "/api/admin/notifications/",
            "/api/admin/notifications/unread-count/",
        ]

    def shared_urls(self):
        """
        Reference data, not anyone's records. CropListView is IsApproved on
        purpose - the catalog is crop names and growing durations, and every
        role's UI needs it. Asserted explicitly so the choice stays deliberate
        rather than drifting into an accident.
        """
        return ["/api/farmer/crops/"]

    def all_groups(self):
        return [
            (UserRole.FARMER, self.farmer, self.farmer_urls()),
            (UserRole.LGU_OFFICER, self.lgu, self.lgu_urls()),
            (UserRole.ADMIN, self.admin, self.admin_urls()),
        ]


class AnonymousIsRejectedEverywhere(RbacMatrixBase):
    def test_no_endpoint_answers_without_credentials(self):
        for _, _, urls in self.all_groups() + [(None, None, self.shared_urls())]:
            for url in urls:
                with self.subTest(url=url):
                    self.assertEqual(
                        self.client.get(url).status_code,
                        status.HTTP_401_UNAUTHORIZED,
                        msg=f"{url} answered an anonymous caller",
                    )


class CorrectRoleIsAdmitted(RbacMatrixBase):
    def test_each_role_reaches_its_own_endpoints(self):
        for role, user, urls in self.all_groups():
            auth = self.auth(user)
            for url in urls:
                with self.subTest(role=role, url=url):
                    code = self.client.get(url, **auth).status_code
                    self.assertNotIn(
                        code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
                        msg=f"{role} was locked out of its own endpoint {url} ({code})",
                    )


class WrongRoleIsRefused(RbacMatrixBase):
    def test_no_role_reaches_another_roles_endpoints(self):
        groups = self.all_groups()
        for role, user, _ in groups:
            auth = self.auth(user)
            for other_role, _, urls in groups:
                if other_role == role:
                    continue
                for url in urls:
                    with self.subTest(caller=role, owner=other_role, url=url):
                        self.assertEqual(
                            self.client.get(url, **auth).status_code,
                            status.HTTP_403_FORBIDDEN,
                            msg=f"{role} reached {other_role} endpoint {url}",
                        )


class UnapprovedAccountsAreRefused(RbacMatrixBase):
    """
    A token issued before an account was suspended must stop working. The
    permission class re-checks account_status on every request rather than
    trusting the token, so revocation takes effect immediately.
    """

    def test_suspended_farmer_loses_access_mid_session(self):
        auth = self.auth(self.farmer)
        self.assertEqual(
            self.client.get("/api/farmer/plants/", **auth).status_code, status.HTTP_200_OK
        )

        self.farmer.account_status = AccountStatus.SUSPENDED
        self.farmer.save(update_fields=["account_status"])

        for url in self.farmer_urls():
            with self.subTest(url=url):
                self.assertEqual(
                    self.client.get(url, **auth).status_code,
                    status.HTTP_403_FORBIDDEN,
                    msg=f"suspended Farmer still reached {url}",
                )

    def test_suspended_and_pending_farmers_cannot_sign_in(self):
        for user in (self.suspended_farmer, self.pending_farmer):
            with self.subTest(email=user.email):
                response = self.client.post(
                    "/api/auth/farmer/login/",
                    {"email": user.email, "password": PW},
                    format="json",
                )
                self.assertNotEqual(
                    response.status_code, status.HTTP_200_OK,
                    msg=f"{user.account_status} account was issued a token",
                )


class FarmerDataIsolation(RbacMatrixBase):
    """
    Role alone is not enough: an approved Farmer must not read another
    approved Farmer's records. Ownership is enforced per row.
    """

    def test_a_farmer_cannot_read_another_farmers_plant(self):
        auth = self.auth(self.other_farmer)
        response = self.client.get(f"/api/farmer/plants/{self.plant.pk}/", **auth)
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
            msg="a Farmer read another Farmer's plant",
        )

    def test_a_farmer_cannot_read_another_farmers_assessment(self):
        auth = self.auth(self.other_farmer)
        response = self.client.get(f"/api/farmer/assessments/{self.assessment.pk}/", **auth)
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )

    def test_a_farmer_cannot_read_another_farmers_evidence(self):
        auth = self.auth(self.other_farmer)
        response = self.client.get(
            f"/api/farmer/assessments/{self.assessment.pk}/evidence/", **auth
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_a_farmers_plant_list_contains_only_their_own(self):
        auth = self.auth(self.other_farmer)
        rows = self.client.get("/api/farmer/plants/", **auth).data
        ids = {r["id"] for r in rows}
        self.assertIn(self.other_plant.pk, ids)
        self.assertNotIn(self.plant.pk, ids)


class AdminOnlyMutationsAreGuarded(RbacMatrixBase):
    """
    Account lifecycle actions mutate other people's access, so the negative
    case matters more than the positive one. Permission is checked before the
    handler runs, so a refusal here changes nothing.
    """

    def mutating_urls(self):
        return [
            f"/api/admin/farmers/{self.pending_farmer.pk}/approve/",
            f"/api/admin/farmers/{self.pending_farmer.pk}/reject/",
            f"/api/admin/farmers/{self.farmer.pk}/suspend/",
            f"/api/admin/officers/{self.lgu.pk}/suspend/",
            f"/api/admin/officers/{self.lgu.pk}/reactivate/",
            "/api/admin/lgu-officers/",
        ]

    def test_farmer_and_officer_cannot_run_admin_actions(self):
        for user, label in ((self.farmer, "farmer"), (self.lgu, "officer")):
            auth = self.auth(user)
            for url in self.mutating_urls():
                with self.subTest(caller=label, url=url):
                    self.assertEqual(
                        self.client.post(url, {}, format="json", **auth).status_code,
                        status.HTTP_403_FORBIDDEN,
                        msg=f"{label} reached admin action {url}",
                    )

    def test_anonymous_cannot_run_admin_actions(self):
        for url in self.mutating_urls():
            with self.subTest(url=url):
                self.assertEqual(
                    self.client.post(url, {}, format="json").status_code,
                    status.HTTP_401_UNAUTHORIZED,
                )

    def test_account_status_is_unchanged_after_refused_attempts(self):
        auth = self.auth(self.farmer)
        self.client.post(f"/api/admin/farmers/{self.pending_farmer.pk}/approve/", {}, format="json", **auth)
        self.pending_farmer.refresh_from_db()
        self.assertEqual(self.pending_farmer.account_status, AccountStatus.PENDING)


class EvidenceAccessAcrossRoles(RbacMatrixBase):
    """Officers and Admins may review evidence; a Farmer may not use their route."""

    def test_evidence_never_answers_403(self):
        """
        The route prefix is a naming convention, not the access check: both
        prefixes resolve to the same view, which authorises from the stored
        row. It answers one indistinguishable 404 for "no such row", "not
        yours" and "no photo attached", so 403 would itself be a leak - it
        would confirm the assessment exists.
        """
        for user, label in (
            (self.farmer, "owner"),
            (self.other_farmer, "another farmer"),
            (self.lgu, "officer"),
        ):
            auth = self.auth(user)
            for prefix in ("farmer", "lgu"):
                with self.subTest(caller=label, prefix=prefix):
                    code = self.client.get(
                        f"/api/{prefix}/assessments/{self.assessment.pk}/evidence/", **auth
                    ).status_code
                    self.assertNotEqual(
                        code, status.HTTP_403_FORBIDDEN,
                        msg=f"{label} got a 403, which confirms the row exists",
                    )
                    self.assertEqual(code, status.HTTP_404_NOT_FOUND)

    def test_officer_reaches_the_lgu_evidence_route(self):
        auth = self.auth(self.lgu)
        response = self.client.get(
            f"/api/lgu/assessments/{self.assessment.pk}/evidence/", **auth
        )
        # 404 because this assessment has no photo - the point is that the
        # role check passed rather than refusing at the boundary.
        self.assertNotIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )


class SharedReferenceDataIsReadableByEveryApprovedRole(RbacMatrixBase):
    """
    The crop catalog is deliberately not Farmer-private. This asserts the
    documented intent so that widening it further, or narrowing it by
    accident, both fail here.
    """

    def test_every_approved_role_can_read_the_crop_catalog(self):
        for user, label in (
            (self.farmer, "farmer"),
            (self.lgu, "officer"),
            (self.admin, "admin"),
        ):
            auth = self.auth(user)
            for url in self.shared_urls():
                with self.subTest(role=label, url=url):
                    self.assertEqual(
                        self.client.get(url, **auth).status_code, status.HTTP_200_OK
                    )

    def test_the_crop_catalog_still_needs_a_token(self):
        for url in self.shared_urls():
            with self.subTest(url=url):
                self.assertEqual(
                    self.client.get(url).status_code, status.HTTP_401_UNAUTHORIZED
                )

    def test_the_catalog_exposes_no_farmer_records(self):
        auth = self.auth(self.lgu)
        body = self.client.get("/api/farmer/crops/", **auth).content.decode()
        for secret in (self.farmer.email, self.farmer.get_full_name(), "Matrix Plot"):
            self.assertNotIn(secret, body)

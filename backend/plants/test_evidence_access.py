"""
Authorization tests for plant-evidence images.

Evidence photos were previously served from a public MEDIA_URL route, where
the random filename was the only barrier — an unauthenticated request
returned the file. These tests pin the replacement behaviour so that access
control cannot silently regress:

* the file is reachable only through an authenticated, authorizing endpoint;
* nothing in the URL is trusted — the Assessment is resolved from the
  database and every decision is made from the stored row;
* "not yours" and "does not exist" are indistinguishable to the caller.
"""

import shutil
import tempfile
from datetime import date

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import AccountStatus, User, UserRole

from .models import Assessment, Crop, Plant

FARMER_LOGIN_URL = "/api/auth/farmer/login/"
LGU_LOGIN_URL = "/api/auth/lgu/login/"
ADMIN_LOGIN_URL = "/api/auth/admin/login/"
PW = "SecurePassword123!"

# A one-pixel PNG — enough for ImageField to accept and for the view to serve.
PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
    b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def make_user(email, role=UserRole.FARMER, status_=AccountStatus.APPROVED):
    return User.objects.create_user(
        email=email, password=PW, first_name="Test", last_name="User",
        role=role, account_status=status_,
    )


class EvidenceAccessTests(APITestCase):
    """One assessment with evidence, owned by farmer A."""

    @classmethod
    def setUpClass(cls):
        # Uploads go to a throwaway directory so the real media folder is
        # never touched, and so Windows file locks on a streamed response
        # cannot fail a teardown.
        cls._media = tempfile.mkdtemp(prefix="bulantanom-test-media-")
        cls._override = override_settings(MEDIA_ROOT=cls._media)
        cls._override.enable()
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        cls._override.disable()
        shutil.rmtree(cls._media, ignore_errors=True)

    def setUp(self):
        self.owner = make_user("owner@example.com")
        self.other = make_user("other@example.com")
        self.officer = make_user("officer@example.com", UserRole.LGU_OFFICER)
        self.admin = make_user("admin@example.com", UserRole.ADMIN)

        crop = Crop.objects.first()
        self.plant = Plant.objects.create(
            farmer=self.owner, crop=crop, planting_date=date(2026, 1, 1)
        )
        self.assessment = Assessment.objects.create(
            plant=self.plant,
            plant_age_days=30,
            plant_height_cm=20,
            growth_condition="healthy",
            health_condition="healthy",
            leaf_condition="healthy",
            watering_frequency="daily",
            evidence_image=SimpleUploadedFile("e.png", PNG_BYTES, "image/png"),
        )

    def auth(self, email, url=FARMER_LOGIN_URL):
        token = self.client.post(
            url, {"email": email, "password": PW}, format="json"
        ).data["access"]
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def farmer_url(self, pk=None):
        return f"/api/farmer/assessments/{pk or self.assessment.pk}/evidence/"

    def lgu_url(self, pk=None):
        return f"/api/lgu/assessments/{pk or self.assessment.pk}/evidence/"

    # ---------------------------------------------------------------- access

    def test_unauthenticated_request_is_rejected(self):
        response = self.client.get(self.farmer_url())
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_owner_can_read_their_own_evidence(self):
        response = self.client.get(self.farmer_url(), **self.auth("owner@example.com"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "image/png")
        self.assertEqual(b"".join(response.streaming_content), PNG_BYTES)

    def test_other_farmer_cannot_read_it(self):
        response = self.client.get(self.farmer_url(), **self.auth("other@example.com"))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_officer_can_read_evidence_of_an_approved_farmer(self):
        response = self.client.get(
            self.lgu_url(), **self.auth("officer@example.com", LGU_LOGIN_URL)
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_admin_can_read_evidence(self):
        response = self.client.get(
            self.lgu_url(), **self.auth("admin@example.com", ADMIN_LOGIN_URL)
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_officer_cannot_read_evidence_of_a_non_approved_farmer(self):
        """The LGU scope is approved Farmers — suspension removes visibility."""
        self.owner.account_status = AccountStatus.SUSPENDED
        self.owner.save(update_fields=["account_status"])
        response = self.client.get(
            self.lgu_url(), **self.auth("officer@example.com", LGU_LOGIN_URL)
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_farmer_cannot_escalate_by_using_the_lgu_prefix(self):
        """The URL prefix is naming, not authorization — the row decides."""
        response = self.client.get(self.lgu_url(), **self.auth("other@example.com"))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # -------------------------------------------------------------- 404 cases

    def test_missing_assessment_returns_404(self):
        response = self.client.get(
            self.farmer_url(pk=999999), **self.auth("owner@example.com")
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_assessment_without_evidence_returns_404(self):
        bare = Assessment.objects.create(
            plant=self.plant,
            assessment_date=date(2026, 2, 2),
            plant_age_days=40,
            plant_height_cm=25,
            growth_condition="healthy",
            health_condition="healthy",
            leaf_condition="healthy",
            watering_frequency="daily",
        )
        response = self.client.get(
            self.farmer_url(pk=bare.pk), **self.auth("owner@example.com")
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_forbidden_and_missing_are_indistinguishable(self):
        """
        A wrong-owner request and a nonexistent id must return the same
        status, or the endpoint confirms that someone else's evidence exists.
        """
        headers = self.auth("other@example.com")
        forbidden = self.client.get(self.farmer_url(), **headers)
        missing = self.client.get(self.farmer_url(pk=999999), **headers)
        self.assertEqual(forbidden.status_code, missing.status_code)

    # ------------------------------------------------------------- no bypass

    def test_media_url_is_not_routed(self):
        """
        The public media route is deliberately gone. If someone re-adds a
        static() route for MEDIA_URL, this fails and explains why.
        """
        response = self.client.get(f"/media/{self.assessment.evidence_image.name}")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @override_settings(DEBUG=True)
    def test_media_url_is_not_routed_even_in_debug(self):
        """Development serving must not reopen unauthenticated access."""
        response = self.client.get(f"/media/{self.assessment.evidence_image.name}")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_response_is_not_cached_by_shared_caches(self):
        response = self.client.get(self.farmer_url(), **self.auth("owner@example.com"))
        self.assertIn("private", response["Cache-Control"])
        self.assertIn("no-store", response["Cache-Control"])

    # ------------------------------------------------------- serialized link

    def test_serializer_exposes_the_authorized_url_not_the_media_path(self):
        detail = self.client.get(
            f"/api/farmer/assessments/{self.assessment.pk}/",
            **self.auth("owner@example.com"),
        )
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        url = detail.data["evidence_image_url"]
        self.assertIn(f"/api/farmer/assessments/{self.assessment.pk}/evidence/", url)
        self.assertNotIn("/media/", url)

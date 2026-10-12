"""
Cloudinary evidence storage, with Cloudinary itself mocked: these never reach
the network. They pin what matters: photos are uploaded as private
"authenticated" assets, read back only through a server-signed URL, a lost
file is a normal FileNotFoundError, and no public link is ever handed out.
"""

from unittest.mock import MagicMock, patch

import cloudinary
from django.core.files.base import ContentFile
from django.test import SimpleTestCase, override_settings
from rest_framework import status

from .cloudinary_storage import CloudinaryEvidenceStorage
from .test_risk import GEMINI_OK, RiskTestCase, make_user, payload_with_image

NAME = "evidence/farmer_3/plant_9/abc123.jpg"


def http(status_code, content=b""):
    response = MagicMock()
    response.status_code = status_code
    response.content = content
    return response


@override_settings(CLOUDINARY_TIMEOUT_SECONDS=20)
class CloudinaryStorageTests(SimpleTestCase):
    def setUp(self):
        cloudinary.config(cloud_name="demo", api_key="key", api_secret="secret", secure=True)
        self.storage = CloudinaryEvidenceStorage()

    @patch("cloudinary.uploader.upload")
    def test_uploads_are_private_and_keep_their_name(self, upload):
        saved = self.storage.save(NAME, ContentFile(b"jpeg-bytes"))

        self.assertEqual(saved, NAME)
        kwargs = upload.call_args.kwargs
        self.assertEqual(kwargs["public_id"], "evidence/farmer_3/plant_9/abc123")
        self.assertEqual(kwargs["type"], "authenticated")
        self.assertEqual(kwargs["resource_type"], "image")
        self.assertFalse(kwargs["overwrite"])

    @patch("plants.cloudinary_storage.requests.get", return_value=http(200, b"jpeg-bytes"))
    def test_reads_through_a_signed_authenticated_url(self, get):
        with self.storage.open(NAME) as photo:
            self.assertEqual(photo.read(), b"jpeg-bytes")

        url = get.call_args.args[0]
        self.assertIn("/image/authenticated/s--", url)
        self.assertTrue(url.endswith("/evidence/farmer_3/plant_9/abc123.jpg"))
        self.assertEqual(get.call_args.kwargs["timeout"], 20)

    @patch("plants.cloudinary_storage.requests.get", return_value=http(404))
    def test_a_missing_photo_is_file_not_found(self, _get):
        with self.assertRaises(FileNotFoundError):
            self.storage.open(NAME)

    @patch("plants.cloudinary_storage.requests.get", return_value=http(401))
    def test_other_failures_are_os_errors(self, _get):
        with self.assertRaises(OSError):
            self.storage.open(NAME)

    @patch("plants.cloudinary_storage.requests.get", side_effect=__import__("requests").Timeout)
    def test_an_outage_is_an_os_error(self, _get):
        with self.assertRaises(OSError):
            self.storage.open(NAME)

    @patch("cloudinary.uploader.destroy", return_value={"result": "ok"})
    def test_delete_removes_the_private_asset(self, destroy):
        self.storage.delete(NAME)
        destroy.assert_called_once_with(
            "evidence/farmer_3/plant_9/abc123",
            resource_type="image",
            type="authenticated",
            invalidate=True,
        )

    def test_never_hands_out_a_link(self):
        self.assertEqual(self.storage.url(NAME), "")


@override_settings(
    STORAGES={
        "default": {"BACKEND": "plants.cloudinary_storage.CloudinaryEvidenceStorage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    },
    CLOUDINARY_TIMEOUT_SECONDS=20,
)
class CloudinaryAssessmentFlowTests(RiskTestCase):
    def setUp(self):
        super().setUp()
        cloudinary.config(cloud_name="demo", api_key="key", api_secret="secret", secure=True)

    @patch("plants.risk_evaluation_service.evaluate_assessment", return_value=GEMINI_OK)
    @patch("cloudinary.uploader.upload")
    def test_a_submitted_photo_goes_to_cloudinary_and_is_served_back(self, upload, _eval):
        farmer = make_user("farmer@example.com")
        auth = self.login("farmer@example.com")
        plant = self.make_plant(farmer)

        response = self.client.post(
            f"/api/farmer/plants/{plant.id}/assessments/", payload_with_image(), **auth
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(upload.call_args.kwargs["type"], "authenticated")

        with patch(
            "plants.cloudinary_storage.requests.get", return_value=http(200, b"stored-jpeg")
        ):
            photo = self.client.get(
                f"/api/farmer/assessments/{response.data['id']}/evidence/", **auth
            )
        self.assertEqual(photo.status_code, status.HTTP_200_OK)
        self.assertEqual(b"".join(photo.streaming_content), b"stored-jpeg")

    def test_a_photo_lost_before_the_move_is_a_404_not_a_crash(self):
        from django.utils import timezone

        from .models import Assessment

        farmer = make_user("farmer@example.com")
        auth = self.login("farmer@example.com")
        plant = self.make_plant(farmer)
        assessment = Assessment.objects.create(
            plant=plant,
            assessment_date=timezone.localdate(),
            plant_age_days=30,
            growth_condition="as_expected",
            health_condition="healthy",
            watering_frequency="daily",
        )
        assessment.evidence_image.name = "evidence/old-disk-photo.jpg"
        assessment.save()

        with patch("plants.cloudinary_storage.requests.get", return_value=http(404)):
            photo = self.client.get(
                f"/api/farmer/assessments/{assessment.pk}/evidence/", **auth
            )
        self.assertEqual(photo.status_code, status.HTTP_404_NOT_FOUND)

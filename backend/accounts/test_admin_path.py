"""Django Admin is served at DJANGO_ADMIN_PATH, not a hard-coded /admin/."""

from django.conf import settings
from django.test import SimpleTestCase
from django.urls import reverse


class AdminPathTests(SimpleTestCase):
    def test_admin_is_served_at_the_configured_path(self):
        self.assertEqual(reverse("admin:index"), f"/{settings.DJANGO_ADMIN_PATH}/")

    def test_the_path_has_no_slashes_of_its_own(self):
        self.assertFalse(settings.DJANGO_ADMIN_PATH.startswith("/"))
        self.assertFalse(settings.DJANGO_ADMIN_PATH.endswith("/"))

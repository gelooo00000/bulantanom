"""
Evidence photos on Cloudinary, kept private.

Used when CLOUDINARY_URL is set (see settings.STORAGES). Cloudinary's
default makes every upload a public image anyone can open by its link;
evidence photos are farmers' records, so they are stored as "authenticated"
assets instead: nothing serves them without a URL signed with the account's
API secret, and only this server holds that secret. Browsers still reach a
photo only through plants.views.AssessmentEvidenceView, which checks who is
asking and streams the bytes it reads here.

Names stay exactly what Django gives (evidence/farmer_<id>/plant_<id>/<random>.jpg,
see models.evidence_upload_path): the public id is that path without its
extension, and the extension is the delivered format.
"""

from __future__ import annotations

import logging
import os

import requests
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible

logger = logging.getLogger(__name__)

DELIVERY_TYPE = "authenticated"


def _split(name: str) -> tuple[str, str]:
    """`evidence/.../abc.jpg` -> (`evidence/.../abc`, `jpg`)."""
    public_id, ext = os.path.splitext(name.replace("\\", "/"))
    return public_id, (ext.lstrip(".").lower() or "jpg")


@deconstructible
class CloudinaryEvidenceStorage(Storage):
    def _save(self, name, content):
        import cloudinary.uploader

        public_id, _ext = _split(name)
        content.seek(0)
        cloudinary.uploader.upload(
            content,
            public_id=public_id,
            resource_type="image",
            type=DELIVERY_TYPE,
            overwrite=False,
            unique_filename=False,
            use_filename=False,
        )
        return name

    def _open(self, name, mode="rb"):
        import cloudinary.utils

        public_id, ext = _split(name)
        # Signed with the API secret, built and used only here: the link
        # never leaves the server.
        url, _options = cloudinary.utils.cloudinary_url(
            public_id,
            resource_type="image",
            type=DELIVERY_TYPE,
            format=ext,
            sign_url=True,
            secure=True,
        )
        try:
            response = requests.get(url, timeout=settings.CLOUDINARY_TIMEOUT_SECONDS)
        except requests.RequestException as exc:
            raise OSError(f"Cloudinary unreachable: {type(exc).__name__}") from exc
        if response.status_code == 404:
            raise FileNotFoundError(f"File does not exist: {name}")
        if response.status_code != 200:
            raise OSError(f"Cloudinary returned {response.status_code} for {name}")
        return ContentFile(response.content, name=name)

    def delete(self, name):
        import cloudinary.uploader

        public_id, _ext = _split(name)
        result = cloudinary.uploader.destroy(
            public_id, resource_type="image", type=DELIVERY_TYPE, invalidate=True
        )
        if result.get("result") not in ("ok", "not found"):
            logger.warning("Cloudinary could not delete %s: %s", name, result.get("result"))

    def exists(self, name):
        # Upload names carry a random part (evidence_upload_path), so they
        # never collide; asking Cloudinary would spend its admin API quota.
        return False

    def size(self, name):
        return self._open(name).size

    def url(self, name):
        # Deliberately no link: evidence is served only by the authorized
        # view. Anything that asks for a URL (the Django admin's file widget)
        # gets none rather than a shareable signed one.
        return ""

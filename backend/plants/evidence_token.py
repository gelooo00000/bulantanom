"""
Short-lived proof that a specific image already passed evidence validation.

Why this exists: the backend must never take the frontend's word that a photo
was verified, but re-running the Gemini check at submission would mean two
multimodal calls and roughly double the farmer's wait.

The token is an HMAC over (farmer id, plant id, SHA-256 of the exact image
bytes, expiry), signed with SECRET_KEY. Presenting it proves only that *this
server* validated *these exact bytes* for *this farmer and plant*, recently.
A client cannot forge one, cannot reuse another farmer's, cannot move one to
a different plant, and cannot swap in a different image afterwards.

If no valid token is presented, the caller re-validates with Gemini — the
token is an optimisation, never the security boundary.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import time

from django.conf import settings

logger = logging.getLogger(__name__)

_SEPARATOR = "."


def image_digest(image_bytes: bytes) -> str:
    return hashlib.sha256(image_bytes).hexdigest()


def _signature(payload: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()


def issue(farmer_id: int, plant_id: int, image_bytes: bytes) -> str:
    """Mint a token for an image that just passed validation."""
    expires_at = int(time.time()) + settings.EVIDENCE_TOKEN_TTL_SECONDS
    payload = f"{farmer_id}{_SEPARATOR}{plant_id}{_SEPARATOR}{image_digest(image_bytes)}{_SEPARATOR}{expires_at}"
    return f"{payload}{_SEPARATOR}{_signature(payload)}"


def verify(token: str, farmer_id: int, plant_id: int, image_bytes: bytes) -> bool:
    """
    True only if `token` is this server's signature over exactly these bytes,
    for this farmer and plant, and has not expired.
    """
    if not token or not isinstance(token, str):
        return False

    parts = token.split(_SEPARATOR)
    if len(parts) != 5:
        return False
    token_farmer, token_plant, digest, expires_at, signature = parts

    payload = _SEPARATOR.join(parts[:4])
    # Constant-time compare so a wrong token cannot be probed byte by byte.
    if not hmac.compare_digest(signature, _signature(payload)):
        return False

    try:
        if int(expires_at) < int(time.time()):
            return False
    except (TypeError, ValueError):
        return False

    return (
        token_farmer == str(farmer_id)
        and token_plant == str(plant_id)
        and hmac.compare_digest(digest, image_digest(image_bytes))
    )

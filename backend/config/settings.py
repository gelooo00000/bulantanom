"""
Django settings for the BulanTanom backend (Authentication milestone).
"""

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _env_list(name, default=""):
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


def _env_bool(name, default=False):
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = _env_bool("DJANGO_DEBUG", False)

ALLOWED_HOSTS = _env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")


# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "accounts",
    "plants",
    "notifications",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Serves collected static files in production. Must sit directly after
    # SecurityMiddleware and before everything else.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# Database
# https://docs.djangoproject.com/en/6.1/ref/settings/#databases

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": os.environ["DB_NAME"],
        "USER": os.environ["DB_USER"],
        "PASSWORD": os.environ["DB_PASSWORD"],
        "HOST": os.environ.get("DB_HOST", "localhost"),
        "PORT": os.environ.get("DB_PORT", "3306"),
        "OPTIONS": {"charset": "utf8mb4"},
    }
}


# Custom user model
AUTH_USER_MODEL = "accounts.User"


# Password validation
# https://docs.djangoproject.com/en/6.1/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# Internationalization
# https://docs.djangoproject.com/en/6.1/topics/i18n/

LANGUAGE_CODE = "en-us"

# Layuan Nature Integrated Farm is in Bulan, Sorsogon. Dates that a farmer
# experiences as "today" — assessment_date, plant age, the 7-day weekly lock —
# are DateFields derived from timezone.localdate(), so this must be local
# time. Left as UTC, the day rolled over at 08:00 Philippine time: an
# assessment submitted at 07:00 was recorded as the previous day and the
# weekly lock expired mid-morning instead of at midnight.
# Timestamps are still stored UTC-aware (USE_TZ below); only the local
# interpretation changes.
TIME_ZONE = "Asia/Manila"

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.1/howto/static-files/

STATIC_URL = "static/"

# collectstatic writes here. Without it the command fails outright, which
# leaves the Django Admin unstyled under DEBUG=False - and Admin is where
# LGU Officer accounts are provisioned, so it has to work in production.
STATIC_ROOT = BASE_DIR / "staticfiles"

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        # The manifest backend requires collectstatic to have run, so it is
        # only used where that is true. Development keeps the plain backend.
        "BACKEND": (
            "django.contrib.staticfiles.storage.StaticFilesStorage"
            if DEBUG
            else "whitenoise.storage.CompressedManifestStaticFilesStorage"
        ),
    },
}

# Uploaded plant-condition evidence. Images live on disk under MEDIA_ROOT;
# only the relative path is stored in MySQL (never the binary).
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Hard cap on evidence uploads, enforced in the serializer as well.
MAX_EVIDENCE_IMAGE_BYTES = int(os.environ.get("MAX_EVIDENCE_IMAGE_BYTES", 5 * 1024 * 1024))
ALLOWED_EVIDENCE_CONTENT_TYPES = ("image/jpeg", "image/png")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# Django REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_RENDERER_CLASSES": ("rest_framework.renderers.JSONRenderer",),
}


# SimpleJWT
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}


# CORS — restrictive allow-list, never CORS_ALLOW_ALL_ORIGINS in this config.
CORS_ALLOWED_ORIGINS = _env_list("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
CORS_ALLOW_CREDENTIALS = True


# Refresh token cookie (HttpOnly). The access token is returned in the JSON
# body only and is never persisted by the backend; the frontend keeps it in
# memory. The refresh token never reaches JavaScript.
# Gemini (Crop Intelligence). Server-side only — the key must never be
# exposed to the browser or prefixed NEXT_PUBLIC_. If GEMINI_API_KEY is
# empty the crop-intelligence service degrades gracefully and Farmers can
# still create plants (see plants/crop_intelligence_service.py).
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash").strip()
# Passed to the API as the *server-side* deadline, so a value below the
# model's real response time makes Google itself return 504 DEADLINE_EXCEEDED.
# That still consumes a request from the daily quota, so a tight timeout
# burns quota without ever producing a result. Measured round-trips on
# gemini-3.6-flash ranged from 3s to 38s for the same prompt, so this is
# sized for the slow tail rather than the median.
GEMINI_TIMEOUT_SECONDS = int(os.environ.get("GEMINI_TIMEOUT_SECONDS", "60"))
# Risk evaluation sends a photo and asks for a long structured response, so
# it legitimately takes far longer than the text-only crop-intelligence call.
GEMINI_RISK_TIMEOUT_SECONDS = int(os.environ.get("GEMINI_RISK_TIMEOUT_SECONDS", "60"))
# Evidence validation returns a much smaller payload than a risk evaluation,
# so it should not wait as long before falling back to "could not verify".
GEMINI_EVIDENCE_TIMEOUT_SECONDS = int(
    os.environ.get("GEMINI_EVIDENCE_TIMEOUT_SECONDS", "35")
)
# Soil recommendation sends the whole crop catalog and asks for six populated
# sections at once. Measured round-trips vary widely — 17s, 32s, 34s and one
# over 60s — so anything tighter fails intermittently with 504
# DEADLINE_EXCEEDED on perfectly valid input. Sized for the slow tail.
GEMINI_SOIL_TIMEOUT_SECONDS = int(os.environ.get("GEMINI_SOIL_TIMEOUT_SECONDS", "120"))

# Signed proof that an image already passed evidence validation, so submitting
# it does not pay for a second Gemini call. Bound to the exact image bytes,
# plant and farmer — see plants.evidence_token.
EVIDENCE_TOKEN_TTL_SECONDS = int(os.environ.get("EVIDENCE_TOKEN_TTL_SECONDS", "1800"))


# ---------------------------------------------------------------------------
# Email — account-lifecycle notices only (approval, rejection, suspension,
# reactivation, officer welcome). Never marketing, never login alerts.
#
# Credentials are server-side environment variables and must never be
# prefixed NEXT_PUBLIC_ or otherwise reach the browser.
#
# With no EMAIL_HOST configured the console backend is used, so development
# and CI print the message instead of needing a live SMTP account. That is a
# deliberate default: a missing credential should degrade to "visible in the
# log", never to a silent failure that looks like success.
# ---------------------------------------------------------------------------
EMAIL_HOST = os.environ.get("EMAIL_HOST", "").strip()
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "").strip()
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
# STARTTLS (port 587) and implicit SSL (port 465) are mutually exclusive —
# Django raises ImproperlyConfigured if both are on. Providers differ on which
# they require, so both are configurable here; selecting SSL switches TLS off
# rather than letting the pair fail at the first send.
EMAIL_USE_SSL = _env_bool("EMAIL_USE_SSL", False)
EMAIL_USE_TLS = False if EMAIL_USE_SSL else _env_bool("EMAIL_USE_TLS", True)
EMAIL_TIMEOUT = int(os.environ.get("EMAIL_TIMEOUT_SECONDS", "15"))

EMAIL_BACKEND = (
    "django.core.mail.backends.smtp.EmailBackend"
    if EMAIL_HOST
    else "django.core.mail.backends.console.EmailBackend"
)

DEFAULT_FROM_EMAIL = os.environ.get(
    "DEFAULT_FROM_EMAIL", "BulanTanom <no-reply@bulantanom.local>"
)

# Used to build the login link in emails. Never hardcode localhost — the
# same code has to produce a correct link in production.
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")


REFRESH_COOKIE_NAME = "bulantanom_refresh_token"
REFRESH_COOKIE_PATH = "/api/auth/"
# "Lax" is correct while the frontend and backend share a registrable domain
# (localhost, or app.example.com + api.example.com). Split hosting - say a
# *.vercel.app frontend against a *.onrender.com backend - is cross-site, and
# the browser then refuses to send this cookie at all: users would be signed
# out the moment their 15-minute access token expires. That case needs
# "None", which browsers only honour together with REFRESH_COOKIE_SECURE=True.
REFRESH_COOKIE_SAMESITE = os.environ.get("REFRESH_COOKIE_SAMESITE", "Lax").strip() or "Lax"
REFRESH_COOKIE_SECURE = _env_bool("REFRESH_COOKIE_SECURE", False)

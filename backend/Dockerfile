# BulanTanom backend (Django + gunicorn) for Railway, or any Docker host.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# mysqlclient compiles against the MySQL client library.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential default-libmysqlclient-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .

# Migrations and collectstatic run at start, not build: both need the real
# environment (database, DJANGO_SECRET_KEY), which only exists at runtime.
#
# --timeout 180: a soil recommendation waits on Gemini for up to
# GEMINI_SOIL_TIMEOUT_SECONDS (120s). gunicorn's default 30s would kill the
# worker mid-request and the farmer would get an error instead of a result.
#
# DJANGO_SUPERUSER_EMAIL/_PASSWORD/_FIRST_NAME/_LAST_NAME, when set, create
# the first Admin on boot - hosts like Render's free tier have no shell to run
# createsuperuser in. It is a no-op once that email exists.
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py collectstatic --noinput && { [ -z \"$DJANGO_SUPERUSER_EMAIL\" ] || python manage.py createsuperuser --noinput || true; } && exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers ${WEB_CONCURRENCY:-2} --timeout 180 --access-logfile -"]

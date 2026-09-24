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
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py collectstatic --noinput && exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 180 --access-logfile -"]

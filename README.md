# BulanTanom

Crop monitoring for the farmers of Layuan Nature Integrated Farm in Bulan,
Sorsogon. Farmers record plants and weekly assessments, get AI-assisted risk
and soil guidance, and LGU Officers follow the farm through dashboards and
reports. Administrators manage accounts.

- **Frontend:** Next.js and React, in `src/`
- **Backend:** Django REST Framework, in `backend/`
- **AI:** Gemini, called only from the backend

Live at <https://bulantanom.onrender.com>, with the API at
<https://bulantanom-api.onrender.com>.

## Run it locally

The backend needs a MySQL 8 database named `bulantanom`.

```bash
# Backend, on port 8000
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
cp .env.example .env              # then fill it in
.venv/Scripts/python manage.py migrate
.venv/Scripts/python manage.py createcachetable
.venv/Scripts/python manage.py runserver 8000

# Frontend, on port 3000
npm ci
npm run dev
```

## Check your work

```bash
npm run lint
npm test
npx tsc --noEmit

cd backend
.venv/Scripts/python manage.py test
```

If `tsc` reports files under `.next/` that no longer exist, delete `.next`.
GitHub Actions runs all of this on every push, with the backend on Postgres
because production uses it.

## Deployment

Pushing to `main` redeploys both services on Render, as described in
`render.yaml`. The database is a Neon Postgres.

- New `sync: false` variables must be added by hand in Render's Environment
  page before deploying. A Blueprint sync does not prompt for them.
- Evidence photos are stored privately on Cloudinary through `CLOUDINARY_URL`.
- Email goes through Brevo on port 2525, because Render's free plan blocks
  the usual SMTP ports. Farmer sign-up and password reset depend on it.
- `manage.py axes_reset` clears a Django Admin lockout.

Scheduled work runs from `.github/workflows/`:

| Workflow | When (Manila) | Does |
|---|---|---|
| `daily-jobs.yml` | 06:00 | Harvest notifications and retrying failed emails |
| `keep-warm.yml` | Every 14 minutes, 06:00 to 16:59 | Keeps the API awake while farmers work |

`daily-jobs.yml` needs `DAILY_JOBS_SECRET` set to the same value in GitHub's
repository secrets and on `bulantanom-api` in Render. GitHub pauses scheduled
workflows after 60 days without repository activity.

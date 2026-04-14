# ArcHive

Spatial document management for pipeline construction. Attach files to GPS-precise chainage pins on a satellite map, with role-based access control.

Built as a prototype for an Enbridge VP demo.

---

## Stack

| Layer | Technology |
|---|---|
| Database | PostgreSQL 16 + PostGIS 3.4 |
| ORM / Migrations | SQLAlchemy 2.0 + GeoAlchemy2 + Alembic |
| API | FastAPI |
| Auth | python-jose (JWT) + bcrypt |
| Object Storage | Ionos S3 (boto3 — same API as AWS S3) |
| Map | MapLibre GL JS (CDN) + MapTiler satellite tiles |
| Frontend | Plain HTML + JS (no framework) |
| Dev Infra | Docker Compose |

---

## Project Structure

```
archive-base/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, router registration
│   │   ├── config.py            # pydantic-settings — reads .env
│   │   ├── database.py          # SQLAlchemy engine + session
│   │   ├── models/              # User, Pipeline, ChainagePin, Document, PipelineAccess
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── routers/             # auth, pipelines, pins, documents
│   │   ├── services/            # auth (JWT/bcrypt), storage (S3)
│   │   └── dependencies/        # get_db, get_current_user, require_role
│   ├── alembic/                 # Migrations
│   ├── alembic.ini
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── index.html               # Login page
│   ├── map.html                 # Satellite map + document panel
│   ├── js/
│   │   ├── api.js               # All fetch() calls — centralized
│   │   ├── auth.js              # Login flow
│   │   └── map.js               # MapLibre, pins, RBAC gating
│   └── css/style.css
├── scripts/
│   └── seed.py                  # Seed demo pipeline + users
├── docker-compose.yml
└── .env                         # Never commit — see setup below
```

---

## Quick Start

### 1. Prerequisites

- Docker Desktop
- A [MapTiler](https://maptiler.com) account (free tier works)
- An Ionos S3 bucket (or any S3-compatible storage)

### 2. Configure `.env`

Copy the example and fill in your keys:

```bash
cp .env .env.local  # keep a backup
```

Edit `.env`:

```env
# Database (leave as-is for local Docker)
DATABASE_URL=postgresql://archive:localdev@db:5432/archive

# JWT — change this to a long random string in any real deployment
SECRET_KEY=your-super-secret-key-change-in-prod-make-it-long
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Ionos S3 — get from your Ionos dashboard → Object Storage → Access Keys
S3_ENDPOINT_URL=https://s3-eu-central-1.ionoscloud.com
S3_ACCESS_KEY=your-ionos-access-key
S3_SECRET_KEY=your-ionos-secret-key
S3_BUCKET_NAME=archive-docs

# MapTiler — get from maptiler.com/account/keys (free tier)
MAPTILER_API_KEY=your-maptiler-key
```

### 3. Set your MapTiler key in the frontend

Open `frontend/js/map.js` and replace the placeholder on line 34:

```js
const MAPTILER_KEY = "your-maptiler-key-here";
```

### 4. Start the stack

```bash
docker compose up
```

This starts three services:
- `db` — PostgreSQL + PostGIS on port 5432
- `api` — FastAPI on port 8000 (hot reload enabled)
- `frontend` — nginx serving static files on port 3000

### 5. Run migrations

```bash
docker compose run --rm api alembic upgrade head
```

### 6. Seed demo data

```bash
docker compose run --rm api python /scripts/seed.py
```

This creates:
- **3 demo users** (see credentials below)
- **1 pipeline** — "Line 3 Replacement — Segment AB-07" through central Alberta
- **21 chainage pins** in KP notation (KP 42+000 → KP 52+000)
- Pipeline access grants for all three users

---

## Demo Credentials

| Email | Password | Role |
|---|---|---|
| `admin@enbridge.com` | `admin123` | admin — full access, user management |
| `editor@enbridge.com` | `editor123` | editor — can upload documents |
| `viewer@enbridge.com` | `viewer123` | viewer — read-only, upload button hidden |

Login at **http://localhost:3000**

API docs at **http://localhost:8000/docs**

---

## Demo Flow (3 minutes)

1. Log in as `admin@enbridge.com`
2. Pan to the amber pipeline route on the satellite map
3. Click any **KP pin** → side panel opens
4. View attached documents → click **Download** → file opens
5. Upload a new document via the drag-drop zone → appears immediately
6. Sign out → log in as `viewer@enbridge.com`
7. Upload button is gone — RBAC is live

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create a new user |
| POST | `/auth/login` | Login — returns JWT |
| GET | `/auth/me` | Current user info |
| GET | `/pipelines/` | List accessible pipelines |
| GET | `/pipelines/{id}/geojson` | Pipeline route as GeoJSON Feature |
| GET | `/pipelines/{id}/pins` | All pins as GeoJSON FeatureCollection |
| GET | `/pins/{id}/documents` | List documents attached to a pin |
| POST | `/pins/{id}/documents` | Upload a document to a pin |
| GET | `/documents/{id}/download` | Get presigned download URL |
| GET | `/health` | Health check |

All endpoints except `/auth/login`, `/auth/register`, and `/health` require a `Bearer` token.

---

## RBAC

Roles are set per user: `admin`, `editor`, `viewer`.

| Action | viewer | editor | admin |
|---|---|---|---|
| View map + pins | ✅ | ✅ | ✅ |
| Download documents | ✅ | ✅ | ✅ |
| Upload documents | ❌ | ✅ | ✅ |
| Register new users | ❌ | ❌ | ✅ |

---

## Development

### Hot reload

The `backend/` directory is volume-mounted into the api container. Any change to Python files restarts the server automatically.

### Adding a migration

After changing any model:

```bash
docker compose run --rm api alembic revision --autogenerate -m "describe the change"
docker compose run --rm api alembic upgrade head
```

Never edit the database directly — always go through Alembic.

### Re-seeding

```bash
# Drop and recreate the DB volume (loses all data)
docker compose down -v
docker compose up -d
docker compose run --rm api alembic upgrade head
docker compose run --rm api python /scripts/seed.py
```

---

## Deployment Notes

- Set `SECRET_KEY` to a long random value (e.g. `openssl rand -hex 32`)
- Tighten `allow_origins` in `backend/app/main.py` to your actual domain
- Documents are never publicly accessible — all downloads go through presigned S3 URLs (1-hour expiry by default)
- `.env` is in `.gitignore` — never commit it

---

## Out of Scope (Phase 2)

- ML / anomaly detection layer
- Offline sync
- IoT sensor data
- Mobile app

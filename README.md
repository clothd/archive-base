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

## AWS S3 Setup

### 1. Create an IAM user with S3 access

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam) → **Users → Create user**
2. Name it something like `archive-app`
3. On the **Permissions** step, choose **Attach policies directly**
4. Attach **AmazonS3FullAccess** (or create a scoped policy — see below)
5. After creation, go to the user → **Security credentials → Access keys → Create access key**
6. Choose **Application running outside AWS**, click through, copy both the **Access Key ID** and **Secret Access Key** — the secret is only shown once

**Scoped IAM policy (recommended over FullAccess):**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME"
    }
  ]
}
```

### 2. Bucket configuration

- **Block all public access** — leave this ON (the default). Documents are served via short-lived **presigned URLs**, never public links.
- **Region** — note which region you created the bucket in (e.g. `us-east-2`) and put it in `S3_REGION` in your `.env`.

### 3. Set the bucket CORS policy

Required so presigned download URLs open correctly in the browser.

In the AWS Console: **S3 → Your Bucket → Permissions → CORS → Edit**

Paste this JSON:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

> For production, replace `"*"` in `AllowedOrigins` with your actual domain (e.g. `"https://yourdomain.com"`).

### 4. Note on `s3_endpoint_url`

Leave `S3_ENDPOINT_URL` out of your `.env` entirely for AWS — boto3 resolves the endpoint automatically from the region. The field is only needed for non-AWS S3-compatible providers (Ionos, MinIO, etc.).

---

## Quick Start

### 1. Prerequisites

- Docker Desktop
- A [MapTiler](https://maptiler.com) account (free tier works)
- An Ionos S3 bucket (see setup above)

### 2. Configure `.env`

Edit `.env` at the project root — never commit this file:

```env
# Database (leave as-is for local Docker)
DATABASE_URL=postgresql://archive:localdev@db:5432/archive

# JWT — change this to a long random string in any real deployment
SECRET_KEY=your-super-secret-key-change-in-prod-make-it-long
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# AWS S3 — IAM → Users → your user → Security credentials → Access keys
S3_ACCESS_KEY=your-aws-access-key-id
S3_SECRET_KEY=your-aws-secret-access-key
S3_BUCKET_NAME=your-bucket-name
S3_REGION=us-east-2

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

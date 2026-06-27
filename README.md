# E-Learning Forestry

> ระบบ e-learning ภายในสำหรับการฝึกอบรมด้านการควบคุมไฟป่าและงานป่าไม้ — กรมป่าไม้ (Royal Forest Department, Thailand)

A learning-management platform for internal staff training on wildfire control and forestry.
It is a single-page React application served by nginx, backed by a FastAPI service and a
PostgreSQL database, deployed behind a Traefik reverse proxy with Docker Compose.

The production deployment lives under a path prefix at **`/elearning`** (e.g.
`https://wildfire.forest.go.th/elearning/`) and is an internal, `noindex` system — it is not
meant to be indexed by search engines.

---

## Features

- **Courses → Modules → Lessons** content hierarchy with enrollment and ordering.
- **Video & PDF lessons** — video lessons support captions (`.vtt`) and transcripts for
  accessibility; PDF lessons are streamed from the API.
- **Automatic PDF splitting** — upload a large PDF and have it split into modules and lessons
  from its table of contents (bookmarks), with a configurable depth cap and adaptive
  depth-reduction so deeply-nested manuals don't explode into hundreds of tiny lessons.
  Large files upload in chunks to avoid reverse-proxy size limits.
- **Progress tracking** — per-lesson completion, including PDF read-through tracking.
- **Quizzes** — delivery and server-side grading.
- **Certificates** — generated as PDFs (WeasyPrint) with a QR code that links to a public,
  rate-limited certificate-verification page.
- **Bookmarks, lesson notes, and course feedback.**
- **Admin tools** — course editor, module editor, PDF-split panel, dashboard stats, and an
  audit log.
- **Role-based access** — learner / instructor / admin, with JWT cookie authentication.
- **Accessibility-minded UI** (WCAG-oriented) and a Trusted-Types content-security policy.

## Tech stack

| Layer        | Technologies |
|--------------|--------------|
| Frontend     | React 19, Vite, React Router 7, Tailwind CSS 3, Radix UI, React Hook Form + Zod, axios |
| Backend      | FastAPI, SQLAlchemy 2, Pydantic 2, Alembic, PyJWT, bcrypt, pypdf, WeasyPrint, qrcode |
| Database     | PostgreSQL |
| Runtime      | gunicorn + Uvicorn workers (API), nginx (SPA) |
| Infra        | Docker / Docker Compose, Traefik (TLS via Let's Encrypt) |

## Project structure

```
elearning-forestry/
├── backend/                 # FastAPI + SQLAlchemy + PostgreSQL API
│   ├── app/
│   │   ├── main.py          # App factory, middleware, CORS, security headers
│   │   ├── config.py        # Pydantic settings (env-driven)
│   │   ├── database.py
│   │   ├── core/            # Security (JWT, password hashing), helpers
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── routers/         # API endpoints (auth, courses, lessons, quizzes, ...)
│   │   └── services/        # Business logic (certificates, progress, quizzes, stats)
│   ├── alembic/             # Database migrations
│   ├── tests/               # pytest suite
│   ├── seed_admin.py        # Create the first admin account
│   └── seed_course.py       # Seed a sample course
├── frontend/                # React 19 + Vite SPA (Tailwind + Radix UI)
│   └── src/
│       ├── pages/           # Route-level pages
│       ├── components/      # UI + feature components (admin, course-edit, ...)
│       ├── contexts/        # AuthContext and others
│       ├── api/             # axios client + endpoint wrappers
│       ├── App.jsx          # Router + route guards
│       └── main.jsx
├── Dockerfile.backend       # gunicorn + Uvicorn worker image
├── Dockerfile.frontend      # Builds the SPA and serves it with nginx
├── nginx-frontend.conf      # SPA nginx config (SPA fallback, upload size)
├── docker-compose.yml       # (git-ignored) services + Traefik labels; holds real secrets
└── .env.example             # Template for backend environment variables
```

## Getting started (local development)

### Prerequisites

- Python 3.13+
- Node.js 20+
- PostgreSQL 14+ (a database named `elearning_forestry`)

### 1. Backend

```bash
cd backend
python -m venv venv
# Windows: .\venv\Scripts\activate     macOS/Linux: source venv/bin/activate
pip install -r requirements.txt

# Configure environment: copy the template to .env and fill in real values
copy ..\.env.example .env          # PowerShell / cmd
# cp ../.env.example .env           # macOS/Linux

# Apply database migrations, then create an admin user
alembic upgrade head
python seed_admin.py               # prints a one-time password if ADMIN_PASSWORD is unset

# Run the API (Swagger at http://localhost:8000/docs)
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                        # Vite dev server at http://localhost:5173
```

The dev server origin (`http://localhost:5173`) is already allowed by the backend's default
CORS configuration.

### Running tests

```bash
# Backend
cd backend && pytest

# Frontend lint
cd frontend && npm run lint
```

## Configuration

Backend configuration is environment-driven (see `.env.example`). Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL DSN, e.g. `postgresql+psycopg://user:pass@host:5432/elearning_forestry` |
| `SECRET_KEY` | Secret used to sign JWTs — use a long random value |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Session lifetime (default 480) |
| `COOKIE_SECURE` | `True` in production (HTTPS); `False` for local HTTP dev |
| `PUBLIC_BASE_URL` | Public origin used in absolute URLs (e.g. the certificate-verify QR link) |

Upload limits, the PDF auto-split depth (`SPLIT_MAX_DEPTH`) and the adaptive section cap
(`SPLIT_MAX_SECTIONS`), and the certificate-verify rate limit are all defined with sensible
defaults in `backend/app/config.py` and can be overridden via environment variables.

> **Secrets are never committed.** `docker-compose.yml` and `.env` are git-ignored. Keep real
> database passwords and `SECRET_KEY` values only in the deployment host's local copies.

## Deployment

Production runs with Docker Compose behind an existing Traefik instance:

```bash
docker compose up -d --build
```

- The **backend** image runs gunicorn with Uvicorn workers and serves the API plus the
  uploaded media (PDFs, videos, images) mounted as volumes.
- The **frontend** image builds the SPA and serves it with nginx.
- **Traefik labels** in `docker-compose.yml` route `Host(...) && PathPrefix('/elearning')` to
  the frontend and `/elearning/api`, `/elearning/docs`, and the media paths to the backend
  (with the `/elearning` prefix stripped), terminate TLS via Let's Encrypt, and attach to the
  shared external `wildfire_default` network.

Provide production values through the host's `.env` / Compose environment — never commit them.

## License

Internal project of the Royal Forest Department (กรมป่าไม้). All rights reserved.

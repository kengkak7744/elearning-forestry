from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.routers import auth, users, courses, modules, lessons, progress, quizzes, files, admin_stats, certificates, search, audit, feedback
from app.config import settings
import os

# In prod (COOKIE_SECURE=True), suppress the auto-generated Swagger UI, ReDoc,
# and openapi.json so the full API surface isn't a public attack reconnaissance
# document. Dev keeps them for convenience.
_PROD = settings.COOKIE_SECURE
app = FastAPI(
    title="ระบบ e-Learning กรมป่าไม้",
    description="API สำหรับระบบการเรียนรู้ออนไลน์ของเจ้าหน้าที่กรมป่าไม้",
    version="1.0.0",
    docs_url=None if _PROD else "/docs",
    redoc_url=None if _PROD else "/redoc",
    openapi_url=None if _PROD else "/openapi.json",
)

#React
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compress JSON/text responses ≥ 1 KB. Already-compressed bytes (video/pdf/images) are skipped automatically.
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Content-Security-Policy: defense-in-depth against XSS even though React escapes
# by default. Allows: self, inline styles (Tailwind generated), Sarabun via Google
# Fonts, YouTube embeds for the course viewer. PDFs are served same-origin so
# they fall under 'self'. Tighten further by hashing inline <script>s if you
# ever introduce any — currently the build emits none.
CSP_VALUE = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com; "
    "img-src 'self' data: blob:; "
    "media-src 'self' blob:; "
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; "
    "connect-src 'self'; "
    "object-src 'none'; "
    "base-uri 'self'; "
    "form-action 'self'; "
    "frame-ancestors 'self'"
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    # SAMEORIGIN — not DENY — because the course viewer embeds its own PDFs via <iframe>.
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy",
        "geolocation=(), microphone=(), camera=(), payment=(), usb=()",
    )
    response.headers.setdefault("Content-Security-Policy", CSP_VALUE)
    if settings.COOKIE_SECURE:
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains",
        )
    return response

os.makedirs("/app/videos", exist_ok=True)
os.makedirs("/app/pdf_documents", exist_ok=True)
os.makedirs("/app/images", exist_ok=True)
os.makedirs("/app/certificates", exist_ok=True)

# รวม routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(courses.router)
app.include_router(modules.router)
app.include_router(lessons.router)
app.include_router(progress.router, prefix="/api/progress", tags=["progress"])
app.include_router(quizzes.router, prefix="/api/quizzes", tags=["quizzes"])
app.include_router(files.router)
app.include_router(admin_stats.router)
app.include_router(certificates.router)
app.include_router(search.router)
app.include_router(audit.router)
app.include_router(feedback.router)

@app.get("/")
def read_root():
    info = {"message": "ระบบ e-Learning กรมป่าไม้", "status": "online"}
    if not _PROD:
        info["docs"] = "/docs"
    return info


@app.get("/health")
def health_check():
    return {"status": "healthy"}
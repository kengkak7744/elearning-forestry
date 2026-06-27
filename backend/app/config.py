from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    # Set true in prod (HTTPS). Leave false for local HTTP dev so the browser keeps the cookie.
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"
    CORS_ALLOWED_ORIGINS: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://localhost:3000",
        ]
    )
    # Report-only first: Trusted Types can surface DOM-XSS sinks without
    # breaking production while we verify all frontend code paths.
    TRUSTED_TYPES_REPORT_ONLY: bool = True
    # Public origin for absolute URLs (e.g. the QR code in certificate PDFs that
    # links to /verify). Empty → QR encodes the certificate number alone. Set in
    # .env in production, e.g. "https://forestry.example.go.th".
    PUBLIC_BASE_URL: str = ""

    # Media storage. Defaults match the docker-compose volume mounts; override
    # via env for local development or tests.
    VIDEO_DIR: str = "/app/videos"
    PDF_DIR: str = "/app/pdf_documents"
    IMAGE_DIR: str = "/app/images"
    CERT_DIR: str = "/app/certificates"
    SIGNATURE_DIR: str = "/app/images/signatures"

    # Upload size limits (bytes)
    MAX_IMAGE_SIZE: int = 10 * 1024 * 1024      # 10 MB
    MAX_VIDEO_SIZE: int = 2000 * 1024 * 1024    # 2 GB
    MAX_PDF_SIZE: int = 500 * 1024 * 1024       # 500 MB
    # Auto-split (PDF → lessons/modules by table of contents) re-parses and
    # re-writes the whole file, so it's heavier than a plain upload — capped a
    # bit lower than MAX_PDF_SIZE.
    MAX_SPLIT_PDF_SIZE: int = 400 * 1024 * 1024  # 400 MB
    # Browser uploads for the splitter can be sent in multiple small requests
    # to avoid reverse-proxy 413 responses on very large manuals.
    SPLIT_PDF_UPLOAD_CHUNK_SIZE: int = 4 * 1024 * 1024  # 4 MB
    # TOC depth the auto-split cuts at: level 1 = top headings (→ modules),
    # level 2 = sub-headings (→ lessons). Deeper bookmarks fold into the nearest
    # ancestor; the cap stops a deeply nested TOC exploding into tiny lessons.
    # Set 0 to disable.
    SPLIT_MAX_DEPTH: int = 2
    # Adaptive depth: if SPLIT_MAX_DEPTH yields more than this many sections, the
    # splitter retries one level shallower (down to one) and keeps the deepest
    # result within the limit — rescues PDFs that bookmark every sub-bullet from
    # exploding into hundreds of tiny lessons. Set 0 to disable.
    SPLIT_MAX_SECTIONS: int = 50
    SIGNATURE_MAX_BYTES: int = 2 * 1024 * 1024  # 2 MB — signatures are small line art

    # Public certificate-verify endpoint rate limit (per IP, per window)
    VERIFY_RATE_LIMIT: int = 30   # requests per window
    VERIFY_RATE_WINDOW: int = 60  # seconds

    @field_validator("CORS_ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> Any:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("COOKIE_SAMESITE")
    @classmethod
    def validate_cookie_samesite(cls, value: str) -> str:
        normalized = value.lower()
        if normalized not in {"lax", "strict", "none"}:
            raise ValueError("COOKIE_SAMESITE must be one of: lax, strict, none")
        return normalized


settings = Settings()

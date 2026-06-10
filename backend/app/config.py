from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    # Set true in prod (HTTPS). Leave false for local HTTP dev so the browser keeps the cookie.
    COOKIE_SECURE: bool = False
    # Public-facing origin used when generating absolute URLs (e.g. the QR code
    # embedded in certificate PDFs that links to the public /verify page).
    # Empty string → QR encodes the certificate number alone, which the
    # recipient types into the verify page manually. Set this in .env once a
    # production domain is in place, e.g. "https://forestry.example.go.th".
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
    SIGNATURE_MAX_BYTES: int = 2 * 1024 * 1024  # 2 MB — signatures are small line art

    # Public certificate-verify endpoint rate limit (per IP, per window)
    VERIFY_RATE_LIMIT: int = 30   # requests per window
    VERIFY_RATE_WINDOW: int = 60  # seconds


settings = Settings()
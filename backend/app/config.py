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


settings = Settings()
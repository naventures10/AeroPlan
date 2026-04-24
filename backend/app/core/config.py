"""
Centralised application settings.

All environment variables are loaded once via pydantic-settings.
Other modules import the singleton `settings` instance.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── PostgreSQL ───────────────────────────────────────────────────────
    DATABASE_URL: str | None = None
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "aeronautical_information_system"

    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # ── MinIO / S3 ───────────────────────────────────────────────────────
    MINIO_ENDPOINT: str = "http://localhost:9000"
    MINIO_ACCESS_KEY: str
    MINIO_SECRET_KEY: str

    # ── Dev / Debug ────────────────────────────────────────────────────
    DEBUG: bool = False

    # ── Security ─────────────────────────────────────────────────────
    SSL_VERIFY: bool = True

    # ── Weather Pipeline ──────────────────────────────────────────────
    # Path to the frontend public folder where assets are served
    WEATHER_OUTPUT_DIR: str = "/Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/frontend/public/weather"
    # Base URL relative to the domain
    WEATHER_BASE_URL: str = "/weather"
    # Absolute path to GDAL on macOS
    GDAL_CMD: str = "/opt/homebrew/bin/gdal_translate"
    # Number of historical runs to keep
    WEATHER_KEEP_RUNS: int = 4


settings = Settings()

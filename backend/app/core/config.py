"""
Centralised application settings.

All environment variables are loaded once via pydantic-settings.
Other modules import the singleton `settings` instance.
"""

from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base directory for the project
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── PostgreSQL ───────────────────────────────────────────────────────
    DATABASE_URL: str | None = None
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str | None = None
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "aeronautical_information_system"

    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        if not self.POSTGRES_PASSWORD:
            raise ValueError("POSTGRES_PASSWORD is required when DATABASE_URL is not set.")
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # ── Storage (Local / GCS FUSE) ───────────────────────────────────────
    STORAGE_PATH: str = "./data"

    # ── Redis ──────────────────────────────────────────────────────────
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    @property
    def redis_url(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # ── Dev / Debug ────────────────────────────────────────────────────
    DEBUG: bool = False
    ENVIRONMENT: str = "local"
    SSL_VERIFY: bool = True

    # ── Rate Limiting ────────────────────────────────────────────────
    RATE_LIMIT_DEFAULT: str = "100/minute"

    @field_validator("RATE_LIMIT_DEFAULT")
    @classmethod
    def validate_rate_limit(cls, v: str) -> str:
        # Avoid vulture unused variable warning
        _ = cls
        from limits import parse

        try:
            parse(v)
        except Exception as exc:
            raise ValueError(f"Invalid rate limit format: {v}") from exc
        return v


settings = Settings()

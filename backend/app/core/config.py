"""
Centralised application settings.

All environment variables are loaded once via pydantic-settings.
Other modules import the singleton `settings` instance.
"""

import logging
from pathlib import Path

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

    # ── Storage (Local / GCS FUSE) ───────────────────────────────────────
    STORAGE_PATH: str = "./data"

    # ── Dev / Debug ────────────────────────────────────────────────────
    DEBUG: bool = False
    ENVIRONMENT: str = "local"

    # ── Security ─────────────────────────────────────────────────────
    SECRET_KEY: str = "eAIP-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    SSL_VERIFY: bool = True


settings = Settings()

if settings.SECRET_KEY == "eAIP-super-secret-key-change-in-production":
    logging.warning(
        "WARNING: Using default SECRET_KEY. This is insecure and must be changed in production!"
    )

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-driven application configuration.

    Values are read from the process environment / .env file. No secrets
    are hardcoded here, and nothing in this module is exposed to the
    frontend — the frontend only ever talks to NEXT_PUBLIC_API_URL.
    """

    model_config = SettingsConfigDict(env_file=".env", env_prefix="STACKSPEAK_", extra="ignore")

    app_name: str = "StackSpeak API"
    environment: str = "development"
    cors_origins: list[str] = ["http://localhost:3000"]
    database_url: str | None = None
    # Render auto-injects this (unprefixed) into every service's environment, letting
    # a plain `curl /api/health` confirm which commit is actually deployed.
    git_commit: str | None = Field(default=None, validation_alias="RENDER_GIT_COMMIT")


@lru_cache
def get_settings() -> Settings:
    return Settings()

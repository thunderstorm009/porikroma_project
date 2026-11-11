import os
from functools import lru_cache
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    DATABASE_URL: str = Field(
        default="postgres://postgres@localhost:5432/porikroma",
        description="PostgreSQL database connection URL",
    )
    JWT_SECRET: str = Field(
        default="replace-with-a-long-random-secret-for-jwt-signing",
        description="Secret key for signing and verifying JWT tokens",
    )
    PORT: int = Field(
        default=4000,
        description="Server port to listen on",
    )
    CORS_ORIGINS: str = Field(
        default="*",
        description="Allowed CORS origins (comma-separated list of origins or '*' for all)",
    )
    GEMINI_API_KEY: str = Field(
        default="",
        description="Google Gemini API key",
    )
    GEMINI_MODEL: str = Field(
        default="gemini-2.5-flash",
        description="Google Gemini model identifier",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS_ORIGINS string into a list of origins."""
        if not self.CORS_ORIGINS or self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def allow_all_origins(self) -> bool:
        """Check if all origins are permitted."""
        return self.CORS_ORIGINS.strip() == "*"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

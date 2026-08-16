from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    redis_url: str
    backend_internal_url: str
    internal_api_secret: str
    gemini_api_key: str
    embedding_model_version: str
    max_file_size_bytes: int = 1_048_576
    clone_timeout_seconds: int = 120


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]

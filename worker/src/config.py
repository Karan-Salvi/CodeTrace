from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    redis_url: str
    backend_internal_url: str
    internal_api_secret: str
    gemini_api_key: str
    # Optional comma-separated additional keys — round-robining across
    # several free-tier keys spreads embedding calls over several
    # independent per-minute quotas instead of hammering one (see
    # embedder.py's 429s indexing a 104-file repo on a single key).
    gemini_api_keys_extra: str = ""
    embedding_model_version: str
    max_file_size_bytes: int = 1_048_576
    clone_timeout_seconds: int = 120

    @property
    def gemini_api_key_pool(self) -> list[str]:
        extra = [k.strip() for k in self.gemini_api_keys_extra.split(",") if k.strip()]
        pool = [self.gemini_api_key, *extra]
        # dedupe, keep order
        return list(dict.fromkeys(pool))


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]

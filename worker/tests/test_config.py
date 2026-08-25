import pytest
from pytest import MonkeyPatch

from src.config import get_settings


def test_settings_load_from_env(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost:5433/db")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6380")
    monkeypatch.setenv("BACKEND_INTERNAL_URL", "http://localhost:3000")
    monkeypatch.setenv("INTERNAL_API_SECRET", "test-secret")
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("EMBEDDING_MODEL_VERSION", "gemini-embedding-001-1536")
    monkeypatch.setenv("MAX_FILE_SIZE_BYTES", "1048576")
    monkeypatch.setenv("CLONE_TIMEOUT_SECONDS", "120")

    get_settings.cache_clear()
    settings = get_settings()

    assert settings.database_url == "postgresql://u:p@localhost:5433/db"
    assert settings.embedding_model_version == "gemini-embedding-001-1536"
    assert settings.max_file_size_bytes == 1048576

def test_gemini_api_key_pool_dedupes_and_preserves_order(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost:5433/db")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6380")
    monkeypatch.setenv("BACKEND_INTERNAL_URL", "http://localhost:3000")
    monkeypatch.setenv("INTERNAL_API_SECRET", "test-secret")
    monkeypatch.setenv("GEMINI_API_KEY", "key-a")
    monkeypatch.setenv("GEMINI_API_KEYS_EXTRA", " key-b,key-a, key-c ,")
    monkeypatch.setenv("EMBEDDING_MODEL_VERSION", "gemini-embedding-001-1536")

    get_settings.cache_clear()
    settings = get_settings()

    assert settings.gemini_api_key_pool == ["key-a", "key-b", "key-c"]


def test_gemini_api_key_pool_defaults_to_single_key(monkeypatch: MonkeyPatch) -> None:
    # env_file=".env" (src/config.py) is a separate pydantic-settings source
    # from os.environ — delenv() only removes the var from os.environ, so a
    # real GEMINI_API_KEYS_EXTRA in a developer's worker/.env still leaks in
    # through the dotenv source and this assertion fails locally even though
    # CI (no worker/.env checked out) passes. Disable the file source
    # entirely, same pattern as test_settings_raises_on_missing_required_var
    # below, so this test is isolated from whatever .env happens to exist.
    monkeypatch.setattr("src.config.Settings.model_config", {"env_file": None, "extra": "ignore"})
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost:5433/db")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6380")
    monkeypatch.setenv("BACKEND_INTERNAL_URL", "http://localhost:3000")
    monkeypatch.setenv("INTERNAL_API_SECRET", "test-secret")
    monkeypatch.setenv("GEMINI_API_KEY", "only-key")
    monkeypatch.delenv("GEMINI_API_KEYS_EXTRA", raising=False)
    monkeypatch.setenv("EMBEDDING_MODEL_VERSION", "gemini-embedding-001-1536")

    get_settings.cache_clear()
    settings = get_settings()

    assert settings.gemini_api_key_pool == ["only-key"]


def test_settings_raises_on_missing_required_var(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setattr("src.config.Settings.model_config", {"env_file": None, "extra": "ignore"})
    get_settings.cache_clear()
    with pytest.raises(Exception):  # noqa: B017
        get_settings()

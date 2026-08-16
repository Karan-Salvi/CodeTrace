import httpx
import pytest

from src.github.token_client import fetch_installation_token


@pytest.mark.asyncio
async def test_fetch_installation_token_returns_token_on_success(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_get(self: httpx.AsyncClient, url: str, headers: dict[str, str]) -> httpx.Response:
        return httpx.Response(200, json={"data": {"token": "ghs_faketoken"}})

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    token = await fetch_installation_token("repo-1")
    assert token == "ghs_faketoken"


@pytest.mark.asyncio
async def test_fetch_installation_token_raises_on_non_200(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_get(self: httpx.AsyncClient, url: str, headers: dict[str, str]) -> httpx.Response:
        return httpx.Response(404, text="Repository not found")

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    with pytest.raises(RuntimeError, match="status 404"):
        await fetch_installation_token("repo-1")


@pytest.mark.asyncio
async def test_fetch_installation_token_raises_runtime_error_on_malformed_body(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Regression: a 200 response whose body doesn't match the expected
    # {"data": {"token": ...}} envelope used to raise a bare KeyError
    # instead of the RuntimeError pattern every other failure here uses —
    # unclear in index_jobs.error_message when it happens mid-job.
    async def fake_get(self: httpx.AsyncClient, url: str, headers: dict[str, str]) -> httpx.Response:
        return httpx.Response(200, json={"data": {}})

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    with pytest.raises(RuntimeError, match="Malformed installation-token response"):
        await fetch_installation_token("repo-1")


@pytest.mark.asyncio
async def test_fetch_installation_token_raises_runtime_error_on_non_json_body(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_get(self: httpx.AsyncClient, url: str, headers: dict[str, str]) -> httpx.Response:
        return httpx.Response(200, text="not json")

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    with pytest.raises(RuntimeError, match="Malformed installation-token response"):
        await fetch_installation_token("repo-1")

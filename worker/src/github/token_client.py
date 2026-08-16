import httpx

from src.config import get_settings


async def fetch_installation_token(repository_id: str) -> str:
    settings = get_settings()
    url = f"{settings.backend_internal_url}/internal/repositories/{repository_id}/installation-token"

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, headers={"X-Internal-Secret": settings.internal_api_secret})

    if response.status_code != 200:
        raise RuntimeError(
            f"Failed to fetch installation token for repository {repository_id} "
            f"(status {response.status_code}): {response.text}"
        )

    try:
        body = response.json()
        return str(body["data"]["token"])
    except (ValueError, KeyError, TypeError) as exc:
        raise RuntimeError(
            f"Malformed installation-token response for repository {repository_id}: {exc}"
        ) from None

import jwt from "jsonwebtoken";
import { env } from "../../../config/env.js";

const GITHUB_API_BASE = "https://api.github.com";

function signAppJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iat: now - 60, // allow for clock drift
      exp: now + 9 * 60, // GitHub caps App JWTs at 10 minutes
      iss: env.GITHUB_APP_ID,
    },
    env.GITHUB_APP_PRIVATE_KEY,
    { algorithm: "RS256" }
  );
}

export async function mintInstallationToken(
  githubInstallationId: bigint
): Promise<{ token: string; expiresAt: Date }> {
  const appJwt = signAppJwt();

  const res = await fetch(
    `${GITHUB_API_BASE}/app/installations/${githubInstallationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `Failed to mint GitHub App installation token (status ${res.status}): ${
        (body as { message?: string }).message ?? "unknown error"
      }`
    );
  }

  const body = (await res.json()) as { token: string; expires_at: string };
  return { token: body.token, expiresAt: new Date(body.expires_at) };
}

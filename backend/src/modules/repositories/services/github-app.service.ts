import jwt from "jsonwebtoken";
import { env } from "../../../config/env.js";

export const GITHUB_API_BASE = "https://api.github.com";

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

// Installation tokens are valid for ~1 hour — minting a fresh one on
// every call (e.g. once per "View diff" click, or per finding in a PR
// review) burns a JWT-sign + HTTP round trip to GitHub for a token
// that's still perfectly valid. Cached per installation id, in-memory,
// with a 60s safety margin before the real expiry.
const tokenCache = new Map<string, { token: string; expiresAt: Date }>();
const TOKEN_EXPIRY_SAFETY_MARGIN_MS = 60_000;

export async function mintInstallationToken(
  githubInstallationId: bigint
): Promise<{ token: string; expiresAt: Date }> {
  const cacheKey = githubInstallationId.toString();
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt.getTime() - TOKEN_EXPIRY_SAFETY_MARGIN_MS > Date.now()) {
    return cached;
  }

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
  const result = { token: body.token, expiresAt: new Date(body.expires_at) };
  tokenCache.set(cacheKey, result);
  return result;
}

export interface GithubRepo {
  owner: string;
  name: string;
  githubUrl: string;
  defaultBranch: string;
  private: boolean;
}

export async function listInstallationRepositories(token: string): Promise<GithubRepo[]> {
  const res = await fetch(`${GITHUB_API_BASE}/installation/repositories`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `Failed to list GitHub App installation repositories (status ${res.status}): ${
        (body as { message?: string }).message ?? "unknown error"
      }`
    );
  }

  const body = (await res.json()) as {
    repositories: Array<{
      name: string;
      full_name: string;
      private: boolean;
      default_branch: string;
      owner: { login: string };
      html_url: string;
    }>;
  };

  return body.repositories.map((repo) => ({
    owner: repo.owner.login,
    name: repo.name,
    githubUrl: repo.html_url,
    defaultBranch: repo.default_branch,
    private: repo.private,
  }));
}

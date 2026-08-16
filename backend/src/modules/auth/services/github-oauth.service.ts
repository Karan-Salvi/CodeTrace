import { prisma } from "../../../database/client.js";
import { env } from "../../../config/env.js";
import { encrypt } from "../../../core/utils/encryption.js";
import type { GitHubProfile } from "../types/auth.types.js";

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";

export function getAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    scope: "read:user user:email",
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString().replace(/\+/g, "%20")}`;
}

export async function exchangeCodeForProfile(
  code: string
): Promise<GitHubProfile & { accessToken: string }> {
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenBody = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenBody.access_token) {
    throw new Error(`GitHub OAuth code exchange failed: ${tokenBody.error ?? "unknown error"}`);
  }

  const profileRes = await fetch(USER_URL, {
    headers: { Authorization: `Bearer ${tokenBody.access_token}`, Accept: "application/json" },
  });
  const profile = (await profileRes.json()) as GitHubProfile;

  return { ...profile, accessToken: tokenBody.access_token };
}

export async function upsertUserFromProfile(profile: GitHubProfile, accessToken: string) {
  const encryptedToken = encrypt(accessToken);

  return prisma.user.upsert({
    where: { githubId: BigInt(profile.id) },
    create: {
      githubId: BigInt(profile.id),
      username: profile.login,
      email: profile.email,
      avatarUrl: profile.avatar_url,
      githubAccessToken: encryptedToken,
    },
    update: {
      username: profile.login,
      email: profile.email,
      avatarUrl: profile.avatar_url,
      githubAccessToken: encryptedToken,
    },
  });
}

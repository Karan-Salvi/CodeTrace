const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
}

export function setUnauthorizedCallback(callback: () => void) {
  onUnauthorized = callback;
}

export function handleUnauthorized() {
  clearAccessToken();
  if (onUnauthorized) {
    onUnauthorized();
  }
}

// The access token lives in memory only (never localStorage — plan's
// explicit instruction, matches the backend's httpOnly-cookie-only
// refresh token design) and has a 15-minute TTL
// (ACCESS_TOKEN_TTL_SECONDS, backend/src/config/constants.ts). This is
// the one place that calls POST /auth/refresh — used both right after
// the OAuth redirect (AuthSuccess.tsx) and as a retry inside apiFetch's
// 401 handler, so a mid-session token expiry doesn't force a full
// logout while the httpOnly refresh cookie (30-day TTL) is still valid.
export async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) return null;
    const body = await response.json();
    const token = body?.data?.accessToken as string | undefined;
    if (!token) return null;
    setAccessToken(token);
    return token;
  } catch {
    return null;
  }
}

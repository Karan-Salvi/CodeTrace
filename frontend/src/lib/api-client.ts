import { getAccessToken, handleUnauthorized, refreshAccessToken } from "./auth";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface RequestOptions extends RequestInit {
  data?: unknown;
}

async function doFetch(endpoint: string, options: RequestOptions, token: string | null): Promise<Response> {
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.data) {
    headers.set("Content-Type", "application/json");
    options.body = JSON.stringify(options.data);
  }

  return fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
}

export async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  let token = getAccessToken();
  let response = await doFetch(endpoint, options, token);

  if (response.status === 401) {
    // The access token has a 15-minute TTL (constants.ts) but the
    // httpOnly refresh cookie is valid for 30 days — a bare 401 here
    // doesn't mean the user's session is actually over, just that this
    // one short-lived token expired. Retry once via /auth/refresh
    // before treating it as a real logout; only give up (and only then
    // clear state / redirect to login) if the refresh itself fails,
    // meaning the refresh cookie is genuinely gone/invalid.
    token = await refreshAccessToken();
    if (token) {
      response = await doFetch(endpoint, options, token);
    }
  }

  if (response.status === 401) {
    handleUnauthorized();
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    let errorMessage = "An error occurred";
    try {
      const errorData = await response.json();
      errorMessage = errorData.error?.message || errorMessage;
    } catch {
      // Ignore JSON parse errors
    }
    throw new Error(errorMessage);
  }

  // Handle empty responses
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const json = await response.json();
    return json.data as T;
  }

  return null as unknown as T;
}

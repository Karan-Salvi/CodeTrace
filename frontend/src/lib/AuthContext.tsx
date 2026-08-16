import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { clearAccessToken, getAccessToken, refreshAccessToken, setUnauthorizedCallback } from "./auth";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface AuthContextValue {
  token: string | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  // Re-run the silent /auth/refresh and sync React state from it.
  // AuthSuccess.tsx calls this right after the OAuth redirect — the
  // provider's own mount-time refresh already covers page load/reload,
  // but AuthSuccess needs its own explicit call+state-sync rather than
  // relying on a remount, since it navigates away immediately after.
  refresh: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getAccessToken());
  const [isLoading, setIsLoading] = useState(true);

  async function refresh(): Promise<string | null> {
    const refreshed = await refreshAccessToken();
    setToken(refreshed);
    return refreshed;
  }

  useEffect(() => {
    // The access token lives in a module-level variable, not
    // localStorage — it's gone on every page reload. Without this, a
    // logged-in user who refreshes the page (or opens a new tab) looks
    // logged out even though their httpOnly refresh cookie (30-day TTL)
    // is still valid. This silently retries once via /auth/refresh on
    // mount before rendering as logged-out.
    let cancelled = false;
    refreshAccessToken().then((refreshed) => {
      if (cancelled) return;
      setToken(refreshed);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // apiFetch's 401 handler calls handleUnauthorized() (via
    // lib/auth.ts's module-level callback) when a refresh retry itself
    // fails — this context needs to react to that to actually re-render
    // the nav bar / redirect, since AppShell no longer reads the
    // module-level token directly.
    setUnauthorizedCallback(() => setToken(null));
  }, []);

  async function logout() {
    // Regression: the previous logout only cleared the client-side
    // token — the httpOnly refresh cookie stayed valid server-side, so
    // the session was never actually revoked (anyone with that cookie
    // could still mint fresh access tokens via /auth/refresh after
    // "logout"). Must call the real backend endpoint.
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" });
    } finally {
      clearAccessToken();
      setToken(null);
    }
  }

  return <AuthContext.Provider value={{ token, isLoading, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

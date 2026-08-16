import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export function AuthSuccess() {
  const navigate = useNavigate();
  const { refresh } = useAuth();

  useEffect(() => {
    // Regression: this used to read ?token=... from the URL — that's
    // the exact insecure flow the backend was fixed to stop doing
    // earlier this session (token-in-URL leaks via browser history,
    // Referer header, infra access logs). The backend now redirects
    // here with NO token param at all; the httpOnly refresh cookie
    // (set during the OAuth callback) is what actually proves the
    // login, and POST /auth/refresh mints the first access token from
    // it. Reading a URL param here always fails now — every login
    // attempt bounced straight back to /login.
    let cancelled = false;
    refresh().then((token) => {
      if (cancelled) return;
      navigate(token ? "/repositories" : "/login", { replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate, refresh]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <p className="text-body text-[16px]">Completing login...</p>
    </div>
  );
}

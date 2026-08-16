import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { Button } from "../ui/button";

export function AppShell() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    // Regression: this used to only clear the client-side token — the
    // httpOnly refresh cookie stayed valid server-side, so the session
    // was never actually revoked. logout() (AuthContext) calls the real
    // POST /auth/logout first.
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-[64px] bg-canvas text-ink px-lg flex items-center justify-between border-b border-hairline">
        <div className="flex items-center space-x-md">
          <Link to="/" className="font-semibold text-[16px] tracking-tight">CodeTrace</Link>
          {token && (
            <nav className="flex items-center space-x-sm">
              <Link to="/repositories" className="text-body hover:text-ink text-[14px] px-xs py-1 rounded-full transition-colors">Repositories</Link>
            </nav>
          )}
        </div>
        <div className="flex items-center space-x-sm">
          {!token ? (
            <>
              <Button variant="secondary-sm" onClick={() => navigate("/login")}>Log In</Button>
              <Button variant="primary-sm" onClick={() => navigate("/login")}>Sign Up</Button>
            </>
          ) : (
            <Button variant="secondary-sm" onClick={handleLogout}>Log Out</Button>
          )}
        </div>
      </header>
      <main className="flex-1 w-full max-w-[1400px] mx-auto p-lg sm:p-xl">
        <Outlet />
      </main>
    </div>
  );
}

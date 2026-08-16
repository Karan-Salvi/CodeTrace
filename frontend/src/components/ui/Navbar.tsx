import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { cn } from "../../lib/utils";

// --- Inline Icons ---

function MenuIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function CloseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function LogOutIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

function MonitorIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );
}

function UserIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LayoutDashboardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}

function SunIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function LogoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3.5 21 14 3"/>
      <path d="M20.5 21 10 3"/>
      <path d="M15.5 21 12 15l-3.5 6"/>
      <path d="M2 21h20"/>
    </svg>
  );
}

// --- Hooks ---

function useOutsideClick(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    function listener(event: MouseEvent | TouchEvent) {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler();
    }
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

// --- Components ---

type Theme = "light" | "dark" | "system";

export function Navbar() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("theme") as Theme) || "system";
  });

  const profileRef = useRef<HTMLDivElement>(null);
  useOutsideClick(profileRef, () => setProfileDropdownOpen(false));

  // Scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Theme effect
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
    
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setProfileDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = async () => {
    await logout();
    setProfileDropdownOpen(false);
    navigate("/login");
  };

  return (
    <header 
      className={cn(
        "sticky top-0 z-50 w-full bg-canvas/80 backdrop-blur-md transition-all duration-200",
        scrolled ? "border-b border-hairline shadow-sm" : ""
      )}
    >
      <div className="mx-auto flex h-[64px] max-w-[1400px] items-center justify-between px-lg sm:px-xl">
        
        {/* Left: Brand & Main Nav */}
        <div className="flex items-center space-x-xl">
          <Link to="/" className="flex items-center space-x-2 text-ink hover:opacity-80 transition-opacity">
            <LogoIcon className="h-6 w-6" />
            <span className="font-semibold text-[16px] tracking-tight">CodeTrace</span>
          </Link>

          {/* Desktop Nav */}
          {token && (
            <nav className="hidden md:flex items-center space-x-sm">
              <Link 
                to="/repositories" 
                className="text-[14px] text-body hover:text-ink px-sm py-[6px] rounded-md hover:bg-canvas-soft transition-colors"
              >
                Repositories
              </Link>
            </nav>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-md">
          {/* Desktop Auth */}
          <div className="hidden md:flex items-center">
            {token ? (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-canvas-soft border border-hairline hover:ring-2 hover:ring-hairline-strong transition-all focus:outline-none"
                  aria-expanded={profileDropdownOpen}
                  aria-label="User menu"
                >
                  <UserIcon className="h-4 w-4 text-ink" />
                </button>

                {/* Profile Dropdown */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-lg border border-hairline bg-canvas p-1 shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-sm py-xs border-b border-hairline mb-1">
                      <p className="text-[14px] font-medium text-ink">Developer</p>
                    </div>

                    <div className="px-1 py-1">
                      <Link
                        to="/repositories"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex w-full items-center px-sm py-2 text-[14px] text-ink hover:bg-canvas-soft rounded-sm transition-colors"
                      >
                        <LayoutDashboardIcon className="mr-2 h-4 w-4 text-mute" />
                        Dashboard
                      </Link>
                      <Link
                        to="/profile"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex w-full items-center px-sm py-2 text-[14px] text-ink hover:bg-canvas-soft rounded-sm transition-colors"
                      >
                        <UserIcon className="mr-2 h-4 w-4 text-mute" />
                        Profile
                      </Link>
                    </div>

                    <div className="border-t border-hairline my-1" />
                    
                    {/* Theme Switcher */}
                    <div className="px-sm py-2">
                      <p className="text-[12px] font-medium text-mute mb-2">Theme</p>
                      <div className="grid grid-cols-3 gap-1 rounded-md bg-canvas-soft p-1">
                        <button onClick={() => setTheme("light")} className={cn("flex justify-center rounded-sm py-1 transition-colors", theme === "light" ? "bg-canvas shadow-sm text-ink" : "text-mute hover:text-ink")}>
                          <SunIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => setTheme("system")} className={cn("flex justify-center rounded-sm py-1 transition-colors", theme === "system" ? "bg-canvas shadow-sm text-ink" : "text-mute hover:text-ink")}>
                          <MonitorIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => setTheme("dark")} className={cn("flex justify-center rounded-sm py-1 transition-colors", theme === "dark" ? "bg-canvas shadow-sm text-ink" : "text-mute hover:text-ink")}>
                          <MoonIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-hairline my-1" />
                    
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center px-sm py-2 text-[14px] text-error hover:bg-error-soft rounded-sm transition-colors text-left"
                    >
                      <LogOutIcon className="mr-2 h-4 w-4" />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link 
                to="/login"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-[14px] font-medium text-on-primary transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden flex items-center justify-center p-2 text-ink hover:bg-canvas-soft rounded-md transition-colors focus:outline-none"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-hairline bg-canvas px-lg py-md absolute w-full left-0 top-[64px] shadow-lg animate-in slide-in-from-top-4 duration-200">
          <nav className="flex flex-col space-y-4">
            {token && (
              <Link 
                to="/repositories" 
                className="text-[16px] font-medium text-ink hover:text-mute transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Repositories
              </Link>
            )}
            
            <div className="border-t border-hairline pt-4">
              <p className="text-[12px] font-medium text-mute mb-3">Appearance</p>
              <div className="flex items-center space-x-2">
                <button onClick={() => setTheme("light")} className={cn("flex-1 flex justify-center items-center py-2 rounded-md transition-colors border", theme === "light" ? "bg-canvas-soft border-hairline-strong text-ink" : "border-hairline text-mute hover:bg-canvas-soft")}>
                  <SunIcon className="h-4 w-4 mr-2" /> Light
                </button>
                <button onClick={() => setTheme("dark")} className={cn("flex-1 flex justify-center items-center py-2 rounded-md transition-colors border", theme === "dark" ? "bg-canvas-soft border-hairline-strong text-ink" : "border-hairline text-mute hover:bg-canvas-soft")}>
                  <MoonIcon className="h-4 w-4 mr-2" /> Dark
                </button>
              </div>
            </div>

            <div className="border-t border-hairline pt-4">
              {token ? (
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center rounded-md border border-error bg-transparent px-4 py-2 text-[14px] font-medium text-error hover:bg-error-soft transition-colors"
                >
                  <LogOutIcon className="mr-2 h-4 w-4" />
                  Log out
                </button>
              ) : (
                <Link 
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-[14px] font-medium text-on-primary hover:opacity-90 transition-colors"
                >
                  Sign In
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

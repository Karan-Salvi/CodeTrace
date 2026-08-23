import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, User, Menu } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Avatar, AvatarFallback } from "./avatar";
import { BrandLogo } from "./BrandLogo";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#pipeline", label: "Solution" },
  { href: "#about", label: "About" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "Community" },
];

export function VercelNavbar() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 0);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div
      className={`flex sticky px-4 z-50 top-0 w-full items-center h-16 justify-between transition-all duration-300 ${
        scrolled ? "bg-canvas/70 backdrop-blur-md border-b border-white/10 shadow-md" : "bg-transparent border-b-0"
      }`}
    >
      <div className="flex items-center justify-between w-full mx-auto max-w-7xl">
        {/* Brand */}
        <div className="flex h-14 items-center">
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80 cursor-pointer">
            <BrandLogo className="w-6 h-6 text-white" />
            <span className="font-bold text-lg text-white">CodeTrace</span>
          </Link>
          
          {/* Main Links */}
          <nav className="ml-8 hidden md:flex items-center space-x-6 text-sm font-medium text-muted-foreground">
            {!token ? (
              NAV_LINKS.map((link) => (
                <a key={link.href} href={link.href} className="hover:text-white transition-colors cursor-pointer">
                  {link.label}
                </a>
              ))
            ) : (
              <Link to="/repositories" className="hover:text-white transition-colors cursor-pointer">Dashboard</Link>
            )}
          </nav>
        </div>

        {/* Right Auth Section */}
        <div className="flex gap-2 sm:gap-4 items-center">
          {!token ? (
            <>
              <a
                href="#faq"
                className="hidden sm:flex items-center h-8 px-4 rounded-full border border-white/15 text-sm font-medium text-white/80 hover:text-white hover:border-white/30 transition-colors cursor-pointer"
              >
                Contact
              </a>
              {/* Below md, the nav links above are display:none — this
                  dropdown is the only way a mobile visitor reaches
                  Features/Pricing/etc. without it, the site's own
                  section anchors are unreachable from a phone. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open navigation menu"
                    className="flex md:hidden items-center justify-center h-8 w-8 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 transition-colors cursor-pointer"
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 p-2 rounded-xl bg-canvas-soft border border-white/10 shadow-lg" align="end">
                  <DropdownMenuGroup>
                    {NAV_LINKS.map((link) => (
                      <DropdownMenuItem key={link.href} asChild className="py-2 cursor-pointer focus:bg-white/5">
                        <a href={link.href}>{link.label}</a>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem asChild className="py-2 cursor-pointer focus:bg-white/5">
                    <a href="#faq">Contact</a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => navigate("/login")} className="rounded-full px-4 sm:px-6 text-sm h-8">
                Get Started
              </Button>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="border cursor-pointer h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 p-2 rounded-xl bg-canvas-soft border border-white/10 shadow-lg" align="end">
                <div className="p-2 pb-4">
                  <h1 className="font-semibold text-sm">Developer</h1>
                  <p className="text-xs text-muted-foreground">user@codetrace.dev</p>
                </div>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild className="py-2 cursor-pointer focus:bg-white/5">
                    <Link to="/repositories">Dashboard</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="py-2 cursor-pointer focus:bg-white/5">
                    <Link to="/settings">Account Settings</Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={handleLogout} className="py-2 justify-between cursor-pointer focus:bg-white/5 text-error">
                  Logout <LogOut className="h-4 w-4" />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
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
              <>
                <a href="#features" className="hover:text-white transition-colors cursor-pointer">Features</a>
                <a href="#pipeline" className="hover:text-white transition-colors cursor-pointer">Solution</a>
                <a href="#about" className="hover:text-white transition-colors cursor-pointer">About</a>
                <a href="#pricing" className="hover:text-white transition-colors cursor-pointer">Pricing</a>
                <a href="#faq" className="hover:text-white transition-colors cursor-pointer">Community</a>
              </>
            ) : (
              <Link to="/repositories" className="hover:text-white transition-colors cursor-pointer">Dashboard</Link>
            )}
          </nav>
        </div>

        {/* Right Auth Section */}
        <div className="flex gap-4 items-center">
          {!token ? (
            <>
              <a
                href="#faq"
                className="hidden sm:flex items-center h-8 px-4 rounded-full border border-white/15 text-sm font-medium text-white/80 hover:text-white hover:border-white/30 transition-colors cursor-pointer"
              >
                Contact
              </a>
              <Button onClick={() => navigate("/login")} className="rounded-full px-6 text-sm h-8">
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

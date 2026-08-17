import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Triangle, LogOut, User } from "lucide-react";
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
      className={`flex sticky px-4 z-50 top-0 w-full bg-background items-center h-16 justify-between transition-border duration-300 ${
        scrolled ? "border-b border-white/10 backdrop-blur-md bg-background/80" : "border-b-0"
      }`}
    >
      <div className="flex items-center justify-between w-full mx-auto max-w-7xl">
        {/* Brand */}
        <div className="flex h-14 items-center">
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <Triangle className="w-6 h-6 fill-current text-white" />
            <span className="font-bold text-lg text-white">CodeTrace</span>
          </Link>
          
          {/* Main Links */}
          <nav className="ml-8 hidden md:flex items-center space-x-6 text-sm font-medium text-muted-foreground">
            <Link to="/docs" className="hover:text-white transition-colors">Docs</Link>
            {token && (
              <Link to="/repositories" className="hover:text-white transition-colors">Dashboard</Link>
            )}
          </nav>
        </div>

        {/* Right Auth Section */}
        <div className="flex gap-4 items-center">
          {!token ? (
            <Button onClick={() => navigate("/login")} variant="secondary" className="rounded-full px-6 text-sm h-8">
              Log In
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="border cursor-pointer h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 p-2 rounded-xl bg-background border-white/10" align="end">
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

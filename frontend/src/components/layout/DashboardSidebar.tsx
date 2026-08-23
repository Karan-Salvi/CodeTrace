import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { FolderGit2, Settings, LogOut, User } from "lucide-react";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { useAuth } from "../../lib/AuthContext";
import { cn } from "../../lib/utils";
import { BrandLogo } from "../ui/BrandLogo";
import { apiFetch } from "../../lib/api-client";
import type { CurrentUser } from "../../types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

// Only real, routed destinations — App.tsx has no /repositories/agent or
// /analytics route, so those don't belong here even though the reference
// design they were adapted from had them.
const navItems = [{ name: "Repositories", icon: FolderGit2, path: "/repositories" }];

export function DashboardSidebar() {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let mounted = true;
    apiFetch<CurrentUser>("/auth/me")
      .then((data) => mounted && setUser(data))
      .catch(() => {
        // Sidebar renders on every dashboard route — a failed fetch here
        // just keeps the generic "Account" label; the page itself will
        // surface any real auth problem via its own protected fetch.
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="w-[240px] flex-shrink-0 h-[100dvh] sticky top-0 bg-canvas border-r border-hairline flex flex-col overflow-hidden">
      <Link to="/repositories" className="flex items-center gap-2 px-4 h-14 border-b border-hairline shrink-0">
        <BrandLogo className="w-5 h-5 text-ink" />
        <span className="font-semibold text-[14px] text-ink">CodeTrace</span>
      </Link>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const active = pathname === item.path || pathname.startsWith(`${item.path}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors text-[13px] font-medium group cursor-pointer",
                  active ? "bg-canvas-soft text-ink" : "text-mute hover:text-ink hover:bg-canvas-soft/50"
                )}
              >
                <Icon className={cn("w-4 h-4", active ? "text-ink" : "text-mute group-hover:text-ink")} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="p-3 border-t border-hairline shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-2 hover:bg-canvas-soft p-1.5 rounded-md transition-colors cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-primary">
              <Avatar className="h-6 w-6 border border-hairline">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover rounded-full" />
                ) : (
                  <AvatarFallback className="bg-primary/10 text-[10px] text-ink">
                    <User className="w-3 h-3 text-mute" />
                  </AvatarFallback>
                )}
              </Avatar>
              <span className="text-[13px] font-medium text-ink flex-1 truncate">
                {user?.displayName || user?.username || "Account"}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[220px] p-1.5 rounded-xl bg-canvas border border-hairline shadow-[0_12px_32px_rgba(0,0,0,0.4)]" align="start" sideOffset={12}>
            <DropdownMenuItem asChild className="py-2 px-3 text-[13px] cursor-pointer focus:bg-canvas-soft rounded-md text-ink flex items-center justify-between">
              <Link to="/settings">
                <span>Settings</span>
                <Settings className="w-4 h-4 text-mute" />
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-hairline my-1" />
            <DropdownMenuItem onClick={logout} className="py-2 px-3 text-[13px] flex items-center justify-between cursor-pointer focus:bg-canvas-soft rounded-md text-ink">
              <span>Log Out</span>
              <LogOut className="w-4 h-4 text-mute" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

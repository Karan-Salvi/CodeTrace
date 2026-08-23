import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { FolderGit2, Settings, LogOut, User, LayoutDashboard, MessageSquare, GitPullRequest, Network } from "lucide-react";
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

// Formerly RepositoryLayout's own local tab list — moved here so a repo's
// sub-pages show as an expandable group under "Repositories" in the main
// nav (matching the app's own sidebar-driven-navigation pattern) instead
// of a second, separate tab strip living in the page content area.
const REPO_TABS = [
  { label: "Overview", icon: LayoutDashboard, suffix: "" },
  { label: "Chat", icon: MessageSquare, suffix: "/chat" },
  { label: "Pull Requests", icon: GitPullRequest, suffix: "/pull-requests" },
  { label: "Architecture", icon: Network, suffix: "/architecture" },
];

// Matches "/repositories/:id" (and deeper), but not the literal
// "/repositories" list page or "/repositories/new" (a real page, not an
// id) — pathname-based rather than useParams() because this component
// renders in AppShell, one level above where the :id route param is
// actually matched, so useParams() here would not see it.
function repoIdFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/repositories\/([^/]+)/);
  if (!match) return null;
  return match[1] === "new" ? null : match[1];
}

interface DashboardSidebarProps {
  // Set only by the mobile drawer (AppShell) so a nav/account click closes
  // the overlay — the always-visible desktop sidebar has no "close" concept.
  onNavigate?: () => void;
}

export function DashboardSidebar({ onNavigate }: DashboardSidebarProps = {}) {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const repoId = repoIdFromPathname(pathname);

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
      <Link
        to="/repositories"
        onClick={onNavigate}
        className="flex items-center gap-2 px-4 h-14 border-b border-hairline shrink-0"
      >
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
                onClick={onNavigate}
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

          {repoId && (
            <div className="ml-2 pl-2.5 border-l border-hairline flex flex-col gap-0.5 mt-0.5">
              {REPO_TABS.map((tab) => {
                const path = `/repositories/${repoId}${tab.suffix}`;
                const active = pathname === path;
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.label}
                    to={path}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-[13px] font-medium group cursor-pointer",
                      active ? "bg-canvas-soft text-ink" : "text-mute hover:text-ink hover:bg-canvas-soft/50"
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5", active ? "text-ink" : "text-mute group-hover:text-ink")} />
                    <span>{tab.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
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
              <Link to="/settings" onClick={onNavigate}>
                <span>Settings</span>
                <Settings className="w-4 h-4 text-mute" />
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-hairline my-1" />
            <DropdownMenuItem
              onClick={() => {
                logout();
                onNavigate?.();
              }}
              className="py-2 px-3 text-[13px] flex items-center justify-between cursor-pointer focus:bg-canvas-soft rounded-md text-ink"
            >
              <span>Log Out</span>
              <LogOut className="w-4 h-4 text-mute" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

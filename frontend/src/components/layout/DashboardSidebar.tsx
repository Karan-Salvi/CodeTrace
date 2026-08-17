import { useLocation, Link } from "react-router-dom";
import { 
  Search, 
  FolderGit2, 
  BarChart2, 
  Settings, 
  Cpu, 
  LogOut,
  User,
  Bell,
  MoreHorizontal,
  SmilePlus,
  Moon,
  Sun,
  Monitor,
  Home,
  Pencil,
  LifeBuoy,
  Book
} from "lucide-react";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { useAuth } from "../../lib/AuthContext";
import { cn } from "../../lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export function DashboardSidebar() {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  
  const navItems = [
    { name: "Projects", icon: FolderGit2, path: "/repositories", active: pathname === "/repositories" || pathname === "/repositories/" },
    { name: "Agent", icon: Cpu, path: "/repositories/agent", active: pathname.includes("/agent") },
    { name: "Analytics", icon: BarChart2, path: "/analytics", active: pathname.includes("/analytics") },
    { divider: true },
    { name: "Settings", icon: Settings, path: "/settings", active: pathname.includes("/settings") },
  ];

  return (
    <div className="w-[240px] flex-shrink-0 h-[100dvh] sticky top-0 bg-canvas border-r border-hairline flex flex-col pt-3 overflow-hidden">
      
      {/* Scope Selector */}
      <div className="px-3 mb-4">
        <button className="w-full flex items-center justify-between bg-canvas hover:bg-canvas-soft transition-colors border border-transparent hover:border-hairline rounded-md px-2 py-1.5 cursor-pointer">
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5 border border-hairline">
              <AvatarFallback className="bg-primary/10 text-[10px]">KS</AvatarFallback>
            </Avatar>
            <span className="text-[13px] font-medium text-ink truncate w-[100px] text-left">Karan Salvi's pr...</span>
            <span className="text-[10px] uppercase font-mono tracking-wider bg-canvas-soft border border-hairline px-1.5 py-0.5 rounded-sm text-mute">Hobby</span>
          </div>
          <svg className="w-3 h-3 text-mute" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
        </button>
      </div>

      {/* Search */}
      <div className="px-4 mb-4 relative">
        <div className="absolute left-6.5 top-1/2 -translate-y-1/2 text-mute">
          <Search className="w-3.5 h-3.5" />
        </div>
        <input 
          type="text" 
          placeholder="Find" 
          className="w-full bg-canvas-soft border border-hairline rounded-md pl-8 pr-6 py-1 text-[13px] text-ink placeholder:text-mute focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all h-[32px]"
        />
        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-mute text-[10px] font-mono bg-canvas border border-hairline px-1 rounded-sm">
          F
        </div>
      </div>

      {/* Nav Scroll Area */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-hide">
        <div className="space-y-0.5">
          {navItems.map((item, i) => {
            if (item.divider) {
              return <div key={`div-${i}`} className="h-[1px] bg-hairline my-2 mx-2" />;
            }
            
            const Icon = item.icon;
            if (!Icon) return null;
            
            return (
              <Link 
                key={item.name} 
                to={item.path!} 
                className={cn(
                  "flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors text-[13px] font-medium group cursor-pointer",
                  item.active ? "bg-canvas-soft text-ink" : "text-mute hover:text-ink hover:bg-canvas-soft/50"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={cn("w-4 h-4", item.active ? "text-ink" : "text-mute group-hover:text-ink")} />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* User Footer */}
      <div className="p-3 border-t border-hairline flex items-center justify-between shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex flex-1 items-center gap-2 hover:bg-canvas-soft p-1.5 rounded-md transition-colors cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-primary">
              <Avatar className="h-6 w-6 border border-hairline">
                <AvatarFallback className="bg-primary/10 text-[10px] text-ink">
                  <User className="w-3 h-3 text-mute" />
                </AvatarFallback>
              </Avatar>
              <span className="text-[13px] font-medium text-ink truncate flex-1">Karan Salvi</span>
              <div className="w-6 h-6 flex items-center justify-center rounded hover:bg-canvas-soft text-mute transition-colors">
                <MoreHorizontal className="w-4 h-4" />
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[280px] p-1.5 rounded-xl bg-canvas border border-hairline shadow-[0_12px_32px_rgba(0,0,0,0.4)]" align="start" sideOffset={12}>
            
            {/* Header */}
            <div className="px-2 pt-2 pb-3 flex items-start justify-between">
              <div>
                <h1 className="font-semibold text-[14px] text-ink leading-tight">Karan Salvi</h1>
                <p className="text-[13px] text-mute">karansalviwork@gmail.com</p>
              </div>
              <button className="text-mute hover:text-ink transition-colors cursor-pointer" aria-label="Settings">
                <Settings className="w-4 h-4" />
              </button>
            </div>
            
            <DropdownMenuSeparator className="bg-hairline my-1" />
            
            {/* Nav Group */}
            <DropdownMenuGroup className="space-y-0.5">
              <DropdownMenuItem asChild className="py-2 px-3 text-[13px] cursor-pointer focus:bg-canvas-soft rounded-md text-ink flex items-center justify-between">
                <Link to="#">
                  <span>Feedback</span>
                  <SmilePlus className="w-4 h-4 text-mute" />
                </Link>
              </DropdownMenuItem>
              
              <DropdownMenuItem asChild className="py-2 px-3 text-[13px] cursor-pointer focus:bg-canvas-soft rounded-md text-ink flex items-center justify-between">
                <div onClick={(e) => e.preventDefault()}>
                  <span>Theme</span>
                  <div className="flex items-center bg-canvas-soft border border-hairline rounded-full p-0.5 gap-1">
                    <div className="bg-canvas border border-hairline rounded-full p-1"><Monitor className="w-3 h-3 text-ink" /></div>
                    <div className="p-1"><Sun className="w-3 h-3 text-mute" /></div>
                    <div className="p-1"><Moon className="w-3 h-3 text-mute" /></div>
                  </div>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem asChild className="py-2 px-3 text-[13px] cursor-pointer focus:bg-canvas-soft rounded-md text-ink flex items-center justify-between">
                <Link to="#">
                  <span>Home Page</span>
                  <Home className="w-4 h-4 text-mute" />
                </Link>
              </DropdownMenuItem>
              
              <DropdownMenuItem asChild className="py-2 px-3 text-[13px] cursor-pointer focus:bg-canvas-soft rounded-md text-ink flex items-center justify-between">
                <Link to="#">
                  <span>Changelog</span>
                  <Pencil className="w-4 h-4 text-mute" />
                </Link>
              </DropdownMenuItem>
              
              <DropdownMenuItem asChild className="py-2 px-3 text-[13px] cursor-pointer focus:bg-canvas-soft rounded-md text-ink flex items-center justify-between">
                <Link to="#">
                  <span>Help</span>
                  <LifeBuoy className="w-4 h-4 text-mute" />
                </Link>
              </DropdownMenuItem>
              
              <DropdownMenuItem asChild className="py-2 px-3 text-[13px] cursor-pointer focus:bg-canvas-soft rounded-md text-ink flex items-center justify-between">
                <Link to="#">
                  <span>Docs</span>
                  <Book className="w-4 h-4 text-mute" />
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            
            <DropdownMenuSeparator className="bg-hairline my-1" />
            
            {/* Logout */}
            <DropdownMenuItem onClick={logout} className="py-2 px-3 text-[13px] flex items-center justify-between cursor-pointer focus:bg-canvas-soft rounded-md text-ink">
              <span>Log Out</span>
              <LogOut className="w-4 h-4 text-mute" />
            </DropdownMenuItem>
            
            {/* Upgrade Button */}
            <div className="px-1.5 py-1">
              <button className="w-full bg-white text-black hover:bg-gray-100 transition-colors font-medium text-[13px] py-1.5 rounded-md cursor-pointer">
                Upgrade to Pro
              </button>
            </div>
            
            {/* Alert Footer */}
            <div className="mx-1.5 mt-1 mb-0.5 bg-canvas-soft border border-hairline rounded-md px-3 py-2 flex items-center justify-between">
              <span className="text-[12px] text-error truncate pr-2">Partial disruption of Observability, A...</span>
              <div className="w-2 h-2 rounded-full bg-error shrink-0"></div>
            </div>

          </DropdownMenuContent>
        </DropdownMenu>
        
        <div className="flex items-center gap-1.5 text-mute ml-2 shrink-0">
          <button className="w-7 h-7 flex items-center justify-center hover:text-ink hover:bg-canvas-soft rounded-md transition-colors cursor-pointer relative focus:outline-none focus:ring-2 focus:ring-primary">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1.5 w-1.5 h-1.5 bg-[#0070f3] rounded-full border border-canvas" />
          </button>
        </div>
      </div>
    </div>
  );
}

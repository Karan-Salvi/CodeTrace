import { Link } from "react-router-dom";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { BrandLogo } from "../ui/BrandLogo";

export function DashboardTopbar() {
  return (
    <div className="h-14 flex-shrink-0 border-b border-hairline flex items-center justify-between px-4 sticky top-0 bg-canvas/80 backdrop-blur-md z-10">
      
      {/* Mobile brand (hidden on desktop) */}
      <div className="flex md:hidden items-center gap-2">
        <BrandLogo className="w-5 h-5 text-ink" />
      </div>

      {/* Tabs */}
      <div className="hidden md:flex items-center gap-1">
        <button className="text-[13px] font-medium text-ink flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-canvas-soft transition-colors cursor-pointer">
          All Projects
          <ChevronDown className="w-3.5 h-3.5 text-mute" />
        </button>
      </div>

      <div className="hidden md:flex items-center absolute left-1/2 -translate-x-1/2 space-x-6">
        <button className="text-[13px] font-medium text-ink cursor-pointer">
          Overview
        </button>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        <Link to="/repositories/agent" className="hidden md:flex items-center gap-1.5 text-[13px] font-medium text-mute hover:text-ink transition-colors cursor-pointer">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
          Agent
        </Link>
        <Button asChild variant="secondary" className="h-[32px] px-3 cursor-pointer">
          <Link to="/repositories/new" className="flex flex-row items-center justify-center gap-1.5 text-[13px] font-medium">
            <span>Add New</span>
            <Plus className="w-3.5 h-3.5 text-mute" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import { Plus, Menu } from "lucide-react";
import { Button } from "../ui/button";
import { BrandLogo } from "../ui/BrandLogo";

interface DashboardTopbarProps {
  onOpenMenu: () => void;
}

export function DashboardTopbar({ onOpenMenu }: DashboardTopbarProps) {
  return (
    <div className="h-14 flex-shrink-0 border-b border-hairline flex items-center justify-between px-4 sticky top-0 bg-canvas/80 backdrop-blur-md z-10">
      <div className="flex md:hidden items-center gap-2">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open menu"
          className="flex items-center justify-center w-8 h-8 -ml-1.5 rounded-md text-ink hover:bg-canvas-soft transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <BrandLogo className="w-5 h-5 text-ink" />
      </div>

      <div />

      <Button asChild variant="primary-sm">
        <Link to="/repositories/new" className="flex flex-row items-center justify-center gap-1.5">
          <span className="hidden sm:inline">Add New</span>
          <span className="sm:hidden">Add</span>
          <Plus className="w-3.5 h-3.5" />
        </Link>
      </Button>
    </div>
  );
}

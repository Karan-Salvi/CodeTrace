import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "../ui/button";
import { BrandLogo } from "../ui/BrandLogo";

export function DashboardTopbar() {
  return (
    <div className="h-14 flex-shrink-0 border-b border-hairline flex items-center justify-between px-4 sticky top-0 bg-canvas/80 backdrop-blur-md z-10">
      <div className="flex md:hidden items-center gap-2">
        <BrandLogo className="w-5 h-5 text-ink" />
      </div>

      <div />

      <Button asChild variant="secondary" className="h-[32px] px-3">
        <Link to="/repositories/new" className="flex flex-row items-center justify-center gap-1.5 text-[13px] font-medium">
          <span>Add New</span>
          <Plus className="w-3.5 h-3.5 text-mute" />
        </Link>
      </Button>
    </div>
  );
}

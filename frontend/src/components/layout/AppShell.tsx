import { Outlet } from "react-router-dom";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardTopbar } from "./DashboardTopbar";

export function AppShell() {
  return (
    <div className="flex min-h-[100dvh] w-full bg-canvas text-ink overflow-hidden">
      {/* Sidebar - hidden on mobile, block on md+ */}
      <div className="hidden md:block w-[240px] flex-shrink-0">
        <DashboardSidebar />
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-y-auto overflow-x-hidden">
        <DashboardTopbar />
        <main className="flex-1 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

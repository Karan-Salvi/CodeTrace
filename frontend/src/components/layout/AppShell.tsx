import { Outlet } from "react-router-dom";
import { VercelNavbar } from "../ui/VercelNavbar";

export function AppShell() {
  return (
    <div className="min-h-screen flex flex-col">
      <VercelNavbar />
      <main className="flex-1 w-full max-w-[1400px] mx-auto p-lg sm:p-xl">
        <Outlet />
      </main>
    </div>
  );
}

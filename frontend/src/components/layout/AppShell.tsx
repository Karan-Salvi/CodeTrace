import { Outlet } from "react-router-dom";
import { Navbar } from "../ui/Navbar";

export function AppShell() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-[1400px] mx-auto p-lg sm:p-xl">
        <Outlet />
      </main>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardTopbar } from "./DashboardTopbar";
import { useAuth } from "../../lib/AuthContext";

export function AppShell() {
  const { token, isLoading } = useAuth();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // A route change (nav link, back button, redirect after an action) is
  // the one thing DashboardSidebar's own onNavigate can't cover — this
  // catches every path, not just link clicks inside the drawer.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // Every route nested under AppShell is dashboard-only — without this,
  // logging out (or a refresh-cookie expiry via handleUnauthorized)
  // cleared the token but left the user staring at the same protected
  // page with no data, since nothing here ever re-routed on token
  // becoming null. Mirrors Landing.tsx's own isLoading-gated check.
  if (!isLoading && !token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-[100dvh] w-full bg-canvas text-ink overflow-hidden">
      {/* Sidebar - hidden on mobile, block on md+ */}
      <div className="hidden md:block w-[240px] flex-shrink-0">
        <DashboardSidebar />
      </div>

      {/* Mobile nav drawer — below md, the sidebar above is display:none,
          so this is the only way to reach Repositories/Settings/Logout
          on a phone-width viewport. Built with framer-motion (already a
          dependency everywhere else) instead of pulling in a Dialog
          library for one on/off panel. */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/60 z-40 md:hidden"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="fixed inset-y-0 left-0 z-50 md:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              <div className="relative h-full">
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close menu"
                  className="absolute top-3 -right-11 flex items-center justify-center w-9 h-9 rounded-full bg-canvas border border-hairline text-ink cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
                <DashboardSidebar onNavigate={() => setMobileNavOpen(false)} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-y-auto overflow-x-hidden">
        <DashboardTopbar onOpenMenu={() => setMobileNavOpen(true)} />
        <main className="flex-1 min-h-0 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

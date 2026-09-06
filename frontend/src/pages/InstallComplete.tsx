import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { Loader2 } from "lucide-react";
import { BrandLogo } from "../components/ui/BrandLogo";

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] } },
};

// Landing target for the GitHub App installation-callback redirect
// (repositories.controller.ts's installationCallback). Deliberately NOT
// at /repositories — that path is also a real backend JSON API endpoint
// (GET /repositories, bearer-token-gated), and nginx routes any
// /repositories* request to the backend regardless of intent, so a plain
// browser redirect there (no bearer token, since a redirect can't carry
// one) always 401s. This path avoids the collision entirely, then
// navigates to /repositories client-side (React Router, no server
// round-trip) once mounted.
export function InstallComplete() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/repositories", { replace: true });
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center h-dvh w-full bg-canvas text-ink gap-lg">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={itemVariants}
        className="flex flex-col items-center gap-md"
      >
        <BrandLogo className="w-9 h-9 text-ink" />
        <div className="flex items-center gap-xs text-mute">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[15px]">Finishing installation...</span>
        </div>
      </motion.div>
    </div>
  );
}

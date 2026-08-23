import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { BrandLogo } from "../components/ui/BrandLogo";

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] } },
};

export function AuthSuccess() {
  const navigate = useNavigate();
  const { refresh } = useAuth();

  useEffect(() => {
    // Regression: this used to read ?token=... from the URL — that's
    // the exact insecure flow the backend was fixed to stop doing
    // earlier this session (token-in-URL leaks via browser history,
    // Referer header, infra access logs). The backend now redirects
    // here with NO token param at all; the httpOnly refresh cookie
    // (set during the OAuth callback) is what actually proves the
    // login, and POST /auth/refresh mints the first access token from
    // it. Reading a URL param here always fails now — every login
    // attempt bounced straight back to /login.
    let cancelled = false;
    refresh().then((token) => {
      if (cancelled) return;
      navigate(token ? "/repositories" : "/login", { replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate, refresh]);

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
          <span className="text-[15px]">Signing you in...</span>
        </div>
      </motion.div>
    </div>
  );
}

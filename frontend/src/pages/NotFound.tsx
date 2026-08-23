import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { BrandLogo } from "../components/ui/BrandLogo";
import { Button } from "../components/ui/button";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } },
};

export function NotFound() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const homePath = token ? "/repositories" : "/";

  return (
    <div className="relative flex flex-col items-center justify-center h-dvh w-full bg-canvas text-ink px-lg text-center overflow-hidden">
      {/* Ambient glow — layered + blended per the design system's glow
          pattern, kept very subtle since this is a utility page, not a
          marketing surface. */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-[#0070f3] blur-[160px] opacity-[0.08] mix-blend-screen" />
      </div>

      <Link to={homePath} className="absolute top-lg left-lg flex items-center gap-xs text-ink">
        <BrandLogo className="w-5 h-5" />
        <span className="font-semibold text-[14px] tracking-tight">CodeTrace</span>
      </Link>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="relative z-10 flex flex-col items-center gap-lg"
      >
        <motion.p
          variants={itemVariants}
          className="text-[96px] sm:text-[128px] font-semibold leading-none tracking-[-0.04em] text-ink"
        >
          404
        </motion.p>

        <motion.div variants={itemVariants} className="space-y-xs">
          <h1 className="text-[20px] font-semibold tracking-tight text-ink">Page not found</h1>
          <p className="text-[14px] text-mute max-w-[360px] leading-relaxed">
            The page you're looking for doesn't exist or may have moved.
          </p>
        </motion.div>

        <motion.div variants={itemVariants} className="flex items-center gap-sm">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-xxs">
            <ArrowLeft className="w-3.5 h-3.5" />
            Go back
          </Button>
          <Button asChild variant="ghost" className="border border-hairline text-ink px-md">
            <Link to={homePath}>{token ? "Repositories" : "Home"}</Link>
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}

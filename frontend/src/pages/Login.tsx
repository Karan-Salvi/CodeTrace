import { Navigate, Link } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { BrandLogo } from "../components/ui/BrandLogo";
import { motion } from "framer-motion";
import type { Variants, Transition } from "framer-motion";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const BackIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M19 12H5" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

const pathTransition = (delay: number): Transition => ({
  pathLength: { duration: 2, ease: "easeInOut", delay },
  opacity: { duration: 2, ease: "easeInOut", delay },
  strokeDashoffset: {
    repeat: Infinity,
    duration: 30,
    ease: "linear",
    delay: delay + 1,
  },
});

export function Login() {
  const { token, isLoading } = useAuth();
  const [isHovering, setIsHovering] = useState(false);

  if (!isLoading && token) {
    return <Navigate to="/repositories" replace />;
  }

  const handleGithubLogin = () => {
    window.location.href = `${API_BASE_URL}/auth/github`;
  };

  return (
    <div className="flex h-screen w-full bg-canvas text-ink overflow-hidden">
      {/* Left Visual Section */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="hidden lg:flex lg:w-1/2 relative bg-canvas-soft border-r border-hairline items-center justify-center overflow-hidden"
      >
        {/* Ambient Light Blobs */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#10B981]/15 blur-[100px] pointer-events-none mix-blend-screen"
        />
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
          className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#3B82F6]/15 blur-[100px] pointer-events-none mix-blend-screen"
        />

        {/* Animated Background Paths */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <svg
            className="w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <motion.path
              initial={{
                pathLength: 0,
                opacity: 0,
                strokeDasharray: "100 200",
              }}
              animate={{ pathLength: 1, opacity: 1, strokeDashoffset: -1000 }}
              transition={pathTransition(0)}
              className="text-ink"
              d="M0,50 Q25,25 50,50 T100,50"
              stroke="currentColor"
              strokeWidth="0.5"
              fill="none"
            />
            <motion.path
              initial={{
                pathLength: 0,
                opacity: 0,
                strokeDasharray: "100 200",
              }}
              animate={{ pathLength: 1, opacity: 1, strokeDashoffset: -1000 }}
              transition={pathTransition(0.3)}
              className="text-ink"
              d="M0,70 Q25,95 50,70 T100,70"
              stroke="currentColor"
              strokeWidth="0.5"
              fill="none"
            />
            <motion.path
              initial={{
                pathLength: 0,
                opacity: 0,
                strokeDasharray: "100 200",
              }}
              animate={{ pathLength: 1, opacity: 1, strokeDashoffset: -1000 }}
              transition={pathTransition(0.6)}
              className="text-ink"
              d="M0,30 Q25,5 50,30 T100,30"
              stroke="currentColor"
              strokeWidth="0.5"
              fill="none"
            />
          </svg>
        </div>

        {/* Branding Overlay */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 p-xl flex flex-col h-full w-full text-ink justify-between"
        >
          <motion.div
            variants={itemVariants}
            className="flex items-center space-x-2"
          >
            <BrandLogo className="w-8 h-8" />
            <span className="font-semibold text-[24px] tracking-tight">
              CodeTrace
            </span>
          </motion.div>

          <div className="max-w-[480px]">
            <motion.h1
              variants={itemVariants}
              className="text-[48px] font-semibold leading-tight tracking-[-1.5px] mb-md text-ink"
            >
              Understand your codebase like never before.
            </motion.h1>
            <motion.p
              variants={itemVariants}
              className="text-[18px] text-body leading-relaxed"
            >
              Instantly search, navigate, and chat with your codebase using
              AI-powered semantic understanding. CodeTrace transforms your
              repositories into an interactive knowledge base.
            </motion.p>
          </div>

          <motion.div variants={itemVariants} className="text-[14px] text-mute">
            © {new Date().getFullYear()} CodeTrace Inc.
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Right Auth Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="w-full lg:w-1/2 flex flex-col p-lg lg:p-2xl relative bg-canvas justify-center items-center"
      >
        <Link
          to="/"
          className="absolute top-lg right-lg lg:top-xl lg:right-xl flex items-center space-x-2 text-[14px] font-medium text-mute hover:text-ink transition-colors"
        >
          <BackIcon className="w-4 h-4" />
          <span>Home</span>
        </Link>

        {/* Mobile Header */}
        <div className="absolute top-0 left-0 w-full p-lg flex lg:hidden items-center space-x-2">
          <BrandLogo className="w-6 h-6 text-primary" />
          <span className="font-semibold text-[20px] tracking-tight text-ink">
            CodeTrace
          </span>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-[400px] flex flex-col items-center mt-3xl lg:mt-0"
        >
          <motion.div
            variants={itemVariants}
            className="text-center mb-xl w-full"
          >
            <h2 className="text-[32px] font-semibold tracking-[-0.6px] text-ink mb-xs">
              Welcome back
            </h2>
            <p className="text-[16px] text-body">
              Log in to manage your repositories and settings.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="w-full space-y-md">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGithubLogin}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
              className="group relative flex w-full items-center justify-center space-x-3 rounded-md bg-primary px-sm py-[14px] text-[16px] font-medium text-on-primary transition-colors duration-200 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 shadow-sm cursor-pointer"
            >
              <GithubIcon
                className={`w-5 h-5 transition-transform duration-300 ${isHovering ? "rotate-[-10deg]" : ""}`}
              />
              <span>Continue with GitHub</span>
            </motion.button>
          </motion.div>

          <motion.p
            variants={itemVariants}
            className="mt-xl text-center text-[13px] text-mute"
          >
            By clicking continue, you agree to our{" "}
            <a
              href="#"
              className="underline underline-offset-2 hover:text-ink transition-colors"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="#"
              className="underline underline-offset-2 hover:text-ink transition-colors"
            >
              Privacy Policy
            </a>
            .
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  );
}

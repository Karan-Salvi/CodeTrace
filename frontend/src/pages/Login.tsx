import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { BrandMark } from "../components/ui/BrandMark";
import { ArrowLeft, Check, GitBranch, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const FEATURES = [
  [GitBranch, "Trace", "Call paths"],
  [ShieldCheck, "Review", "Ranked risk"],
  [Check, "Verify", "Line citations"],
] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 28 } },
};

export function Login() {
  const { token, isLoading } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  if (!isLoading && token) {
    return <Navigate to="/repositories" replace />;
  }

  const handleGithubLogin = () => {
    window.location.href = `${API_BASE_URL}/auth/github`;
  };

  return (
    <div className="font-landing grid min-h-screen bg-canvas text-ink lg:grid-cols-2">
      <section className="relative hidden min-h-screen overflow-hidden border-r border-hairline bg-canvas-soft-2 lg:flex lg:flex-col">
        <div className="bg-dot-grid pointer-events-none absolute inset-0 opacity-30" />
        {[
          "-left-[22%] top-[17%] rotate-6 border-ink/15",
          "-left-[20%] top-[32%] -rotate-6 border-ink/10",
          "-left-[18%] top-[47%] rotate-6 border-ink/15",
        ].map((cls, i) => (
          <motion.div
            key={cls}
            initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.1 }}
            className={`pointer-events-none absolute h-64 w-[125%] rounded-[50%] border ${cls}`}
          />
        ))}

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 flex h-full min-h-screen flex-col p-10 xl:p-14"
        >
          <motion.div variants={itemVariants}>
            <Link to="/" className="flex w-fit cursor-pointer items-center gap-3 text-base font-semibold" aria-label="CodeTrace home">
              <BrandMark /> CodeTrace
            </Link>
          </motion.div>

          <div className="my-auto max-w-144 py-20">
            <motion.p variants={itemVariants} className="section-label">
              Repository intelligence
            </motion.p>
            <motion.h1
              variants={itemVariants}
              className="mt-6 text-balance text-5xl font-semibold leading-[1.02] tracking-tight xl:text-6xl"
            >
              Understand the change before it ships.
            </motion.h1>
            <motion.p variants={itemVariants} className="mt-6 max-w-128 text-lg leading-8 text-body">
              Trace consequences across your codebase, review risk with exact evidence, and inspect every answer at the source.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="mt-10 grid max-w-128 grid-cols-3 gap-px overflow-hidden rounded-lg border border-hairline bg-hairline"
            >
              {FEATURES.map(([Icon, title, detail]) => (
                <div key={title} className="bg-canvas-soft-2 p-4">
                  <Icon size={15} className="text-positive" />
                  <p className="mt-4 text-sm font-medium text-ink">{title}</p>
                  <p className="mt-1 font-mono text-[10px] text-mute">{detail}</p>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div variants={itemVariants} className="relative flex items-center justify-between font-mono text-[10px] text-mute">
            <span>© 2026 CodeTrace</span>
            <span className="inline-flex items-center gap-2">
              <motion.span
                animate={shouldReduceMotion ? undefined : { opacity: [1, 0.4, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                className="size-1.5 rounded-full bg-positive"
              />
              Systems operational
            </span>
          </motion.div>
        </motion.div>
      </section>

      <section className="relative flex min-h-screen flex-col">
        <div className="flex h-20 items-center justify-between border-b border-hairline px-5 lg:border-b-0 lg:px-10">
          <Link to="/" className="flex cursor-pointer items-center gap-3 text-sm font-semibold lg:hidden" aria-label="CodeTrace home">
            <BrandMark /> CodeTrace
          </Link>
          <Link
            to="/"
            className="ml-auto flex h-9 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-medium text-body transition-colors hover:bg-canvas-soft hover:text-ink"
          >
            <ArrowLeft size={14} /> Home
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-14 sm:px-8">
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
            className="w-full max-w-80"
          >
            <div className="mb-9 lg:hidden">
              <p className="section-label">Repository intelligence</p>
              <p className="mt-3 max-w-80 text-sm leading-6 text-body">
                Review codebase-wide consequences with evidence you can inspect.
              </p>
            </div>

            <p className="font-mono text-[10px] uppercase text-positive">Secure access</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink">Welcome back.</h2>
            <p className="mt-3 text-sm leading-6 text-body">Continue with GitHub to manage repositories and review settings.</p>

            <motion.button
              onClick={handleGithubLogin}
              whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="mt-8 flex h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-pill bg-primary text-[15px] font-medium text-on-primary transition-opacity hover:opacity-90"
            >
              <GithubIcon className="size-[17px]" /> Continue with GitHub
            </motion.button>

            <div className="mt-3 border-t border-hairline pt-6">
              <div className="flex items-start gap-3 text-xs leading-5 text-body">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-positive" />
                <p>Repository access is limited to projects you explicitly select.</p>
              </div>
            </div>

            <p className="mt-8 text-center text-[11px] leading-5 text-body">
              By continuing, you agree to the{" "}
              <a href="#" className="cursor-pointer text-body underline underline-offset-4 hover:text-ink">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="cursor-pointer text-body underline underline-offset-4 hover:text-ink">
                Privacy Policy
              </a>
              .
            </p>
          </motion.div>
        </div>

        <div className="flex items-center justify-center gap-5 border-t border-hairline px-5 py-5 font-mono text-[10px] text-mute lg:border-t-0">
          <a href="#" className="cursor-pointer transition-colors hover:text-ink">
            Privacy
          </a>
          <span className="size-0.5 rounded-full bg-mute" />
          <a href="#" className="cursor-pointer transition-colors hover:text-ink">
            Support
          </a>
        </div>
      </section>
    </div>
  );
}

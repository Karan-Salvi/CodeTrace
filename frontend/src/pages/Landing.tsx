import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import {
  GitMerge,
  Search,
  ShieldCheck,
  Workflow,
  CheckCircle2,
  Terminal,
  Sparkles,
  Zap,
  Star,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Send,
  AtSign,
  Camera,
  MessageCircle,
  Video,
} from "lucide-react";
import { VercelNavbar } from "../components/ui/VercelNavbar";
import { BrandLogo } from "../components/ui/BrandLogo";

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
  </svg>
);

// --- Framer Motion Configurations ---
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 400, damping: 30 },
  },
};

const fadeInUp = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

// --- Helper Components ---
function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center space-x-xs mb-md">
      <div className="h-[1px] w-xl bg-[#0070f3]" />
      <span className="font-mono text-[12px] uppercase tracking-widest text-[#0070f3] font-medium">
        {children}
      </span>
      <div className="h-[1px] w-xl bg-[#0070f3]" />
    </div>
  );
}

function LivePRReview() {
  const [text, setText] = useState("");
  const fullText =
    "> Analyzing PR #42...\n> Found 1 logic error in auth.service.ts\n> Validating against context...\n> Citation verified. Generating review...";

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      setText(fullText.slice(0, i));
      i++;
      if (i > fullText.length) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      variants={itemVariants}
      className="mt-lg w-full max-w-[560px] rounded-[12px] bg-[#0a0a0c] border border-white/[0.08] p-md flex flex-col text-left shadow-[0_10px_30px_rgba(0,0,0,0.5)] mx-auto relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#0070f3]/50 to-transparent" />
      <div className="flex items-center space-x-xs mb-sm">
        <Terminal className="w-[14px] h-[14px] text-white/40" />
        <span className="font-mono text-[11px] text-white/40 uppercase tracking-widest">Live Execution</span>
        <Sparkles className="w-[12px] h-[12px] text-[#0070f3] ml-auto animate-pulse" />
      </div>
      <pre className="font-mono text-[13px] text-white/70 whitespace-pre-wrap leading-relaxed h-[80px]">
        {text}
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
          className="inline-block w-[6px] h-[14px] bg-[#0070f3] ml-[4px] align-middle"
        />
      </pre>
    </motion.div>
  );
}

const LOGO_NAMES = ["Vercel", "Linear", "Framer", "Stripe", "Supabase"];

function LogoStrip() {
  return (
    <motion.div variants={itemVariants} className="w-full mt-3xl">
      <p className="text-center font-mono text-[11px] uppercase tracking-widest text-white/30 mb-lg">
        Engineers from teams shipping with CodeTrace
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-3xl gap-y-md opacity-50">
        {LOGO_NAMES.map((name) => (
          <span key={name} className="font-mono text-[15px] font-semibold text-white/70 tracking-tight">
            {name}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

const DEV_POWER_CARDS = [
  {
    icon: Zap,
    title: "Index a repo in seconds",
    description: "Connect via GitHub App. Tree-sitter chunks JS/TS/Python at function boundaries, no manual config.",
  },
  {
    icon: Search,
    title: "Ask anything, get cited answers",
    description: "Hybrid retrieval finds the real chunk. Every answer links back to file:line — never a guess.",
  },
  {
    icon: GitMerge,
    title: "Reviews that respect your time",
    description: "Only BUG, SECURITY, PERFORMANCE, LOGIC, TESTING, MAINTAINABILITY — never a freeform style nit.",
  },
];

function DevPowerGrid() {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={fadeInUp}
      className="grid grid-cols-1 md:grid-cols-3 gap-lg mt-3xl"
    >
      {DEV_POWER_CARDS.map((card) => (
        <motion.div
          key={card.title}
          variants={itemVariants}
          whileHover={{ y: -5 }}
          className="p-xl rounded-[16px] bg-[#0a0a0c] border border-white/[0.08] flex flex-col transition-all group"
        >
          <div className="w-2xl h-2xl rounded-[10px] bg-[#0070f3]/10 border border-[#0070f3]/20 flex items-center justify-center mb-lg group-hover:bg-[#0070f3]/20 transition-colors">
            <card.icon className="w-lg h-lg text-[#0070f3]" />
          </div>
          <h3 className="text-[18px] font-semibold text-white mb-xs">{card.title}</h3>
          <p className="text-[14px] text-white/50 leading-relaxed">{card.description}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}

const TECH_STACK = ["JS", "TS", "PY"];

function TechStackRow() {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={fadeInUp}
      className="flex flex-col items-center text-center mt-6xl"
    >
      <motion.h3 variants={itemVariants} className="text-[22px] font-semibold text-white mb-xs">
        Built for real codebases
      </motion.h3>
      <motion.p variants={itemVariants} className="text-[14px] text-white/50 max-w-[480px] mb-xl">
        Deliberately scoped to JavaScript, TypeScript, and Python — no shallow half-support across a dozen
        languages. Deep parsing, not string matching.
      </motion.p>
      <motion.div variants={itemVariants} className="flex items-center gap-md">
        {TECH_STACK.map((tag) => (
          <div
            key={tag}
            className="w-3xl h-3xl rounded-[12px] bg-[#0a0a0c] border border-white/[0.08] flex items-center justify-center font-mono text-[13px] font-semibold text-white/70 hover:border-[#0070f3]/40 hover:text-[#0070f3] transition-colors"
          >
            {tag}
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}

const PROMPT_CATEGORIES = [
  { label: "Auth", count: 8, chips: ["Where is the JWT verified?", "Who calls handleAuthError?"] },
  { label: "Retrieval", count: 5, chips: ["How does hybrid search rank results?", "Explain the RRF merge step"] },
  { label: "PR Review", count: 12, chips: ["What triggers a HIGH risk score?", "Show the last review's findings"] },
];

function AskYourCodebaseDemo() {
  const [active, setActive] = useState(0);

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={fadeInUp}
      className="w-full max-w-[720px] mx-auto rounded-[16px] bg-[#0a0a0c] border border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden relative"
    >
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#0070f3]/[0.04] to-transparent" />
      <div className="relative flex items-center gap-sm px-lg py-md border-b border-white/[0.05]">
        <Search className="w-md h-md text-white/30 flex-shrink-0" />
        <span className="text-[14px] text-white/30 flex-1 text-left">Type something to ask your codebase</span>
        <div className="w-2xl h-2xl rounded-full bg-[#0070f3] flex items-center justify-center flex-shrink-0">
          <Send className="w-[14px] h-[14px] text-white" />
        </div>
      </div>
      <div className="relative p-lg flex flex-col gap-sm">
        {PROMPT_CATEGORIES.map((cat, i) => (
          <div key={cat.label}>
            <button
              onClick={() => setActive(i)}
              className={`flex items-center gap-xs text-[13px] font-medium mb-xs transition-colors cursor-pointer ${
                active === i ? "text-[#0070f3]" : "text-white/50 hover:text-white/80"
              }`}
            >
              <span
                className={`w-[6px] h-[6px] rounded-full ${active === i ? "bg-[#0070f3]" : "bg-white/20"}`}
              />
              {cat.label}
              <span className="text-white/30 font-mono text-[11px]">({cat.count})</span>
            </button>
            {active === i && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex flex-wrap gap-xs pl-md mb-xs"
              >
                {cat.chips.map((chip) => (
                  <span
                    key={chip}
                    className="px-sm py-xxs rounded-full border border-white/[0.08] bg-white/[0.03] text-[12px] text-white/60 hover:border-[#0070f3]/40 hover:text-white transition-colors cursor-pointer"
                  >
                    {chip}
                  </span>
                ))}
              </motion.div>
            )}
          </div>
        ))}
      </div>
      <div className="relative px-lg pb-lg pt-sm border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-sm">
        <p className="text-[13px] text-white/40 text-center sm:text-left">
          Every answer cites the exact file and line it came from — never an unverified claim.
        </p>
        <div className="flex items-center gap-sm flex-shrink-0">
          <button className="px-md h-2xl rounded-full bg-white text-[#171717] text-[13px] font-medium hover:bg-white/90 transition-colors cursor-pointer">
            See Demo
          </button>
        </div>
      </div>
    </motion.div>
  );
}

const TESTIMONIALS = [
  {
    quote:
      "It caught a race condition in our webhook handler that three of us reviewed and missed. The citation linked straight to the line.",
    name: "M. Alvarez",
    role: "Backend Engineer",
    rating: 5,
  },
  {
    quote:
      "First code-review bot that doesn't drown us in style nits. Every finding is one of six real categories, with a risk score I actually trust.",
    name: "R. Okafor",
    role: "Staff Engineer",
    rating: 5,
  },
  {
    quote:
      "Incremental re-indexing on push is the part that sold me. A one-line change doesn't re-embed the whole file.",
    name: "J. Lindqvist",
    role: "Platform Lead",
    rating: 4,
  },
  {
    quote: "Asked it where a token gets validated and got the exact function, with line numbers. No hallucinated APIs.",
    name: "S. Chen",
    role: "Frontend Engineer",
    rating: 5,
  },
];

function Testimonials() {
  const [start, setStart] = useState(0);
  const visible = 3;

  const next = () => setStart((s) => (s + 1) % TESTIMONIALS.length);
  const prev = () => setStart((s) => (s - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);

  const shown = Array.from({ length: visible }, (_, i) => TESTIMONIALS[(start + i) % TESTIMONIALS.length]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-xl flex-wrap gap-md">
        <h2 className="text-[32px] font-semibold tracking-[-0.03em] text-white text-left">
          Honest review from devs
        </h2>
        <div className="flex items-center gap-sm">
          <span className="text-[28px] font-semibold text-[#0070f3]">92%</span>
          <span className="text-[13px] text-white/50 leading-tight max-w-[140px]">
            Positive feedback after early access
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
        {shown.map((t) => (
          <div
            key={t.name}
            className="p-lg rounded-[14px] bg-[#0a0a0c] border border-white/[0.08] flex flex-col justify-between"
          >
            <div>
              <div className="flex gap-[2px] mb-sm">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={`w-[13px] h-[13px] ${
                      i < t.rating ? "fill-[#0070f3] text-[#0070f3]" : "text-white/15"
                    }`}
                  />
                ))}
              </div>
              <p className="text-[14px] text-white/70 leading-relaxed mb-lg">"{t.quote}"</p>
            </div>
            <div className="flex items-center gap-sm">
              <div className="w-2xl h-2xl rounded-full bg-white/10 flex items-center justify-center font-mono text-[11px] text-white/60">
                {t.name.split(" ").map((p) => p[0]).join("")}
              </div>
              <div>
                <p className="text-[13px] font-medium text-white">{t.name}</p>
                <p className="text-[12px] text-white/40">{t.role}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-sm mt-lg">
        <button
          onClick={prev}
          aria-label="Previous testimonials"
          className="w-2xl h-2xl rounded-full border border-white/[0.08] flex items-center justify-center text-white/50 hover:text-white hover:border-white/20 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-md h-md" />
        </button>
        <button
          onClick={next}
          aria-label="Next testimonials"
          className="w-2xl h-2xl rounded-full border border-white/[0.08] flex items-center justify-center text-white/50 hover:text-white hover:border-white/20 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-md h-md" />
        </button>
      </div>
    </div>
  );
}

const PRICING_TIERS = [
  {
    name: "For personals",
    monthly: 0,
    annual: 0,
    tagline: "Perfect for individuals and small teams",
    features: [
      "1 connected repository",
      "50 chat questions / month",
      "Community support",
      "Public repos only",
    ],
    cta: "Free Access",
  },
  {
    name: "For teams",
    monthly: 19,
    annual: 15,
    tagline: "Perfect for growing engineering teams",
    features: [
      "Unlimited connected repositories",
      "Unlimited chat & PR reviews",
      "Private repos included",
      "Priority support",
      "Risk-scored PR reviews with write-back",
    ],
    cta: "Purchase Plan",
  },
];

function PricingSection() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="w-full flex flex-col items-center">
      <div className="flex items-center gap-md mb-3xl">
        <span className={`text-[14px] font-medium ${!annual ? "text-white" : "text-white/40"}`}>Monthly</span>
        <button
          onClick={() => setAnnual((a) => !a)}
          aria-label="Toggle annual billing"
          className={`relative w-[44px] h-[24px] rounded-full transition-colors cursor-pointer ${
            annual ? "bg-[#0070f3]" : "bg-white/15"
          }`}
        >
          <span
            className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-transform ${
              annual ? "translate-x-[23px]" : "translate-x-[3px]"
            }`}
          />
        </button>
        <span className={`text-[14px] font-medium flex items-center gap-xs ${annual ? "text-white" : "text-white/40"}`}>
          Annual
          <span className="px-xs py-[1px] rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-mono">
            Save 20%
          </span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-lg w-full max-w-[720px]">
        {PRICING_TIERS.map((tier, i) => (
          <div
            key={tier.name}
            className={`p-2xl rounded-[16px] flex flex-col ${
              i === 1
                ? "bg-[#0a0a0c] border border-[#0070f3]/40 shadow-[0_0_40px_-10px_rgba(0,112,243,0.3)]"
                : "bg-[#0a0a0c] border border-white/[0.08]"
            }`}
          >
            <h3 className="text-[15px] font-medium text-white/70 mb-sm">{tier.name}</h3>
            <div className="flex items-baseline gap-xxs mb-xs">
              <span className="text-[40px] font-semibold text-white tracking-[-0.03em]">
                ${annual ? tier.annual : tier.monthly}
              </span>
              <span className="text-[14px] text-white/40">/month</span>
            </div>
            <p className="text-[13px] text-white/40 mb-xl">{tier.tagline}</p>
            <ul className="flex flex-col gap-sm mb-2xl flex-1">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-xs text-[13px] text-white/70">
                  <Check className="w-md h-md text-[#0070f3] flex-shrink-0 mt-[1px]" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              className={`h-3xl rounded-[100px] text-[14px] font-medium transition-all cursor-pointer ${
                i === 1
                  ? "bg-[#0070f3] text-white hover:bg-[#0070f3]/90"
                  : "bg-white/[0.06] text-white border border-white/[0.08] hover:bg-white/10"
              }`}
            >
              {tier.cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const FAQ_TABS = ["General", "Features", "Usage Policy", "Pricing", "Community"] as const;

const FAQ_ITEMS: Record<(typeof FAQ_TABS)[number], { q: string; a: string }[]> = {
  General: [
    {
      q: "How does CodeTrace authenticate with GitHub?",
      a: "A GitHub App (not a personal access token) with short-lived, encrypted-at-rest installation tokens. Login (OAuth) is separate from installation — every repository-scoped request re-checks ownership, a valid session proves identity, not access.",
    },
    {
      q: "Which languages are supported?",
      a: "JavaScript, TypeScript, and Python — deliberately, not a gap we're filling. Deep Tree-sitter parsing at function/class boundaries beats shallow support across many languages.",
    },
  ],
  Features: [
    {
      q: "How does incremental indexing work?",
      a: "A verified, deduped push webhook triggers chunk-level (not file-level) diffing — a one-line change in a 2,000-line file only re-embeds the touched function.",
    },
    {
      q: "How are PR review findings categorized?",
      a: "Strictly BUG, SECURITY, PERFORMANCE, LOGIC, TESTING, or MAINTAINABILITY — never a freeform style nit. Risk score is an explainable additive point model, never an opaque number.",
    },
  ],
  "Usage Policy": [
    {
      q: "Is my repository content used to train models?",
      a: "No. Repository content is always treated as untrusted data for the LLM, never as instructions, and is never used for model training.",
    },
    {
      q: "What happens to secrets in my repo?",
      a: "Secret/key files (.env, .pem, .key, secrets.*, credentials.*) are excluded before chunking or embedding, enforced at ingestion — not a downstream filter.",
    },
  ],
  Pricing: [
    {
      q: "Can I cancel anytime?",
      a: "Yes — plans are month-to-month with no lock-in on the Team tier, and the Personal tier is free indefinitely for public repos.",
    },
    {
      q: "Do you offer team or usage-based pricing?",
      a: "Reach out via Contact — we're happy to talk about larger org needs beyond the two listed tiers.",
    },
  ],
  Community: [
    {
      q: "Where can I ask questions or report bugs?",
      a: "Open an issue on GitHub, or reach the team directly through the Contact link in the navigation.",
    },
    {
      q: "Is CodeTrace open source?",
      a: "The core platform is closed-source today; we're evaluating open-sourcing individual components as the project matures.",
    },
  ],
};

function FaqSection() {
  const [tab, setTab] = useState<(typeof FAQ_TABS)[number]>("General");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const items = FAQ_ITEMS[tab];

  return (
    <div className="w-full max-w-[720px] mx-auto">
      <div className="flex flex-wrap items-center justify-center gap-xs mb-3xl">
        {FAQ_TABS.map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setOpenIndex(0);
            }}
            className={`px-md py-xs rounded-full text-[13px] font-medium transition-colors cursor-pointer ${
              tab === t ? "bg-white text-[#171717]" : "text-white/50 hover:text-white hover:bg-white/[0.05]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-xs">
        {items.map((item, i) => (
          <div key={item.q} className="rounded-[12px] bg-[#0a0a0c] border border-white/[0.08] overflow-hidden">
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between px-lg py-md text-left cursor-pointer"
            >
              <span className="text-[14px] font-medium text-white">{item.q}</span>
              <ChevronDown
                className={`w-md h-md text-white/40 flex-shrink-0 transition-transform ${
                  openIndex === i ? "rotate-180" : ""
                }`}
              />
            </button>
            {openIndex === i && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="px-lg pb-md"
              >
                <p className="text-[13px] text-white/50 leading-relaxed">{item.a}</p>
              </motion.div>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-[13px] text-white/40 mt-2xl">
        For unanswered questions, reach out to our support team on{" "}
        <a href="#" className="text-[#0070f3] hover:underline">Discord</a>. We'll respond as soon as possible.
      </p>
    </div>
  );
}

// --- Main Page Component ---
export function Landing() {
  const { token, isLoading } = useAuth();
  const navigate = useNavigate();

  if (!isLoading && token) {
    return <Navigate to="/repositories" replace />;
  }

  const handleLogin = () => {
    navigate("/login");
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#020203] to-[#0a0a0f] text-white selection:bg-[#0070f3] selection:text-white overflow-hidden font-sans">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Diagonal wash from the top-right corner, matching the reference's
            corner-anchored gradient rather than a centered glow */}
        <div className="absolute inset-0 bg-gradient-to-bl from-[#0070f3]/40 via-[#0070f3]/5 to-transparent" />
        <motion.div
          animate={{ opacity: [0.35, 0.5, 0.35] }}
          transition={{ duration: 8, ease: "easeInOut", repeat: Infinity }}
          className="absolute -top-[30%] -right-[15%] w-[900px] h-[900px] rounded-full bg-[#0070f3] blur-[180px] mix-blend-screen"
        />
        <div className="absolute -top-[10%] right-[5%] w-[400px] h-[400px] rounded-full bg-[#0ea5e9] blur-[130px] opacity-30 mix-blend-screen" />
      </div>

      <VercelNavbar />

      <main className="relative z-10 flex flex-col items-center">
        {/* Hero */}
        <section className="w-full max-w-[1200px] px-lg lg:px-3xl pt-6xl pb-5xl flex flex-col items-center text-center">
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="max-w-[896px] flex flex-col items-center">
            <motion.div variants={itemVariants}>
              <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-sm py-xxs text-[12px] font-mono text-white/60 mb-xl backdrop-blur-sm shadow-sm">
                <span className="flex h-[6px] w-[6px] rounded-full bg-[#0070f3] mr-xs"></span>
                Syntax-Level PR Review Copilot
              </span>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="text-[40px] sm:text-[56px] lg:text-[64px] font-semibold leading-[1.05] tracking-[-0.04em] text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/50 mb-lg"
            >
              Review Pull Requests Faster And Trust Every Citation
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="text-[16px] sm:text-[18px] text-white/60 max-w-[672px] mb-2xl leading-relaxed font-normal"
            >
              CodeTrace indexes your GitHub repositories at the syntax level and delivers risk-scored PR
              reviews and cited answers — in minutes, not a full-repo dump.
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center gap-md w-full sm:w-auto">
              <button
                onClick={handleLogin}
                className="group relative flex items-center justify-center h-3xl rounded-[100px] bg-white px-xl text-[15px] font-medium text-[#171717] transition-all hover:scale-[1.02] hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white w-full sm:w-auto overflow-hidden shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] cursor-pointer"
              >
                <GithubIcon className="w-[20px] h-[20px] flex-shrink-0 mr-xs fill-current" />
                Get Started
              </button>

              <a
                href="#pipeline"
                className="flex items-center justify-center h-3xl rounded-[100px] border border-white/20 bg-transparent px-xl text-[15px] font-medium text-white transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 w-full sm:w-auto cursor-pointer"
              >
                See how it works
              </a>
            </motion.div>

            <LivePRReview />
            <LogoStrip />
          </motion.div>
        </section>

        {/* Unleash Your Dev Power */}
        <section id="features" className="w-full max-w-[1000px] px-lg lg:px-3xl py-6xl border-t border-white/[0.08] text-center">
          <SectionEyebrow>AI Advantage</SectionEyebrow>
          <h2 className="text-[32px] font-semibold tracking-[-0.03em] leading-tight text-white max-w-[600px] mx-auto">
            Unleash Your Dev Power With AI Precision
          </h2>
          <p className="text-[16px] text-white/50 max-w-[560px] mx-auto mt-md">
            Combine syntax-aware indexing with citation-validated retrieval. Ship reviews faster, trust every
            claim.
          </p>
          <DevPowerGrid />
          <TechStackRow />
        </section>

        {/* Ask your codebase / prompting */}
        <section className="relative w-full max-w-[1200px] px-lg lg:px-3xl py-6xl text-center overflow-hidden">
          <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
            <div className="w-[900px] h-[500px] rounded-full bg-[#0070f3] blur-[160px] opacity-25 mix-blend-screen" />
          </div>
          <div className="relative z-10">
            <SectionEyebrow>Chat</SectionEyebrow>
            <h2 className="text-[32px] font-semibold tracking-[-0.03em] mb-2xl text-white">
              More powerful with your <span className="text-[#0070f3]">codebase</span>
            </h2>
            <AskYourCodebaseDemo />
          </div>
        </section>

        {/* Problem */}
        <section id="about" className="w-full max-w-[1000px] px-lg lg:px-3xl py-6xl border-t border-white/[0.08]">
          <div className="grid md:grid-cols-2 gap-3xl items-center">
            <div>
              <SectionEyebrow>The Problem</SectionEyebrow>
              <h2 className="text-[32px] font-semibold tracking-[-0.03em] leading-tight text-white mb-lg">
                Hallucinations break trust. Full-repo dumps break scale.
              </h2>
            </div>
            <div>
              <p className="text-[16px] text-white/60 leading-relaxed mb-md">
                Most AI code tools either hallucinate answers with no way to verify them, or attempt naive
                full-repository context dumps that fail on large codebases.
              </p>
              <p className="text-[16px] text-white/60 leading-relaxed">
                CodeTrace guarantees trust through <strong>citation validation</strong>. If the LLM generates a
                claim, it is strictly validated against the retrieved chunk boundaries before you ever see it.
              </p>
            </div>
          </div>
        </section>

        {/* Pipeline */}
        <section id="pipeline" className="w-full max-w-[1200px] px-lg lg:px-3xl py-6xl border-t border-white/[0.08]">
          <SectionEyebrow>Architecture</SectionEyebrow>
          <h2 className="text-[32px] font-semibold tracking-[-0.03em] mb-3xl text-white text-center">
            The Indexing Pipeline
          </h2>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={fadeInUp}
            className="grid grid-cols-1 md:grid-cols-5 gap-md"
          >
            <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="flex flex-col p-lg rounded-[12px] bg-[#0a0a0c] border border-white/[0.08] shadow-[0_2px_10px_rgba(0,0,0,0.5)] transition-all group">
              <div className="w-xl h-xl rounded-full bg-white/10 flex items-center justify-center mb-md text-white/80 font-mono text-[12px] group-hover:bg-[#0070f3]/20 group-hover:text-[#0070f3] transition-colors">01</div>
              <h3 className="text-[16px] font-medium text-white mb-xs">Indexing</h3>
              <p className="text-[14px] text-white/50 leading-relaxed">Clones via short-lived GitHub App tokens.</p>
            </motion.div>

            <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="flex flex-col p-lg rounded-[12px] bg-[#0a0a0c] border border-white/[0.08] shadow-[0_2px_10px_rgba(0,0,0,0.5)] transition-all group">
              <div className="w-xl h-xl rounded-full bg-white/10 flex items-center justify-center mb-md text-white/80 font-mono text-[12px] group-hover:bg-[#0070f3]/20 group-hover:text-[#0070f3] transition-colors">02</div>
              <h3 className="text-[16px] font-medium text-white mb-xs">Chunking</h3>
              <p className="text-[14px] text-white/50 leading-relaxed">Tree-sitter parses JS/TS/Python strictly at function & class boundaries.</p>
            </motion.div>

            <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="flex flex-col p-lg rounded-[12px] bg-[#0a0a0c] border border-white/[0.08] relative transition-all group">
              <div className="absolute inset-0 bg-[#0070f3]/5 rounded-[12px] pointer-events-none group-hover:bg-[#0070f3]/10 transition-colors" />
              <div className="w-xl h-xl rounded-full bg-[#0070f3]/20 flex items-center justify-center mb-md text-[#0070f3] font-mono text-[12px]">03</div>
              <h3 className="text-[16px] font-medium text-white mb-xs">Embedding</h3>
              <p className="text-[14px] text-white/50 leading-relaxed">Hashed by content with cross-repo cache reuse.</p>
            </motion.div>

            <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="flex flex-col p-lg rounded-[12px] bg-[#0a0a0c] border border-white/[0.08] shadow-[0_2px_10px_rgba(0,0,0,0.5)] transition-all group">
              <div className="w-xl h-xl rounded-full bg-white/10 flex items-center justify-center mb-md text-white/80 font-mono text-[12px] group-hover:bg-[#0070f3]/20 group-hover:text-[#0070f3] transition-colors">04</div>
              <h3 className="text-[16px] font-medium text-white mb-xs">Retrieval</h3>
              <p className="text-[14px] text-white/50 leading-relaxed">Hybrid pgvector + full-text, merged by RRF & reranked.</p>
            </motion.div>

            <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="flex flex-col p-lg rounded-[12px] bg-white border border-white shadow-[0_4px_20px_rgba(255,255,255,0.1)] transition-all group hover:shadow-[0_4px_30px_rgba(255,255,255,0.2)]">
              <div className="w-xl h-xl rounded-full bg-black/10 flex items-center justify-center mb-md text-black font-mono text-[12px]">05</div>
              <h3 className="text-[16px] font-medium text-black mb-xs">Citation Validation</h3>
              <p className="text-[14px] text-black/70 leading-relaxed">Unsupported claims are stripped. Verified evidence is served.</p>
            </motion.div>
          </motion.div>
        </section>

        {/* Capabilities */}
        <section className="w-full max-w-[1200px] px-lg lg:px-3xl py-6xl border-t border-white/[0.08]">
          <SectionEyebrow>Capabilities</SectionEyebrow>
          <h2 className="text-[32px] font-semibold tracking-[-0.03em] mb-3xl text-white text-center">
            Engineered for precision.
          </h2>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={fadeInUp}
            className="grid grid-cols-1 md:grid-cols-3 gap-lg"
          >
            <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="md:col-span-2 p-2xl rounded-[16px] bg-[#0a0a0c] border border-white/[0.08] flex flex-col justify-between group transition-all">
              <div className="mb-3xl">
                <Workflow className="w-xl h-xl text-[#0070f3] mb-lg transition-transform group-hover:scale-110" />
                <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-white mb-xs">Chunk-level incremental indexing</h3>
                <p className="text-[16px] text-white/60 leading-relaxed max-w-[672px]">
                  Triggered by a verified GitHub push webhook, CodeTrace performs chunk-level diffing. A
                  one-line change in a 2,000-line file only re-embeds the one touched function, not the whole
                  file.
                </p>
              </div>
              <div className="w-full h-[128px] rounded-[8px] bg-[#111111] border border-white/[0.05] p-lg font-mono text-[13px] text-white/70 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-xxs h-full bg-[#0070f3]" />
                <div className="text-white/40 mb-xs">{"// Webhook payload received"}</div>
                <div><span className="text-[#0070f3]">Diff</span> computed: 1 function modified</div>
                <div><span className="text-white">Hash matching:</span> Cache hit for 42 untouched chunks</div>
                <div><span className="text-emerald-400">Re-embedded:</span> 1 chunk in 45ms</div>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="p-2xl rounded-[16px] bg-[#0a0a0c] border border-white/[0.08] flex flex-col group relative overflow-hidden transition-all">
              <div className="absolute top-0 right-0 p-lg opacity-10 group-hover:opacity-20 transition-opacity">
                <CheckCircle2 className="w-[96px] h-[96px] text-white" />
              </div>
              <CheckCircle2 className="w-xl h-xl text-white mb-lg relative z-10 transition-transform group-hover:scale-110 group-hover:text-emerald-400" />
              <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-white mb-xs relative z-10">Citation-validated answers</h3>
              <p className="text-[15px] text-white/60 leading-relaxed relative z-10">
                Every citation emitted by the LLM is re-validated against what was retrieved. The file must
                exist, and the line numbers must be real.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="p-2xl rounded-[16px] bg-[#0a0a0c] border border-white/[0.08] flex flex-col group transition-all">
              <GitMerge className="w-xl h-xl text-white mb-lg transition-transform group-hover:scale-110" />
              <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-white mb-xs">Risk-scored PR reviews</h3>
              <p className="text-[15px] text-white/60 leading-relaxed mb-lg">
                Uses one-hop dependency retrieval to generate contextual reviews. Findings are strictly
                categorized into BUG, SECURITY, PERFORMANCE, LOGIC, TESTING, and MAINTAINABILITY.
              </p>
              <div className="mt-auto flex items-center space-x-xs">
                <span className="px-[8px] py-[4px] rounded bg-rose-500/10 text-rose-400 text-[11px] font-mono border border-rose-500/20 group-hover:bg-rose-500/20 transition-colors">HIGH RISK (85/100)</span>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="p-2xl rounded-[16px] bg-[#0a0a0c] border border-white/[0.08] flex flex-col group transition-all">
              <Search className="w-xl h-xl text-white mb-lg transition-transform group-hover:scale-110" />
              <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-white mb-xs">Hybrid retrieval + reranking</h3>
              <p className="text-[15px] text-white/60 leading-relaxed">
                Combines pgvector cosine similarity with Postgres full-text search. Results are merged via
                Reciprocal Rank Fusion and reranked to the top 5-8 chunks.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="p-2xl rounded-[16px] bg-[#0a0a0c] border border-white/[0.08] flex flex-col group transition-all">
              <ShieldCheck className="w-xl h-xl text-white mb-lg transition-transform group-hover:scale-110" />
              <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-white mb-xs">Zero-trust security model</h3>
              <p className="text-[15px] text-white/60 leading-relaxed">
                Uses short-lived installation tokens. Webhooks are HMAC-verified. Secret files (`.env`, `.pem`)
                are explicitly excluded. All repository content is treated as untrusted data.
              </p>
            </motion.div>
          </motion.div>
        </section>

        {/* Testimonials */}
        <section className="w-full max-w-[1000px] px-lg lg:px-3xl py-6xl border-t border-white/[0.08]">
          <Testimonials />
        </section>

        {/* Pricing */}
        <section id="pricing" className="relative w-full max-w-[1000px] px-lg lg:px-3xl py-6xl border-t border-white/[0.08] text-center overflow-hidden">
          <div className="absolute inset-0 flex justify-center items-start pointer-events-none">
            <div className="w-[700px] h-[400px] rounded-full bg-[#0070f3] blur-[150px] opacity-15 mix-blend-screen" />
          </div>
          <div className="relative z-10">
            <SectionEyebrow>Pricing</SectionEyebrow>
            <h2 className="text-[32px] font-semibold tracking-[-0.03em] mb-3xl text-white">
              Find your perfect plan
            </h2>
            <PricingSection />
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="w-full max-w-[1000px] px-lg lg:px-3xl py-6xl border-t border-white/[0.08] text-center">
          <SectionEyebrow>FAQ</SectionEyebrow>
          <h2 className="text-[32px] font-semibold tracking-[-0.03em] mb-3xl text-white">
            Frequently Asked Question
          </h2>
          <FaqSection />
        </section>

      </main>

      {/* Final CTA + footer share ONE continuous ambient-glow background —
          previously each had its own clipped, locally-scoped glow div,
          which is exactly what produced the hard rectangular seam where
          one section's background ended and the next began. A single
          layered glow behind both, with no per-section overflow-hidden
          restart, is what makes it read as one surface instead of two
          stacked blue blocks. */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          {/* Layer 1: large central glow, brightest point — matched to the
              Pricing section's glow intensity (opacity-15) so the footer
              doesn't read darker/bluer than the rest of the page */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1600px] h-[900px] rounded-full bg-[#0864e0] blur-[180px] opacity-15 mix-blend-screen" />
          {/* Layer 2: weaker glow, slightly lower, widens the spread */}
          <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[1200px] h-[700px] rounded-full bg-[#1c5fc4] blur-[160px] opacity-10 mix-blend-screen" />
          {/* Layer 3: subtle top-center highlight */}
          <div className="absolute -top-[5%] left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full bg-[#4a8fef] blur-[130px] opacity-10 mix-blend-screen" />
          {/* Vignette: pulls the far edges back to near-black so the glow reads as centered light, not a block */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,transparent_0%,transparent_35%,#020203_85%)]" />
        </div>

        {/* Final CTA */}
        <section className="w-full px-lg lg:px-3xl pt-6xl pb-[120px] flex flex-col items-center text-center relative z-10">
          <h2 className="text-[36px] sm:text-[40px] font-semibold tracking-[-0.03em] mb-md text-white">
            Take the Shortcut way to Production
          </h2>
          <p className="text-[15px] text-white/50 mb-xl max-w-[480px] mx-auto leading-relaxed">
            <strong className="text-white/70 font-medium">Join engineers using CodeTrace</strong> to turn pull
            requests into cited, risk-scored reviews — faster.
            <br />
            No full-repo dumps. No hallucinated claims. Just evidence.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-md">
            <button
              onClick={handleLogin}
              className="inline-flex items-center justify-center h-3xl rounded-[100px] bg-white px-2xl text-[16px] font-medium text-[#171717] transition-all hover:scale-[1.02] hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white shadow-[0_0_30px_-5px_rgba(255,255,255,0.2)] cursor-pointer"
            >
              <GithubIcon className="w-[20px] h-[20px] flex-shrink-0 mr-sm fill-current" />
              Get Started
            </button>
            <a
              href="#faq"
              className="inline-flex items-center justify-center h-3xl rounded-[100px] border border-white/20 bg-transparent px-2xl text-[16px] font-medium text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Join Community
            </a>
          </div>
        </section>

        {/* Hairline divider — a subtle illuminated edge, not a hard section
            border. Zero-height so it never adds spacing; the glow is a
            separate absolutely-positioned layer centered on the line. */}
        <div className="relative z-10 w-full h-0">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-[6px] -translate-y-1/2 bg-gradient-to-r from-transparent via-[#5b9dff]/25 to-transparent blur-[3px]" />
        </div>

        <footer className="w-full relative pt-6xl pb-2xl px-lg lg:px-3xl z-10">
          <div className="w-full max-w-[1200px] mx-auto flex flex-col md:flex-row md:items-start justify-between gap-3xl mb-5xl relative z-10">
          <div className="flex flex-col">
            <div className="flex items-center space-x-sm mb-xl">
              <span className="flex items-center justify-center w-[36px] h-[36px] rounded-[10px] bg-[#0070f3]">
                <BrandLogo className="w-[18px] h-[18px] fill-none text-white" />
              </span>
              <span className="text-[22px] font-semibold text-white">CodeTrace</span>
            </div>
            <p className="text-white/90 text-[26px] font-medium leading-snug max-w-[340px]">
              Review Pull Requests Faster
              <br />
              and Trust Every Citation
            </p>
          </div>

          <div className="grid grid-cols-3 gap-md sm:gap-3xl md:gap-4xl">
            <div className="flex flex-col">
              <h4 className="text-[13px] font-medium text-white/45 mb-md">Resources</h4>
              <ul className="flex flex-col space-y-md">
                <li><a href="#" className="text-[14px] text-white/80 hover:text-white transition-colors cursor-pointer">Docs</a></li>
                <li><a href="#faq" className="text-[14px] text-white/80 hover:text-white transition-colors cursor-pointer">Community</a></li>
                <li><a href="#pricing" className="text-[14px] text-white/80 hover:text-white transition-colors cursor-pointer">Pricing</a></li>
                <li><a href="#" className="text-[14px] text-white/80 hover:text-white transition-colors cursor-pointer">Changelog</a></li>
              </ul>
            </div>

            <div className="flex flex-col">
              <h4 className="text-[13px] font-medium text-white/45 mb-md">Company</h4>
              <ul className="flex flex-col space-y-md">
                <li><a href="#" className="text-[14px] text-white/80 hover:text-white transition-colors cursor-pointer">Blog</a></li>
                <li><a href="#" className="text-[14px] text-white/80 hover:text-white transition-colors cursor-pointer">LinkedIn</a></li>
                <li><a href="#faq" className="text-[14px] text-white/80 hover:text-white transition-colors cursor-pointer">Contact</a></li>
              </ul>
            </div>

            <div className="flex flex-col">
              <h4 className="text-[13px] font-medium text-white/45 mb-md">Legal</h4>
              <ul className="flex flex-col space-y-md">
                <li><a href="#" className="text-[14px] text-white/80 hover:text-white transition-colors cursor-pointer">Privacy Policy</a></li>
                <li><a href="#" className="text-[14px] text-white/80 hover:text-white transition-colors cursor-pointer">Terms of Service</a></li>
                <li><a href="#" className="text-[14px] text-white/80 hover:text-white transition-colors cursor-pointer">Partnership</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="w-full max-w-[1200px] mx-auto flex flex-col-reverse sm:flex-row justify-between items-center gap-md relative z-10">
          <div className="text-[13px] text-white/40">Copyright 2026. All right reserved</div>
          <div className="flex items-center gap-lg text-white/50">
            <a href="#" aria-label="X" className="hover:text-white transition-colors cursor-pointer"><AtSign className="w-[16px] h-[16px]" /></a>
            <a href="#" aria-label="Instagram" className="hover:text-white transition-colors cursor-pointer"><Camera className="w-[16px] h-[16px]" /></a>
            <a href="#" aria-label="Threads" className="hover:text-white transition-colors cursor-pointer"><MessageCircle className="w-[16px] h-[16px]" /></a>
            <a href="#" aria-label="YouTube" className="hover:text-white transition-colors cursor-pointer"><Video className="w-[16px] h-[16px]" /></a>
          </div>
        </div>
        </footer>
      </div>
    </div>
  );
}

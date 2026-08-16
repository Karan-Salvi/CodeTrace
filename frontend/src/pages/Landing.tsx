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
  Lock 
} from "lucide-react";



const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
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

// --- Helper Components ---
function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center space-x-xs mb-md">
      <div className="h-[1px] w-xl bg-[#0070f3]" />
      <span className="font-mono text-[12px] uppercase tracking-widest text-[#0070f3] font-medium">
        {children}
      </span>
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
    navigate('/login');
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#020203] to-[#0a0a0f] text-white selection:bg-[#0070f3] selection:text-white overflow-hidden font-sans">
      
      <div className="absolute inset-0 pointer-events-none flex justify-center overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.15 }}
          transition={{ duration: 2, ease: "easeOut" }}
          className="absolute top-[-20%] w-[800px] h-[500px] rounded-full bg-[#0070f3] blur-[150px] mix-blend-screen"
        />
      </div>

      <header className="relative z-50 flex h-4xl items-center justify-between px-lg lg:px-3xl border-b border-white/[0.08] bg-[#020203]/80 backdrop-blur-md">
        <div className="flex items-center space-x-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[20px] h-[20px] text-white">
            <path d="M3.5 21 14 3"/>
            <path d="M20.5 21 10 3"/>
            <path d="M15.5 21 12 15l-3.5 6"/>
            <path d="M2 21h20"/>
          </svg>
          <span className="font-semibold text-[14px] tracking-tight text-white">CodeTrace</span>
        </div>
        <div>
          <button
            onClick={handleLogin}
            className="flex items-center text-[13px] font-medium text-white/70 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0070f3] cursor-pointer"
          >
            Log In
          </button>
        </div>
      </header>

      <main className="relative z-10 flex flex-col items-center pb-5xl">
        
        <section className="w-full max-w-[1200px] px-lg lg:px-3xl pt-6xl pb-5xl flex flex-col items-center text-center">
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="max-w-[896px] flex flex-col items-center">
            
            <motion.div variants={itemVariants}>
              <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-sm py-xxs text-[12px] font-mono text-white/60 mb-xl backdrop-blur-sm shadow-sm">
                <span className="flex h-[6px] w-[6px] rounded-full bg-[#0070f3] mr-xs"></span>
                v2.0 // Syntax-Level Indexing
              </span>
            </motion.div>

            <motion.h1 
              variants={itemVariants}
              className="text-[48px] sm:text-[64px] lg:text-[72px] font-semibold leading-[1.05] tracking-[-0.04em] text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/50 mb-lg"
            >
              AI PR reviews with deep repository context.
            </motion.h1>

            <motion.p 
              variants={itemVariants}
              className="text-[18px] sm:text-[20px] text-white/60 max-w-[672px] mb-3xl leading-relaxed font-normal"
            >
              CodeTrace is an AI-powered PR review and code intelligence platform. It indexes your GitHub repositories at the syntax level to deliver context-aware reviews, scoring risks across security, logic, and performance.
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center gap-md w-full sm:w-auto">
              <button
                onClick={handleLogin}
                className="group relative flex items-center justify-center h-3xl rounded-[100px] bg-white px-xl text-[15px] font-medium text-[#171717] transition-all hover:scale-[1.02] hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white w-full sm:w-auto overflow-hidden shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] cursor-pointer"
              >
                <GithubIcon className="w-md h-md mr-xs" />
                Log in with GitHub
              </button>
              
              <a
                href="#pipeline"
                className="flex items-center justify-center h-3xl rounded-[100px] border border-white/20 bg-transparent px-xl text-[15px] font-medium text-white transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 w-full sm:w-auto cursor-pointer"
              >
                See how it works
              </a>
            </motion.div>
          </motion.div>
        </section>

        <section className="w-full max-w-[1000px] px-lg lg:px-3xl py-6xl border-t border-white/[0.08]">
          <div className="grid md:grid-cols-2 gap-3xl items-center">
            <div>
              <SectionEyebrow>The Problem</SectionEyebrow>
              <h2 className="text-[32px] font-semibold tracking-[-0.03em] leading-tight text-white mb-lg">
                Hallucinations break trust. Full-repo dumps break scale.
              </h2>
            </div>
            <div>
              <p className="text-[16px] text-white/60 leading-relaxed mb-md">
                Most AI code tools either hallucinate answers with no way to verify them, or attempt naive full-repository context dumps that fail on large codebases.
              </p>
              <p className="text-[16px] text-white/60 leading-relaxed">
                CodeTrace guarantees trust through <strong>citation validation</strong>. If the LLM generates a claim, it is strictly validated against the retrieved chunk boundaries before you ever see it.
              </p>
            </div>
          </div>
        </section>

        <section id="pipeline" className="w-full max-w-[1200px] px-lg lg:px-3xl py-6xl">
          <SectionEyebrow>Architecture</SectionEyebrow>
          <h2 className="text-[32px] font-semibold tracking-[-0.03em] mb-3xl text-white">
            The Indexing Pipeline
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-md">
            <div className="flex flex-col p-lg rounded-[12px] bg-[#0a0a0c] border border-white/[0.08] shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
              <div className="w-xl h-xl rounded-full bg-white/10 flex items-center justify-center mb-md text-white/80 font-mono text-[12px]">01</div>
              <h3 className="text-[16px] font-medium text-white mb-xs">Indexing</h3>
              <p className="text-[14px] text-white/50 leading-relaxed">Clones via short-lived GitHub App tokens.</p>
            </div>
            
            <div className="flex flex-col p-lg rounded-[12px] bg-[#0a0a0c] border border-white/[0.08] shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
              <div className="w-xl h-xl rounded-full bg-white/10 flex items-center justify-center mb-md text-white/80 font-mono text-[12px]">02</div>
              <h3 className="text-[16px] font-medium text-white mb-xs">Chunking</h3>
              <p className="text-[14px] text-white/50 leading-relaxed">Tree-sitter parses JS/TS/Python strictly at function & class boundaries.</p>
            </div>

            <div className="flex flex-col p-lg rounded-[12px] bg-[#0a0a0c] border border-white/[0.08] shadow-[0_2px_10px_rgba(0,0,0,0.5)] relative">
              <div className="absolute inset-0 bg-[#0070f3]/5 rounded-[12px] pointer-events-none" />
              <div className="w-xl h-xl rounded-full bg-[#0070f3]/20 flex items-center justify-center mb-md text-[#0070f3] font-mono text-[12px]">03</div>
              <h3 className="text-[16px] font-medium text-white mb-xs">Embedding</h3>
              <p className="text-[14px] text-white/50 leading-relaxed">Hashed by content with cross-repo cache reuse.</p>
            </div>

            <div className="flex flex-col p-lg rounded-[12px] bg-[#0a0a0c] border border-white/[0.08] shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
              <div className="w-xl h-xl rounded-full bg-white/10 flex items-center justify-center mb-md text-white/80 font-mono text-[12px]">04</div>
              <h3 className="text-[16px] font-medium text-white mb-xs">Retrieval</h3>
              <p className="text-[14px] text-white/50 leading-relaxed">Hybrid pgvector + full-text, merged by RRF & reranked.</p>
            </div>

            <div className="flex flex-col p-lg rounded-[12px] bg-white border border-white shadow-[0_4px_20px_rgba(255,255,255,0.1)]">
              <div className="w-xl h-xl rounded-full bg-black/10 flex items-center justify-center mb-md text-black font-mono text-[12px]">05</div>
              <h3 className="text-[16px] font-medium text-black mb-xs">Citation Validation</h3>
              <p className="text-[14px] text-black/70 leading-relaxed">Unsupported claims are stripped. Verified evidence is served.</p>
            </div>
          </div>
        </section>

        <section className="w-full max-w-[1200px] px-lg lg:px-3xl py-6xl border-t border-white/[0.08]">
          <SectionEyebrow>Capabilities</SectionEyebrow>
          <h2 className="text-[32px] font-semibold tracking-[-0.03em] mb-3xl text-white">
            Engineered for precision.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
            
            <div className="md:col-span-2 p-2xl rounded-[16px] bg-[#0a0a0c] border border-white/[0.08] flex flex-col justify-between group">
              <div className="mb-3xl">
                <Workflow className="w-xl h-xl text-[#0070f3] mb-lg" />
                <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-white mb-xs">Chunk-level incremental indexing</h3>
                <p className="text-[16px] text-white/60 leading-relaxed max-w-[672px]">
                  Triggered by a verified GitHub push webhook, CodeTrace performs chunk-level diffing. A one-line change in a 2,000-line file only re-embeds the one touched function, not the whole file.
                </p>
              </div>
              <div className="w-full h-[128px] rounded-[8px] bg-[#111111] border border-white/[0.05] p-lg font-mono text-[13px] text-white/70 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-xxs h-full bg-[#0070f3]" />
                <div className="text-white/40 mb-xs">{'// Webhook payload received'}</div>
                <div><span className="text-[#0070f3]">Diff</span> computed: 1 function modified</div>
                <div><span className="text-white">Hash matching:</span> Cache hit for 42 untouched chunks</div>
                <div><span className="text-emerald-400">Re-embedded:</span> 1 chunk in 45ms</div>
              </div>
            </div>

            <div className="p-2xl rounded-[16px] bg-[#0a0a0c] border border-white/[0.08] flex flex-col group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-lg opacity-10 group-hover:opacity-20 transition-opacity">
                <CheckCircle2 className="w-[96px] h-[96px] text-white" />
              </div>
              <CheckCircle2 className="w-xl h-xl text-white mb-lg relative z-10" />
              <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-white mb-xs relative z-10">Citation-validated answers</h3>
              <p className="text-[15px] text-white/60 leading-relaxed relative z-10">
                Every citation emitted by the LLM is re-validated against what was retrieved. The file must exist, and the line numbers must be real.
              </p>
            </div>

            <div className="p-2xl rounded-[16px] bg-[#0a0a0c] border border-white/[0.08] flex flex-col group">
              <GitMerge className="w-xl h-xl text-white mb-lg" />
              <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-white mb-xs">Risk-scored PR reviews</h3>
              <p className="text-[15px] text-white/60 leading-relaxed mb-lg">
                Uses one-hop dependency retrieval to generate contextual reviews. Findings are strictly categorized into BUG, SECURITY, PERFORMANCE, LOGIC, TESTING, and MAINTAINABILITY.
              </p>
              <div className="mt-auto flex items-center space-x-xs">
                <span className="px-[8px] py-[4px] rounded bg-rose-500/10 text-rose-400 text-[11px] font-mono border border-rose-500/20">HIGH RISK (85/100)</span>
              </div>
            </div>

            <div className="p-2xl rounded-[16px] bg-[#0a0a0c] border border-white/[0.08] flex flex-col group">
              <Search className="w-xl h-xl text-white mb-lg" />
              <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-white mb-xs">Hybrid retrieval + reranking</h3>
              <p className="text-[15px] text-white/60 leading-relaxed">
                Combines pgvector cosine similarity with Postgres full-text search. Results are merged via Reciprocal Rank Fusion and reranked by a cross-encoder to the top 5-8 chunks.
              </p>
            </div>

            <div className="p-2xl rounded-[16px] bg-[#0a0a0c] border border-white/[0.08] flex flex-col group">
              <ShieldCheck className="w-xl h-xl text-white mb-lg" />
              <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-white mb-xs">Zero-trust security model</h3>
              <p className="text-[15px] text-white/60 leading-relaxed">
                Uses short-lived installation tokens. Webhooks are HMAC-verified. Secret files (`.env`, `.pem`) are explicitly excluded. All repository content is treated as untrusted data.
              </p>
            </div>

          </div>
        </section>

        <section className="w-full max-w-[1000px] px-lg lg:px-3xl py-6xl border-t border-white/[0.08]">
          <SectionEyebrow>Evidence</SectionEyebrow>
          <h2 className="text-[32px] font-semibold tracking-[-0.03em] mb-3xl text-white">
            Answers backed by real code.
          </h2>

          <div className="w-full rounded-[16px] bg-[#0a0a0c] border border-white/[0.08] overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
            <div className="flex items-center px-md py-sm border-b border-white/[0.05] bg-white/[0.02]">
              <div className="flex space-x-xs">
                <div className="w-sm h-sm rounded-full bg-white/10" />
                <div className="w-sm h-sm rounded-full bg-white/10" />
                <div className="w-sm h-sm rounded-full bg-white/10" />
              </div>
              <div className="ml-md font-mono text-[12px] text-white/40">Querying: src/backend/auth.service.ts</div>
            </div>
            <div className="p-xl space-y-lg">
              
              <div className="flex justify-end">
                <div className="max-w-[80%] px-md py-sm bg-[#111111] border border-white/[0.08] rounded-[12px] rounded-br-none text-white text-[14px]">
                  Where is the JWT token verified in the backend?
                </div>
              </div>

              <div className="flex justify-start">
                <div className="max-w-[90%] px-md py-sm bg-transparent text-white text-[14px] leading-relaxed">
                  The JWT token is verified in the <code className="text-[13px] font-mono text-white/80">verifyAccessToken</code> function within the Auth Service 
                  <span className="inline-block px-[6px] py-[1px] mx-[4px] text-[11px] font-mono bg-white/10 text-white/80 rounded-[4px] border border-white/20 align-baseline shadow-sm cursor-pointer hover:bg-white/15 transition-colors">
                    auth.service.ts:45-62
                  </span>. 
                  It uses the <code className="text-[13px] font-mono text-white/80">jsonwebtoken</code> library to validate the signature against the server's public key. If the token is invalid or expired, it immediately throws an <code className="text-[13px] font-mono text-white/80">UnauthorizedException</code> 
                  <span className="inline-block px-[6px] py-[1px] mx-[4px] text-[11px] font-mono bg-white/10 text-white/80 rounded-[4px] border border-white/20 align-baseline shadow-sm cursor-pointer hover:bg-white/15 transition-colors">
                    auth.service.ts:58-60
                  </span>.
                </div>
              </div>

            </div>
          </div>
        </section>

        <section className="w-full px-lg lg:px-3xl py-6xl flex flex-col items-center text-center border-t border-white/[0.08] relative overflow-hidden">
          <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
             <div className="w-[600px] h-[300px] rounded-full bg-[#0070f3] blur-[150px] opacity-10 mix-blend-screen" />
          </div>
          
          <div className="relative z-10">
            <h2 className="text-[40px] font-semibold tracking-[-0.03em] mb-xl text-white">
              Start indexing your codebase.
            </h2>
            <button
              onClick={handleLogin}
              className="inline-flex items-center justify-center h-[56px] rounded-[100px] bg-white px-2xl text-[16px] font-medium text-[#171717] transition-all hover:scale-[1.02] hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white shadow-[0_0_30px_-5px_rgba(255,255,255,0.2)] cursor-pointer"
            >
              <GithubIcon className="w-[20px] h-[20px] mr-sm" />
              Log in with GitHub
            </button>
          </div>
        </section>

      </main>

      <footer className="w-full px-lg lg:px-3xl py-3xl border-t border-white/[0.05] bg-[#020203] flex flex-col sm:flex-row items-center justify-between text-[13px] text-white/40 font-sans">
        <div className="flex items-center space-x-xs mb-md sm:mb-0">
          <Lock className="w-[14px] h-[14px]" />
          <span>CodeTrace Inc. All rights reserved.</span>
        </div>
        <div className="flex space-x-lg">
          <a href="#" className="hover:text-white transition-colors cursor-pointer">GitHub Repository</a>
          <a href="#" className="hover:text-white transition-colors cursor-pointer">Terms</a>
          <a href="#" className="hover:text-white transition-colors cursor-pointer">Privacy</a>
        </div>
      </footer>

    </div>
  );
}

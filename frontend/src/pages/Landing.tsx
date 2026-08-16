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
  Triangle,
  Terminal,
  Sparkles
} from "lucide-react";

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

function LivePRReview() {
  const [text, setText] = useState("");
  const fullText = "> Analyzing PR #42...\n> Found 1 logic error in auth.service.ts\n> Validating against context...\n> Citation verified. Generating review...";
  
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
      className="mt-lg mb-3xl w-full max-w-[500px] rounded-[12px] bg-[#0a0a0c] border border-white/[0.08] p-md flex flex-col text-left shadow-[0_10px_30px_rgba(0,0,0,0.5)] mx-auto relative overflow-hidden"
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
          animate={{ 
            opacity: [0.15, 0.25, 0.15], 
            scale: [1, 1.1, 1],
            rotate: [0, 90, 0]
          }}
          transition={{ duration: 15, ease: "linear", repeat: Infinity }}
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
            className="group relative flex items-center justify-center h-[40px] rounded-[8px] bg-white px-lg text-[14px] font-medium text-[#171717] transition-all hover:scale-[1.02] hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white w-full sm:w-auto overflow-hidden shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] cursor-pointer"
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
              className="text-[16px] sm:text-[18px] text-white/60 max-w-[672px] mb-3xl leading-relaxed font-normal"
            >
              CodeTrace is an AI-powered PR review and code intelligence platform. It indexes your GitHub repositories at the syntax level to deliver context-aware reviews, scoring risks across security, logic, and performance.
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center gap-md w-full sm:w-auto mb-3xl">
              <button
                onClick={handleLogin}
                className="group relative flex items-center justify-center h-3xl rounded-[100px] bg-white px-xl text-[15px] font-medium text-[#171717] transition-all hover:scale-[1.02] hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white w-full sm:w-auto overflow-hidden shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] cursor-pointer"
              >
                <GithubIcon className="w-[20px] h-[20px] flex-shrink-0 mr-xs fill-current" />
                Log in with GitHub
              </button>
              
              <a
                href="#pipeline"
                className="flex items-center justify-center h-3xl rounded-[100px] border border-white/20 bg-transparent px-xl text-[15px] font-medium text-white transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 w-full sm:w-auto cursor-pointer"
              >
                See how it works
              </a>
            </motion.div>

            <LivePRReview />
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

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
            }}
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

            <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="flex flex-col p-lg rounded-[12px] bg-[#0a0a0c] border border-white/[0.08] shadow-[0_2px_10px_rgba(0,0,0,0.5)] relative transition-all group">
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

        <section className="w-full max-w-[1200px] px-lg lg:px-3xl py-6xl border-t border-white/[0.08]">
          <SectionEyebrow>Capabilities</SectionEyebrow>
          <h2 className="text-[32px] font-semibold tracking-[-0.03em] mb-3xl text-white">
            Engineered for precision.
          </h2>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
            }}
            className="grid grid-cols-1 md:grid-cols-3 gap-lg"
          >
            
            <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="md:col-span-2 p-2xl rounded-[16px] bg-[#0a0a0c] border border-white/[0.08] flex flex-col justify-between group transition-all">
              <div className="mb-3xl">
                <Workflow className="w-xl h-xl text-[#0070f3] mb-lg transition-transform group-hover:scale-110" />
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
            </motion.div>

            <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="p-2xl rounded-[16px] bg-[#0a0a0c] border border-white/[0.08] flex flex-col group relative overflow-hidden transition-all">
              <div className="absolute top-0 right-0 p-lg opacity-10 group-hover:opacity-20 transition-opacity">
                <CheckCircle2 className="w-[96px] h-[96px] text-white" />
              </div>
              <CheckCircle2 className="w-xl h-xl text-white mb-lg relative z-10 transition-transform group-hover:scale-110 group-hover:text-emerald-400" />
              <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-white mb-xs relative z-10">Citation-validated answers</h3>
              <p className="text-[15px] text-white/60 leading-relaxed relative z-10">
                Every citation emitted by the LLM is re-validated against what was retrieved. The file must exist, and the line numbers must be real.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="p-2xl rounded-[16px] bg-[#0a0a0c] border border-white/[0.08] flex flex-col group transition-all">
              <GitMerge className="w-xl h-xl text-white mb-lg transition-transform group-hover:scale-110" />
              <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-white mb-xs">Risk-scored PR reviews</h3>
              <p className="text-[15px] text-white/60 leading-relaxed mb-lg">
                Uses one-hop dependency retrieval to generate contextual reviews. Findings are strictly categorized into BUG, SECURITY, PERFORMANCE, LOGIC, TESTING, and MAINTAINABILITY.
              </p>
              <div className="mt-auto flex items-center space-x-xs">
                <span className="px-[8px] py-[4px] rounded bg-rose-500/10 text-rose-400 text-[11px] font-mono border border-rose-500/20 group-hover:bg-rose-500/20 transition-colors">HIGH RISK (85/100)</span>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="p-2xl rounded-[16px] bg-[#0a0a0c] border border-white/[0.08] flex flex-col group transition-all">
              <Search className="w-xl h-xl text-white mb-lg transition-transform group-hover:scale-110" />
              <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-white mb-xs">Hybrid retrieval + reranking</h3>
              <p className="text-[15px] text-white/60 leading-relaxed">
                Combines pgvector cosine similarity with Postgres full-text search. Results are merged via Reciprocal Rank Fusion and reranked by a cross-encoder to the top 5-8 chunks.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} whileHover={{ y: -5 }} className="p-2xl rounded-[16px] bg-[#0a0a0c] border border-white/[0.08] flex flex-col group transition-all">
              <ShieldCheck className="w-xl h-xl text-white mb-lg transition-transform group-hover:scale-110" />
              <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-white mb-xs">Zero-trust security model</h3>
              <p className="text-[15px] text-white/60 leading-relaxed">
                Uses short-lived installation tokens. Webhooks are HMAC-verified. Secret files (`.env`, `.pem`) are explicitly excluded. All repository content is treated as untrusted data.
              </p>
            </motion.div>

          </motion.div>
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
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.6 } }
              }}
              className="p-xl space-y-lg"
            >
              
              <motion.div variants={itemVariants} className="flex justify-end">
                <div className="max-w-[80%] px-md py-sm bg-[#111111] border border-white/[0.08] rounded-[12px] rounded-br-none text-white text-[14px]">
                  Where is the JWT token verified in the backend?
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="flex justify-start">
                <div className="max-w-[90%] px-md py-sm bg-transparent text-white text-[14px] leading-relaxed">
                  The JWT token is verified in the <code className="text-[13px] font-mono text-white/80">verifyAccessToken</code> function within the Auth Service 
                  <motion.span whileHover={{ scale: 1.05 }} className="inline-block px-[6px] py-[1px] mx-[4px] text-[11px] font-mono bg-[#0070f3]/10 text-[#0070f3] rounded-[4px] border border-[#0070f3]/20 align-baseline shadow-sm cursor-pointer transition-colors">
                    auth.service.ts:45-62
                  </motion.span>. 
                  It uses the <code className="text-[13px] font-mono text-white/80">jsonwebtoken</code> library to validate the signature against the server's public key. If the token is invalid or expired, it immediately throws an <code className="text-[13px] font-mono text-white/80">UnauthorizedException</code> 
                  <motion.span whileHover={{ scale: 1.05 }} className="inline-block px-[6px] py-[1px] mx-[4px] text-[11px] font-mono bg-[#0070f3]/10 text-[#0070f3] rounded-[4px] border border-[#0070f3]/20 align-baseline shadow-sm cursor-pointer transition-colors">
                    auth.service.ts:58-60
                  </motion.span>.
                </div>
              </motion.div>

            </motion.div>
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
              <GithubIcon className="w-[20px] h-[20px] flex-shrink-0 mr-sm fill-current" />
              Log in with GitHub
            </button>
          </div>
        </section>

      </main>

      <footer className="w-full relative overflow-hidden bg-[#020203] border-t border-white/[0.05] pt-6xl pb-3xl px-lg lg:px-3xl">
        <div className="w-full max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-6 gap-3xl lg:gap-xl mb-6xl relative z-10">
          
          {/* Left Column (Brand + Newsletter) */}
          <div className="lg:col-span-2 flex flex-col">
            <div className="flex items-center space-x-sm mb-lg text-white">
              <Triangle className="w-[16px] h-[16px] fill-current" />
              <span className="font-mono text-[13px] uppercase tracking-[0.15em] font-semibold">CodeTrace</span>
            </div>
            <p className="text-white/40 text-[14px] leading-relaxed mb-xl max-w-[280px]">
              AI PR reviews with deep repository context. Built for scale, verified by design.
            </p>
            <div className="flex items-center w-full max-w-[320px]">
              <input 
                type="email" 
                placeholder="you@company.com" 
                className="flex-1 bg-transparent border border-white/10 rounded-l-[6px] px-md py-sm text-[13px] text-white focus:outline-none focus:border-white/30 transition-colors h-[40px] font-sans"
              />
              <button className="h-[40px] px-lg bg-white text-black font-medium text-[12px] tracking-wider uppercase rounded-r-[6px] hover:bg-white/90 transition-colors cursor-pointer">
                Join
              </button>
            </div>
          </div>

          {/* Links Columns */}
          <div className="lg:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-xl">
            {/* Product */}
            <div className="flex flex-col">
              <h4 className="font-mono text-[11px] text-white uppercase tracking-[0.1em] mb-lg font-semibold">Product</h4>
              <ul className="flex flex-col space-y-md">
                <li><a href="#" className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 hover:text-white transition-colors cursor-pointer">Overview</a></li>
                <li><a href="#" className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 hover:text-white transition-colors cursor-pointer">Features</a></li>
                <li><a href="#" className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 hover:text-white transition-colors cursor-pointer">Integrations</a></li>
                <li><a href="#" className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 hover:text-white transition-colors cursor-pointer">Pricing</a></li>
                <li><a href="#" className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 hover:text-white transition-colors cursor-pointer">Changelog</a></li>
              </ul>
            </div>

            {/* Resources */}
            <div className="flex flex-col">
              <h4 className="font-mono text-[11px] text-white uppercase tracking-[0.1em] mb-lg font-semibold">Resources</h4>
              <ul className="flex flex-col space-y-md">
                <li><a href="#" className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 hover:text-white transition-colors cursor-pointer">Docs</a></li>
                <li><a href="#" className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 hover:text-white transition-colors cursor-pointer">Guides</a></li>
                <li><a href="#" className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 hover:text-white transition-colors cursor-pointer">API Reference</a></li>
                <li><a href="#" className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 hover:text-white transition-colors cursor-pointer">Support</a></li>
                <li><a href="#" className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 hover:text-white transition-colors cursor-pointer">Status</a></li>
              </ul>
            </div>

            {/* Company */}
            <div className="flex flex-col">
              <h4 className="font-mono text-[11px] text-white uppercase tracking-[0.1em] mb-lg font-semibold">Company</h4>
              <ul className="flex flex-col space-y-md">
                <li><a href="#" className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 hover:text-white transition-colors cursor-pointer">About</a></li>
                <li><a href="#" className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 hover:text-white transition-colors cursor-pointer">Careers</a></li>
                <li><a href="#" className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 hover:text-white transition-colors cursor-pointer">Blog</a></li>
                <li><a href="#" className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 hover:text-white transition-colors cursor-pointer">Press</a></li>
                <li><a href="#" className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 hover:text-white transition-colors cursor-pointer">Contact</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div className="flex flex-col">
              <h4 className="font-mono text-[11px] text-white uppercase tracking-[0.1em] mb-lg font-semibold">Legal</h4>
              <ul className="flex flex-col space-y-md">
                <li><a href="#" className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 hover:text-white transition-colors cursor-pointer">Privacy</a></li>
                <li><a href="#" className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 hover:text-white transition-colors cursor-pointer">Terms</a></li>
                <li><a href="#" className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 hover:text-white transition-colors cursor-pointer">Security</a></li>
                <li><a href="#" className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 hover:text-white transition-colors cursor-pointer">Cookies</a></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="w-full max-w-[1200px] mx-auto pt-lg flex flex-col md:flex-row justify-between items-center relative z-10 border-t border-white/[0.05]">
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/30 mb-md md:mb-0">
            © 2026 CodeTrace
          </div>
          <div className="flex items-center space-x-sm font-mono text-[11px] uppercase tracking-[0.1em] text-white/40 mb-md md:mb-0">
            <div className="w-[6px] h-[6px] rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            <span>All Systems Normal</span>
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/30">
            San Francisco · Remote
          </div>
        </div>

        {/* Glowing Rainbow Decoration at Bottom */}
        <motion.div 
          animate={{ x: [-20, 20, -20] }}
          transition={{ duration: 10, ease: "easeInOut", repeat: Infinity }}
          className="absolute bottom-[-150px] left-1/2 -translate-x-1/2 w-[1200px] h-[250px] pointer-events-none z-0 flex flex-col items-center justify-end opacity-[0.25] mix-blend-screen"
        >
          <div className="w-[60%] h-[60px] bg-fuchsia-500 rounded-[100%] blur-[60px]"></div>
          <div className="w-[80%] h-[60px] bg-amber-500 rounded-[100%] -mt-[30px] blur-[60px]"></div>
          <div className="w-[100%] h-[80px] bg-blue-600 rounded-[100%] -mt-[30px] blur-[80px]"></div>
        </motion.div>
      </footer>

    </div>
  );
}

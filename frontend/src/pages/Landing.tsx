import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  FileCode2,
  Menu,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { BrandMark } from "../components/ui/BrandMark";
import { CodebaseChat } from "../components/landing/CodebaseChat";

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z"
    />
  </svg>
);

const NAV_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#workflow", label: "Workflow" },
  { href: "#pricing", label: "Pricing" },
];

const faqs: [string, string][] = [
  ["How does CodeTrace access repositories?", "CodeTrace connects through a GitHub App using short-lived installation tokens. It only accesses repositories you explicitly select."],
  ["Which languages are supported?", "JavaScript, TypeScript, and Python. This focused set enables deeper syntax-aware analysis instead of broad, shallow support."],
  ["Does the model receive the full repository?", "No. CodeTrace retrieves only the relevant syntax-level chunks for a review or question, then validates citations against the current branch."],
  ["Can it write findings back to a pull request?", "Yes. Team plans can publish risk-ranked findings with source links directly to the pull request conversation."],
];

const pipeline: [string, string, string][] = [
  ["01", "Parse", "Map functions, classes, imports, and call sites."],
  ["02", "Hash", "Reuse every unchanged syntax-level chunk."],
  ["03", "Retrieve", "Combine exact text and semantic search."],
  ["04", "Validate", "Remove claims without source evidence."],
];

function ReviewWindow() {
  return (
    <div className="relative mx-auto w-full max-w-256 overflow-hidden rounded-xl border border-hairline bg-canvas-soft-2 shadow-window">
      <div className="flex h-12 items-center border-b border-hairline px-4 text-xs text-mute">
        <div className="mr-4 flex gap-1.5">
          <span className="size-2.5 rounded-full bg-hairline" />
          <span className="size-2.5 rounded-full bg-hairline" />
          <span className="size-2.5 rounded-full bg-hairline" />
        </div>
        <GithubIcon className="mr-2 size-3.5" /> <span className="font-medium text-ink">acme/payments</span>
        <span className="mx-2">/</span>pull #142
        <span className="ml-auto hidden items-center gap-2 sm:flex">
          <span className="size-1.5 rounded-full bg-positive" /> Analysis complete
        </span>
      </div>
      <div className="grid min-w-0 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="min-w-0 border-b border-hairline lg:border-r lg:border-b-0">
          <div className="flex h-11 items-center border-b border-hairline bg-canvas-soft px-4 font-mono text-[11px] text-mute">
            <FileCode2 size={13} className="mr-2" /> src/webhooks/payment.ts
            <span className="ml-auto text-positive">+8</span>
            <span className="ml-2 text-error">−2</span>
          </div>
          <div className="overflow-x-auto bg-canvas py-5 font-mono text-[11px] leading-7 sm:text-xs">
            <p className="code-row"><span>37</span><b>export async function</b> handlePayment(event) {"{"}</p>
            <p className="code-row"><span>38</span>&nbsp;&nbsp;<b>const</b> charge = event.data;</p>
            <p className="code-row code-row-added"><span>39</span>+&nbsp; await ledger.credit(charge.amount);</p>
            <p className="code-row"><span>40</span>&nbsp;&nbsp;<b>return</b> respond(200);</p>
            <p className="code-row"><span>41</span>{"}"}</p>
          </div>
          <div className="grid grid-cols-3 border-t border-hairline bg-canvas-soft text-center font-mono text-[9px] text-mute">
            <span className="border-r border-hairline py-3">3 files traced</span>
            <span className="border-r border-hairline py-3">8 symbols</span>
            <span className="py-3 text-positive">citations valid</span>
          </div>
        </div>
        <div className="p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase text-error">
              <span className="size-1.5 rounded-full bg-error" /> High risk
            </span>
            <span className="font-mono text-[10px] text-mute">logic</span>
          </div>
          <h2 className="mt-6 text-xl font-semibold text-ink">Payment may be credited twice</h2>
          <p className="mt-3 text-sm leading-6 text-body">This webhook mutates the ledger before checking whether the event was already processed.</p>
          <div className="mt-7 border-t border-hairline pt-5">
            <p className="font-mono text-[10px] uppercase text-mute">Verified evidence</p>
            {["payment.ts:39", "stripe.ts:112–118"].map((item) => (
              <a key={item} href="#evidence" className="mt-3 flex cursor-pointer items-center justify-between rounded-md border border-hairline bg-canvas-soft px-3 py-2.5 text-xs text-ink hover:border-ink/30">
                <span>{item}</span>
                <ChevronRight size={13} />
              </a>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs text-positive">
            <CircleCheck size={14} /> Checked against branch head
          </div>
        </div>
      </div>
    </div>
  );
}

function TraceDiagram() {
  return (
    <div className="relative flex min-h-[390px] items-center justify-center overflow-hidden bg-dot-grid px-5 py-12">
      <div className="bg-trace-line absolute left-1/2 top-1/2 h-px w-[68%] -translate-x-1/2" />
      <div className="relative grid w-full max-w-168 grid-cols-3 items-center gap-3 text-center">
        {([
          ["Changed", "payment.ts", "39"],
          ["Caller", "stripe.ts", "112"],
          ["State", "events.ts", "24"],
        ] as const).map(([label, file, line], index) => (
          <div key={label} className={`relative z-10 rounded-lg border bg-canvas-soft-2 p-3 sm:p-5 ${index === 0 ? "border-error/60" : "border-hairline"}`}>
            <p className="font-mono text-[9px] uppercase text-mute">{label}</p>
            <p className="mt-3 truncate font-mono text-[10px] text-ink sm:text-xs">{file}</p>
            <p className="mt-1 font-mono text-[9px] text-mute">line {line}</p>
          </div>
        ))}
      </div>
      <div className="absolute bottom-6 font-mono text-[9px] text-mute">dependency trace · 3 hops · 42ms</div>
    </div>
  );
}

export function Landing() {
  const { token, isLoading } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [annual, setAnnual] = useState(true);
  const [activeFaq, setActiveFaq] = useState(0);

  if (!isLoading && token) {
    return <Navigate to="/repositories" replace />;
  }

  const handleLogin = () => navigate("/login");

  return (
    <div className="font-landing min-h-screen overflow-x-hidden bg-canvas text-ink">
      <header className="sticky top-0 z-50 border-b border-hairline bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-5 lg:px-8">
          <a href="#top" className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold" aria-label="CodeTrace home">
            <BrandMark /> CodeTrace
          </a>
          <nav className="ml-10 hidden items-center gap-7 text-sm text-body md:flex" aria-label="Main navigation">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="cursor-pointer hover:text-ink">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <button onClick={handleLogin} className="h-9 cursor-pointer rounded-full px-3 text-sm font-medium text-body hover:bg-canvas-soft hover:text-ink">
              Log in
            </button>
            <button onClick={handleLogin} className="h-9 cursor-pointer rounded-pill bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90">
              Start free
            </button>
          </div>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle navigation"
            className="ml-auto flex size-9 cursor-pointer items-center justify-center rounded-full text-ink md:hidden"
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
        {menuOpen && (
          <nav className="grid border-t border-hairline bg-canvas px-5 py-2 md:hidden">
            {[...NAV_LINKS, { href: "#faq", label: "FAQ" }].map((item) => (
              <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="cursor-pointer border-b border-hairline py-3 text-sm text-ink last:border-0">
                {item.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      <main id="top">
        <section className="relative border-b border-hairline">
          <div className="bg-hero-grid absolute inset-x-0 top-0 mx-auto h-[620px] max-w-7xl" />
          <div className="relative mx-auto max-w-7xl px-5 pt-24 lg:px-8 lg:pt-32">
            <div className="mx-auto max-w-224 text-center">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-hairline bg-canvas-soft px-3 py-1.5 text-xs text-body">
                <span className="size-1.5 rounded-full bg-positive" /> Now reviewing JavaScript, TypeScript, and Python
              </div>
              <h1 className="mt-8 text-balance text-5xl font-semibold leading-[0.98] tracking-tight sm:text-7xl lg:text-[88px]">
                Code review that
                <br className="hidden sm:block" /> shows its work.
              </h1>
              <p className="mx-auto mt-7 max-w-168 text-lg leading-8 text-body">
                Trace a pull request through your codebase. Find consequential risks, rank them by severity, and verify every claim at the source.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <button
                  onClick={handleLogin}
                  className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-pill bg-primary px-5 text-[15px] font-medium text-on-primary hover:opacity-90"
                >
                  <GithubIcon className="size-4" /> Connect GitHub
                </button>
                <Link
                  to="/benchmarks"
                  className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-pill border border-hairline px-5 text-[15px] font-medium text-ink hover:bg-canvas-soft"
                >
                  View a sample review <ArrowRight size={15} />
                </Link>
              </div>
            </div>
            <div className="relative mt-20 pb-16 lg:mt-24 lg:pb-24">
              <div className="bg-product-halo absolute inset-x-[15%] bottom-0 top-[15%]" />
              <ReviewWindow />
            </div>
          </div>
        </section>

        <section className="border-b border-hairline">
          <div className="mx-auto grid max-w-7xl sm:grid-cols-3">
            {([
              ["Risk, not noise", "Six review categories keep style nits out of your pull requests."],
              ["Evidence first", "Every finding links to the exact file and line that supports it."],
              ["Fast by design", "Only changed syntax-level chunks are indexed again."],
            ] as const).map(([title, copy], index) => (
              <article key={title} className="border-b border-hairline p-7 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0 lg:p-9">
                <span className="font-mono text-[10px] text-mute">0{index + 1}</span>
                <h2 className="mt-8 font-semibold text-ink">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-body">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="product" className="border-b border-hairline">
          <div className="mx-auto max-w-7xl border-x border-hairline">
            <div className="grid lg:grid-cols-2">
              <div className="flex min-h-[390px] flex-col justify-center border-b border-hairline p-8 lg:border-r lg:border-b-0 lg:p-14">
                <p className="section-label">Repository context</p>
                <h2 className="mt-5 max-w-128 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Follow the change beyond the diff.</h2>
                <p className="mt-6 max-w-112 leading-7 text-body">
                  CodeTrace traverses callers, imports, and state boundaries to reveal effects that a line-by-line review cannot see.
                </p>
              </div>
              <TraceDiagram />
            </div>
          </div>
        </section>

        <section id="evidence" className="border-b border-hairline">
          <div className="mx-auto max-w-7xl border-x border-hairline">
            <div className="border-b border-hairline px-6 py-20 text-center lg:py-28">
              <p className="section-label">Verified answers</p>
              <h2 className="mx-auto mt-5 max-w-192 text-4xl font-semibold tracking-tight text-ink sm:text-6xl">
                Ask the codebase.
                <br />
                Inspect the answer.
              </h2>
              <p className="mx-auto mt-6 max-w-144 text-body">No mystery sources. Each answer stays anchored to code that exists on the branch you are reviewing.</p>
            </div>
            <div className="grid lg:grid-cols-[0.4fr_0.6fr]">
              <div className="border-b border-hairline p-6 lg:border-r lg:border-b-0 lg:p-10">
                <p className="font-mono text-[10px] uppercase text-mute">Question</p>
                <div className="mt-4 flex items-center gap-3 rounded-lg border border-hairline bg-canvas-soft px-4 py-3 text-sm text-ink">
                  <Search size={15} className="text-mute" />
                  Where is the JWT audience checked?
                </div>
                <p className="mt-8 font-mono text-[10px] uppercase text-mute">Answer</p>
                <p className="mt-4 text-sm leading-7 text-ink">
                  Before session creation, inside <span className="font-mono text-link">auth/verify.ts</span>. The decoded token is rejected if its audience does not match the configured client.
                </p>
              </div>
              <div className="min-w-0 bg-canvas p-6 lg:p-10">
                <div className="flex items-center border-b border-hairline pb-4 font-mono text-[11px] text-mute">
                  <FileCode2 size={13} className="mr-2" /> auth/verify.ts <span className="ml-auto text-positive">verified</span>
                </div>
                <pre className="mt-6 overflow-x-auto font-mono text-xs leading-8 text-body">
                  <span className="text-mute">40</span> <span className="text-[#e879c8]">export function</span> verifyToken(token) {"{"}
                  {"\n"}
                  <span className="text-mute">41</span> <span className="text-[#e879c8]">const</span> payload = jwt.verify(token, key)
                  {"\n"}
                  <span className="evidence-code">
                    <span className="text-mute">42</span> assertAudience(payload, expected)
                  </span>
                  {"\n"}
                  <span className="text-mute">43</span> <span className="text-[#e879c8]">return</span> createSession(payload)
                  {"\n"}
                  <span className="text-mute">44</span> {"}"}
                </pre>
              </div>
            </div>
          </div>
        </section>

        <section id="chat" className="border-b border-hairline">
          <div className="mx-auto max-w-7xl border-x border-hairline px-5 py-20 lg:px-8 lg:py-28">
            <div className="mb-12 text-center">
              <p className="section-label">Chat</p>
              <h2 className="mx-auto mt-5 max-w-168 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">More powerful with your codebase.</h2>
              <p className="mx-auto mt-5 max-w-144 text-body">
                Ask anything. Pick a topic below or type your own question — answers come back with verifiable source citations.
              </p>
            </div>
            <CodebaseChat />
          </div>
        </section>

        <section id="workflow" className="border-b border-hairline">
          <div className="mx-auto max-w-7xl border-x border-hairline">
            <div className="grid border-b border-hairline lg:grid-cols-[0.42fr_0.58fr]">
              <div className="border-b border-hairline p-8 lg:border-r lg:border-b-0 lg:p-14">
                <p className="section-label">The indexing pipeline</p>
                <h2 className="mt-5 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
                  Precise context,
                  <br />
                  without the wait.
                </h2>
              </div>
              <div className="p-8 lg:p-14">
                <p className="max-w-128 text-lg leading-8 text-body">
                  Syntax-aware indexing makes the repository searchable by structure. Content hashes ensure a one-line edit never triggers a full re-index.
                </p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4">
              {pipeline.map(([number, title, copy]) => (
                <article key={number} className="border-b border-hairline p-7 sm:border-r lg:border-b-0 lg:p-8">
                  <span className="font-mono text-[10px] text-positive">{number}</span>
                  <h3 className="mt-12 font-semibold text-ink">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-body">{copy}</p>
                </article>
              ))}
            </div>
            <div className="grid border-t border-hairline lg:grid-cols-2">
              <div className="border-b border-hairline p-8 lg:border-r lg:border-b-0 lg:p-12">
                <div className="flex items-center gap-3">
                  <ShieldCheck size={19} className="text-positive" />
                  <span className="font-semibold text-ink">Private by default</span>
                </div>
                <p className="mt-4 max-w-112 text-sm leading-6 text-body">Short-lived GitHub tokens, explicit secret-file exclusions, and no full-repository model uploads.</p>
              </div>
              <div className="grid grid-cols-3 divide-x divide-hairline p-8 text-center lg:p-12">
                {([
                  ["42", "chunks reused"],
                  ["1", "chunk updated"],
                  ["45ms", "index time"],
                ] as const).map(([value, label]) => (
                  <div key={label}>
                    <p className="font-mono text-lg text-ink">{value}</p>
                    <p className="mt-2 text-[10px] text-mute">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="border-b border-hairline">
          <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
            <div className="text-center">
              <p className="section-label">Pricing</p>
              <h2 className="mt-5 text-4xl font-semibold tracking-tight text-ink sm:text-6xl">Start reviewing for free.</h2>
              <p className="mx-auto mt-5 max-w-144 text-body">Upgrade when your team needs private repositories and pull request write-back.</p>
              <div className="mx-auto mt-8 flex w-fit rounded-lg border border-hairline bg-canvas-soft p-1">
                <button
                  onClick={() => setAnnual(false)}
                  className={`h-8 cursor-pointer rounded-md px-3 text-sm font-medium ${annual ? "text-body hover:text-ink" : "bg-canvas-soft-2 text-ink"}`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setAnnual(true)}
                  className={`h-8 cursor-pointer rounded-md px-3 text-sm font-medium ${annual ? "bg-canvas-soft-2 text-ink" : "text-body hover:text-ink"}`}
                >
                  Annual · save 20%
                </button>
              </div>
            </div>
            <div className="mx-auto mt-14 grid max-w-224 overflow-hidden rounded-xl border border-hairline md:grid-cols-2">
              <article className="border-b border-hairline p-7 md:border-r md:border-b-0 lg:p-9">
                <p className="font-mono text-[10px] uppercase text-mute">Personal</p>
                <p className="mt-7 text-4xl font-semibold text-ink">$0</p>
                <p className="mt-2 text-sm text-body">For public projects and evaluation.</p>
                <button onClick={handleLogin} className="mt-8 h-10 w-full cursor-pointer rounded-pill border border-hairline text-sm font-medium text-ink hover:bg-canvas-soft">
                  Start free
                </button>
                <ul className="mt-8 space-y-3 border-t border-hairline pt-6 text-sm text-ink">
                  {["1 public repository", "50 questions per month", "Verified code citations"].map((item) => (
                    <li key={item} className="flex gap-3">
                      <Check size={14} className="mt-0.5 text-positive" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
              <article className="bg-canvas-soft p-7 lg:p-9">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase text-mute">Teams</p>
                  <span className="rounded-full border border-hairline px-2 py-1 font-mono text-[9px] text-body">Recommended</span>
                </div>
                <p className="mt-7 text-4xl font-semibold text-ink">
                  ${annual ? "15" : "19"}
                  <span className="text-sm font-normal text-body"> / developer</span>
                </p>
                <p className="mt-2 text-sm text-body">For teams shipping private code.</p>
                <button onClick={handleLogin} className="mt-8 flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-pill bg-primary text-sm font-medium text-on-primary hover:opacity-90">
                  Start with Teams <ArrowRight size={14} />
                </button>
                <ul className="mt-8 space-y-3 border-t border-hairline pt-6 text-sm text-ink">
                  {["Unlimited repositories", "Unlimited reviews and questions", "Pull request write-back"].map((item) => (
                    <li key={item} className="flex gap-3">
                      <Check size={14} className="mt-0.5 text-positive" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section id="faq">
          <div className="mx-auto grid max-w-256 gap-12 px-5 py-24 lg:grid-cols-[0.35fr_0.65fr] lg:px-8 lg:py-28">
            <div>
              <p className="section-label">FAQ</p>
              <h2 className="mt-4 text-3xl font-semibold text-ink">
                Questions,
                <br />
                answered.
              </h2>
            </div>
            <div className="divide-y divide-hairline border-y border-hairline">
              {faqs.map(([question, answer], index) => (
                <div key={question}>
                  <button
                    onClick={() => setActiveFaq(activeFaq === index ? -1 : index)}
                    aria-expanded={activeFaq === index}
                    className="flex h-auto w-full cursor-pointer items-center justify-between rounded-none px-0 py-6 text-left"
                  >
                    <span className="whitespace-normal pr-5 text-ink">{question}</span>
                    <ChevronDown size={16} className={`shrink-0 text-mute transition-transform ${activeFaq === index ? "rotate-180" : ""}`} />
                  </button>
                  {activeFaq === index && <p className="max-w-144 pb-6 text-sm leading-7 text-body">{answer}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-hairline">
          <div className="bg-cta-radial pointer-events-none absolute inset-0" />
          <div className="relative mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
            <div className="flex flex-col items-start justify-between gap-12 lg:flex-row lg:items-end">
              <div className="max-w-168">
                <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-canvas-soft px-3 py-1.5 text-xs text-body">
                  <span className="size-1.5 rounded-full bg-positive" />
                  Free for public repositories
                </div>
                <h2 className="mt-6 text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl">Trace the consequence.</h2>
                <p className="mt-4 max-w-128 text-lg leading-8 text-body">Connect a repository and get your first cited review in minutes. No credit card required.</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    onClick={handleLogin}
                    className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-pill bg-primary px-5 text-[15px] font-medium text-on-primary hover:opacity-90"
                  >
                    <GithubIcon className="size-4" /> Connect GitHub
                  </button>
                  <Link
                    to="/benchmarks"
                    className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-pill border border-hairline px-5 text-[15px] font-medium text-ink hover:bg-canvas-soft"
                  >
                    View a sample review <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
              <div className="w-full max-w-112 overflow-hidden rounded-xl border border-hairline bg-canvas-soft-2 font-mono text-xs shadow-window lg:w-auto">
                <div className="flex h-10 items-center gap-1.5 border-b border-hairline px-4">
                  <span className="size-2.5 rounded-full bg-hairline" />
                  <span className="size-2.5 rounded-full bg-hairline" />
                  <span className="size-2.5 rounded-full bg-hairline" />
                  <span className="ml-3 text-[10px] text-mute">codetrace review acme/payments#142</span>
                </div>
                <div className="space-y-3 p-5 text-body">
                  <p><span className="text-positive">✓</span> 3 files traced</p>
                  <p><span className="text-positive">✓</span> 8 symbols resolved</p>
                  <p><span className="text-error">!</span> 1 high-risk consequence found</p>
                  <p className="text-mute">— payment.ts:39 · stripe.ts:112</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <a href="#top" className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-ink" aria-label="CodeTrace home">
                <BrandMark /> CodeTrace
              </a>
              <p className="mt-4 max-w-80 text-sm leading-6 text-body">
                Code review with verified citations. Find risks across your codebase and trace every claim to its source.
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase text-mute">Product</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li><a href="#product" className="cursor-pointer text-body hover:text-ink">Features</a></li>
                <li><a href="#workflow" className="cursor-pointer text-body hover:text-ink">Workflow</a></li>
                <li><a href="#pricing" className="cursor-pointer text-body hover:text-ink">Pricing</a></li>
              </ul>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase text-mute">Resources</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li><a href="#faq" className="cursor-pointer text-body hover:text-ink">FAQ</a></li>
                <li><Link to="/benchmarks" className="cursor-pointer text-body hover:text-ink">Benchmarks</Link></li>
                <li><a href="https://github.com" target="_blank" rel="noreferrer" className="cursor-pointer text-body hover:text-ink">GitHub</a></li>
              </ul>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase text-mute">Legal</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li><a href="#" className="cursor-pointer text-body hover:text-ink">Privacy</a></li>
                <li><a href="#" className="cursor-pointer text-body hover:text-ink">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-hairline pt-8 text-xs text-mute sm:flex-row sm:items-center">
            <span>© 2026 CodeTrace. All rights reserved.</span>
            <div className="flex items-center gap-5">
              <a href="#" className="cursor-pointer hover:text-ink">Status</a>
              <a href="#" className="cursor-pointer hover:text-ink">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

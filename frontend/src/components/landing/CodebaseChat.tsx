import { ArrowUp, CircleCheck, FileCode2, RotateCcw, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Citation = { file: string; lines: string };
type Message = { role: "user" | "assistant"; text: string; citations?: Citation[] };

const topics: { name: string; count: number; questions: { q: string; a: string; citations: Citation[] }[] }[] = [
  {
    name: "Auth",
    count: 8,
    questions: [
      {
        q: "Where is the JWT verified?",
        a: "JWTs are verified in verifySession(), called by the middleware before any route handler runs. The token signature is checked against the rotating key set, and expiry is enforced at line 42. Refresh tokens take a separate path through rotateRefreshToken().",
        citations: [
          { file: "src/auth/middleware.ts", lines: "L38–52" },
          { file: "src/auth/keys.ts", lines: "L11–27" },
        ],
      },
      {
        q: "Who calls handleAuthError?",
        a: "handleAuthError is invoked from three call sites: the API error boundary, the session refresh loop, and the WebSocket reconnect handler. All three funnel into the same redirect to /login with the original destination preserved in the query string.",
        citations: [
          { file: "src/api/error-boundary.ts", lines: "L64" },
          { file: "src/auth/session.ts", lines: "L118" },
          { file: "src/realtime/socket.ts", lines: "L201" },
        ],
      },
    ],
  },
  {
    name: "Retrieval",
    count: 5,
    questions: [
      {
        q: "How are chunks ranked?",
        a: "Chunks are ranked by a hybrid score: exact symbol matches weigh 0.6, semantic similarity 0.3, and recency on the branch 0.1. Anything below the cutoff is dropped before the model ever sees it.",
        citations: [{ file: "src/retrieval/rank.ts", lines: "L72–99" }],
      },
      {
        q: "What gets re-indexed on a push?",
        a: "Only files whose syntax-tree hash changed are re-parsed. On an average push that is 4.2% of chunks — the rest are reused byte-for-byte, which is why incremental indexing finishes in seconds.",
        citations: [
          { file: "src/indexer/incremental.ts", lines: "L31–58" },
          { file: "src/indexer/hash.ts", lines: "L9–22" },
        ],
      },
    ],
  },
  {
    name: "PR Review",
    count: 12,
    questions: [
      {
        q: "Why was this change flagged?",
        a: "The diff updates the session cookie's maxAge but skips rotateRefreshToken(), which 14 other call sites depend on. Sessions older than the new maxAge would be silently invalidated — flagged as high risk because the impact crosses the auth boundary.",
        citations: [
          { file: "src/auth/session.ts", lines: "L84–103" },
          { file: "src/middleware/guard.ts", lines: "L19" },
        ],
      },
      {
        q: "Can findings post to the PR?",
        a: "Yes. On team plans, risk-ranked findings with their source citations are published as review comments on the pull request, threaded to the exact diff lines they reference.",
        citations: [{ file: "src/github/publish.ts", lines: "L45–71" }],
      },
    ],
  },
];

const fallback =
  "This demo answers the suggested questions with real citations. Connect your repository to ask anything about your own codebase.";

export function CodebaseChat() {
  const [activeTopic, setActiveTopic] = useState(0);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q || typing) return;
    const match = topics.flatMap((t) => t.questions).find((item) => item.q === q);
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setTyping(true);
    window.setTimeout(() => {
      setMessages((m) => [
        ...m,
        match ? { role: "assistant", text: match.a, citations: match.citations } : { role: "assistant", text: fallback },
      ]);
      setTyping(false);
    }, 900);
  };

  return (
    <div className="relative mx-auto w-full max-w-224 overflow-hidden rounded-2xl border border-hairline bg-canvas-soft-2 shadow-window">
      <form
        className="flex items-center gap-3 border-b border-hairline px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <Search size={16} className="shrink-0 text-mute" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type something to ask your codebase"
          className="min-w-0 flex-1 bg-transparent font-mono text-sm text-ink outline-none placeholder:text-mute"
          aria-label="Ask your codebase"
        />
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            className="shrink-0 cursor-pointer text-mute transition-colors hover:text-ink"
            aria-label="Reset conversation"
          >
            <RotateCcw size={15} />
          </button>
        )}
        <button
          type="submit"
          disabled={!input.trim() || typing}
          aria-label="Send question"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-opacity disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
        >
          <ArrowUp size={16} />
        </button>
      </form>

      <div ref={scrollRef} className="max-h-96 min-h-56 overflow-y-auto px-5 py-6 sm:px-8">
        {messages.length === 0 ? (
          <div className="space-y-6">
            {topics.map((topic, ti) => (
              <div key={topic.name}>
                <button
                  type="button"
                  onClick={() => setActiveTopic(ti)}
                  className={`flex items-center gap-2 font-mono text-xs transition-colors cursor-pointer ${
                    activeTopic === ti ? "text-ink" : "text-mute hover:text-ink"
                  }`}
                  aria-expanded={activeTopic === ti}
                >
                  <span className={`size-1.5 rounded-full ${activeTopic === ti ? "bg-positive" : "bg-hairline"}`} />
                  {topic.name} <span className="text-mute">({topic.count})</span>
                </button>
                {activeTopic === ti && (
                  <div className="mt-3 flex flex-wrap gap-2 pl-4">
                    {topic.questions.map((item) => (
                      <button
                        key={item.q}
                        type="button"
                        onClick={() => ask(item.q)}
                        className="cursor-pointer rounded-full border border-hairline bg-canvas px-4 py-1.5 font-mono text-xs text-body transition-colors hover:border-ink/30 hover:text-ink"
                      >
                        {item.q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[80%] rounded-xl rounded-br-sm border border-hairline bg-canvas px-4 py-2.5 text-sm text-ink">{m.text}</p>
                </div>
              ) : (
                <div key={i} className="max-w-[85%] space-y-3">
                  <p className="text-sm leading-7 text-body">{m.text}</p>
                  {m.citations && (
                    <div className="flex flex-wrap gap-2">
                      {m.citations.map((c) => (
                        <span
                          key={c.file + c.lines}
                          className="inline-flex items-center gap-1.5 rounded-md border border-positive/30 bg-positive-soft/10 px-2.5 py-1 font-mono text-[11px] text-positive"
                        >
                          <FileCode2 size={12} /> {c.file}:{c.lines}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}
            {typing && (
              <div className="flex items-center gap-1.5 text-mute">
                <span className="size-1.5 animate-pulse rounded-full bg-mute" />
                <span className="size-1.5 animate-pulse rounded-full bg-mute [animation-delay:150ms]" />
                <span className="size-1.5 animate-pulse rounded-full bg-mute [animation-delay:300ms]" />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-5 py-4 sm:px-8">
        <p className="max-w-112 font-mono text-xs leading-5 text-mute">
          Every answer cites the exact file and line it came from — never an unverified claim.
        </p>
        <span className="inline-flex items-center gap-2 text-xs text-mute">
          <CircleCheck size={14} className="text-positive" /> Citations verified on branch
        </span>
      </div>
    </div>
  );
}

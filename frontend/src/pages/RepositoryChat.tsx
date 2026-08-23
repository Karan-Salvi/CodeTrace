import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../lib/api-client";
import { wsClient } from "../lib/websocket";
import type { ChatCompleteMessage, WsErrorMessage } from "../lib/websocket";
import type { Conversation, Message, Citation, ChunkContent } from "../types";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { MonacoCodeViewer } from "../components/ui/MonacoCodeViewer";
import { Plus } from "lucide-react";

const CITATION_PATTERN = /\[([^\]:]+):(\d+)-(\d+)\]/g;

const EXAMPLE_QUESTIONS = [
  "What does this repository do?",
  "Where is the main entry point?",
  "How is authentication handled?",
  "What are the biggest files or modules?",
];

// Splits an answer's text on the backend's own citation-marker format
// ([path/to/file.ts:10-25], chat.service.ts's CITATION_PATTERN) and
// renders each occurrence that the server actually validated (present
// in `citations`) as a clickable badge — any marker text NOT in
// `citations` is left as plain text, since the server didn't vouch for
// it (docs/retrieval.md's citation-validation contract: unsupported
// claims are stripped/regenerated server-side, so a marker surviving
// into `answer` but missing from `citations` means it didn't pass
// validation and must not be presented as a real reference).
function renderAnswer(
  answer: string,
  citations: Message["citations"],
  onCitationClick: (citation: Citation) => void
) {
  const citationByKey = new Map(citations.map((c) => [`${c.file}:${c.startLine}-${c.endLine}`, c]));
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  CITATION_PATTERN.lastIndex = 0;

  while ((match = CITATION_PATTERN.exec(answer)) !== null) {
    const [full, file, start, end] = match;
    parts.push(answer.slice(lastIndex, match.index));
    const key = `${file}:${start}-${end}`;
    const citation = citationByKey.get(key);
    if (citation) {
      parts.push(
        <button
          key={`${match.index}-${key}`}
          type="button"
          onClick={() => onCitationClick(citation)}
          className="inline-block px-xs py-[1px] mx-[2px] text-[11px] font-mono bg-canvas-soft-2 text-body rounded-xs border border-hairline hover:border-link hover:text-link transition-colors cursor-pointer"
        >
          {file}:{start}-{end}
        </button>
      );
    } else {
      parts.push(full);
    }
    lastIndex = match.index + full.length;
  }
  parts.push(answer.slice(lastIndex));
  return parts;
}

export function RepositoryChat() {
  const { id } = useParams();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // One citation viewer at a time, shown in a panel above the input box
  // rather than expanded inline within the running answer text — a
  // citation badge sits mid-sentence, so there's no natural place to grow
  // a code block directly under it without breaking the paragraph flow.
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [chunkCache, setChunkCache] = useState<Record<string, ChunkContent>>({});
  const [chunkLoading, setChunkLoading] = useState(false);
  const [chunkError, setChunkError] = useState("");
  // Tracks which chunk is the "current" request, independent of React's
  // batched state — clicking citation A then quickly citation B before A's
  // fetch resolves must not let A's late response (loading/error state)
  // clobber B's already-displayed result. Only a response whose chunkId
  // still matches this ref when it resolves is allowed to update state.
  const activeChunkIdRef = useRef<string | null>(null);

  async function handleCitationClick(citation: Citation) {
    setActiveCitation(citation);
    setChunkError("");
    activeChunkIdRef.current = citation.chunkId;
    if (chunkCache[citation.chunkId]) {
      // Already have this one — explicitly clear loading rather than
      // leaving it as whatever a still-in-flight *different* citation's
      // request set it to. That request's own finally block won't reset
      // it either once it resolves, since activeChunkIdRef has already
      // moved on to this citation by then.
      setChunkLoading(false);
      return;
    }

    setChunkLoading(true);
    try {
      const data = await apiFetch<ChunkContent>(`/repositories/${id}/chunks/${citation.chunkId}`);
      setChunkCache((prev) => ({ ...prev, [citation.chunkId]: data }));
    } catch (e) {
      if (activeChunkIdRef.current === citation.chunkId) {
        setChunkError(e instanceof Error ? e.message : "Failed to load code");
      }
    } finally {
      if (activeChunkIdRef.current === citation.chunkId) {
        setChunkLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function init() {
      // Still no conversation-list/pick UI in this MVP (out of scope per
      // the plan) — but resume the most recent conversation instead of
      // always POSTing a fresh one, so a page reload doesn't discard a
      // thread that's already fully persisted server-side (chat.service.ts
      // writes every question/answer regardless of whether the frontend
      // is still around to show it).
      const latest = await apiFetch<Conversation | null>(`/repositories/${id}/conversations/latest`);
      if (cancelled) return;
      const conv =
        latest ?? (await apiFetch<Conversation>(`/repositories/${id}/conversations`, { method: "POST", data: {} }));
      if (cancelled) return;
      setConversation(conv);
      const existing = await apiFetch<Message[]>(`/repositories/${id}/conversations/${conv.id}/messages`);
      if (cancelled) return;
      setMessages(existing);
    }
    init().catch((e) => setError((e as Error).message || "Failed to start conversation"));

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    wsClient.connect();

    const handleComplete = (payload: unknown) => {
      const msg = payload as ChatCompleteMessage;
      setIsThinking(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          conversationId: conversation?.id ?? "",
          role: "ASSISTANT",
          content: msg.answer,
          citations: msg.citations,
          createdAt: new Date().toISOString(),
        },
      ]);
    };

    const handleError = (payload: unknown) => {
      const msg = payload as WsErrorMessage;
      setIsThinking(false);
      setError(msg.message === "Too many requests"
        ? "You're sending messages too fast — wait a moment and try again."
        : msg.message);
    };

    wsClient.on("chat:complete", handleComplete);
    wsClient.on("error", handleError);

    return () => {
      wsClient.off("chat:complete", handleComplete);
      wsClient.off("error", handleError);
    };
  }, [id, conversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const sendQuestion = (question: string) => {
    if (!question.trim() || !id || !conversation) return;

    setError("");
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        conversationId: conversation.id,
        role: "USER",
        content: question,
        citations: [],
        createdAt: new Date().toISOString(),
      },
    ]);
    setIsThinking(true);
    wsClient.sendChatMessage(id, conversation.id, question);
    setInput("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendQuestion(input);
  };

  const handleNewChat = async () => {
    if (!id) return;
    setError("");
    setMessages([]);
    setActiveCitation(null);
    const conv = await apiFetch<Conversation>(`/repositories/${id}/conversations`, { method: "POST", data: {} });
    setConversation(conv);
  };

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      <div className="flex items-center justify-end mb-sm shrink-0">
        <Button variant="ghost" onClick={handleNewChat} disabled={!conversation} className="gap-xxs">
          <Plus className="w-3.5 h-3.5" />
          New chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto mb-md space-y-lg pr-sm">
        {messages.length === 0 && !isThinking && (
          <div className="flex h-full flex-col items-center justify-center gap-md text-center">
            <p className="text-mute text-[14px]">Ask a question about this codebase to get started.</p>
            <div className="flex flex-wrap justify-center gap-xs max-w-[520px]">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendQuestion(q)}
                  disabled={!conversation}
                  className="text-[13px] text-body px-sm py-xs rounded-full border border-hairline hover:border-hairline-strong hover:text-ink transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "USER" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] px-md py-sm ${
                msg.role === "USER"
                  ? "bg-canvas-soft border border-hairline rounded-[16px] rounded-br-none text-ink"
                  : "bg-transparent text-ink"
              }`}
            >
              <div className="text-[14px] leading-relaxed whitespace-pre-wrap">
                {msg.role === "ASSISTANT"
                  ? renderAnswer(msg.content, msg.citations, handleCitationClick)
                  : msg.content}
              </div>
            </div>
          </div>
        ))}
        {isThinking && (
          // The backend does not stream tokens — askQuestion() /
          // chat-stream.handler.ts return one complete chat:complete
          // message, no partial payloads. A fake per-character
          // typewriter effect here would be showing motion that isn't
          // backed by real incremental data, so this is a single
          // "thinking" indicator instead, replaced by the full answer
          // at once when chat:complete arrives.
          <div className="flex justify-start">
            <div className="px-md py-sm text-mute text-[14px] flex items-center gap-xs">
              <span className="inline-block w-1.5 h-1.5 bg-mute rounded-full animate-pulse" />
              <span className="inline-block w-1.5 h-1.5 bg-mute rounded-full animate-pulse [animation-delay:150ms]" />
              <span className="inline-block w-1.5 h-1.5 bg-mute rounded-full animate-pulse [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && <p className="text-error text-[14px] mb-sm">{error}</p>}

      {activeCitation && (
        <div className="flex-shrink-0 mb-md rounded-sm border border-hairline overflow-hidden">
          <div className="flex items-center justify-between px-sm py-xs bg-canvas-soft border-b border-hairline">
            <span className="text-[12px] font-mono text-mute">
              {activeCitation.file}:{activeCitation.startLine}-{activeCitation.endLine}
            </span>
            <button
              type="button"
              onClick={() => setActiveCitation(null)}
              className="text-[12px] text-mute hover:text-ink transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
          {chunkLoading ? (
            <div className="text-mute text-[12px] px-sm py-sm">Loading code...</div>
          ) : chunkError ? (
            <div className="text-error-deep text-[12px] px-sm py-sm">{chunkError}</div>
          ) : chunkCache[activeCitation.chunkId] ? (
            <MonacoCodeViewer
              line={activeCitation.startLine}
              content={chunkCache[activeCitation.chunkId].content}
              language={chunkCache[activeCitation.chunkId].language}
            />
          ) : null}
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative flex-shrink-0 border-t border-hairline pt-md">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about the repository..."
          variant="lg"
          className="pr-[80px]"
          disabled={!conversation}
        />
        <Button
          type="submit"
          variant="primary-sm"
          className="absolute right-2 top-[24px] px-md"
          disabled={!input.trim() || !conversation}
        >
          Send
        </Button>
      </form>
    </div>
  );
}

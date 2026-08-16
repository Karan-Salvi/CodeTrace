import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../lib/api-client";
import { wsClient } from "../lib/websocket";
import type { ChatCompleteMessage, WsErrorMessage } from "../lib/websocket";
import type { Conversation, Message } from "../types";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

const CITATION_PATTERN = /\[([^\]:]+):(\d+)-(\d+)\]/g;

// Splits an answer's text on the backend's own citation-marker format
// ([path/to/file.ts:10-25], chat.service.ts's CITATION_PATTERN) and
// renders each occurrence that the server actually validated (present
// in `citations`) as a distinct badge — any marker text NOT in
// `citations` is left as plain text, since the server didn't vouch for
// it (docs/retrieval.md's citation-validation contract: unsupported
// claims are stripped/regenerated server-side, so a marker surviving
// into `answer` but missing from `citations` means it didn't pass
// validation and must not be presented as a real reference).
function renderAnswer(answer: string, citations: Message["citations"]) {
  const validKeys = new Set(citations.map((c) => `${c.file}:${c.startLine}-${c.endLine}`));
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  CITATION_PATTERN.lastIndex = 0;

  while ((match = CITATION_PATTERN.exec(answer)) !== null) {
    const [full, file, start, end] = match;
    parts.push(answer.slice(lastIndex, match.index));
    const key = `${file}:${start}-${end}`;
    if (validKeys.has(key)) {
      parts.push(
        <span
          key={`${match.index}-${key}`}
          className="inline-block px-xs py-[1px] mx-[2px] text-[11px] font-mono bg-canvas-soft-2 text-body rounded-xs border border-hairline"
        >
          {file}:{start}-{end}
        </span>
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

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function init() {
      // No conversation-list/pick UI in this MVP (out of scope per the
      // plan) — start a fresh conversation each time this page loads.
      const conv = await apiFetch<Conversation>(`/repositories/${id}/conversations`, {
        method: "POST",
        data: {},
      });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !id || !conversation) return;

    setError("");
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        conversationId: conversation.id,
        role: "USER",
        content: input,
        citations: [],
        createdAt: new Date().toISOString(),
      },
    ]);
    setIsThinking(true);
    wsClient.sendChatMessage(id, conversation.id, input);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      <div className="flex-1 overflow-y-auto mb-md space-y-lg pr-sm">
        {messages.length === 0 && !isThinking && (
          <div className="flex h-full items-center justify-center text-mute text-[14px]">
            Start a conversation about your codebase.
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
                {msg.role === "ASSISTANT" ? renderAnswer(msg.content, msg.citations) : msg.content}
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

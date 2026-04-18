import { useEffect, useRef } from "react";
import { ChatSession } from "../types";
import MessageBubble from "./MessageBubble";

interface Props {
  session: ChatSession | null;
  highlightQuery?: string;
  scrollToMessageId?: string | null;
}

export default function ChatView({ session, highlightQuery, scrollToMessageId }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (scrollToMessageId) {
      const el = messageRefs.current.get(scrollToMessageId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages, scrollToMessageId]);

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
        Select a chat or start a new one
      </div>
    );
  }

  if (session.messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-2xl font-semibold text-text-primary">Vertical</p>
          <p className="text-text-muted text-sm">
            Start a conversation with {session.provider === "claude" ? "Claude Code" : "OpenAI / Codex CLI"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
      {session.messages.map((msg) => (
        <div
          key={msg.id}
          ref={(el) => {
            if (el) messageRefs.current.set(msg.id, el);
            else messageRefs.current.delete(msg.id);
          }}
        >
          <MessageBubble
            message={msg}
            highlightQuery={highlightQuery}
            provider={session.provider}
          />
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

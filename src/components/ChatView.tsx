import { useEffect, useRef } from "react";
import { ChatSession } from "../types";
import MessageBubble from "./MessageBubble";

interface Props {
  session: ChatSession | null;
}

export default function ChatView({ session }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages]);

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
            Start a conversation with {session.provider === "claude" ? "Claude Code" : "Codex CLI"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
      {session.messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

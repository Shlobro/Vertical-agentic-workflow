import { motion } from "framer-motion";
import { Message } from "../types";

interface Props {
  message: Message;
  highlightQuery?: string;
}

export default function MessageBubble({ message, highlightQuery }: Props) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-3`}
    >
      <div
        className={`
          max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap select-text
          ${isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-surface text-text-primary rounded-bl-sm border border-border"
          }
        `}
      >
        {message.streaming && !message.text ? (
          <TypingIndicator />
        ) : (
          <>
            {highlightQuery
              ? renderHighlighted(message.text, highlightQuery)
              : message.text}
            {message.streaming && <span className="animate-pulse ml-1" aria-hidden="true">|</span>}
          </>
        )}
      </div>
    </motion.div>
  );
}

function renderHighlighted(text: string, query: string) {
  const q = query.trim();
  console.log("[search] renderHighlighted", { q, textSnippet: text.slice(0, 40) });
  if (!q) return <>{text}</>;

  const parts = text.split(new RegExp(`(${escapeRegex(q)})`, "gi"));
  const qLower = q.toLowerCase();

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === qLower ? (
          <mark key={i} className="bg-yellow-300 text-black rounded-sm px-0.5 not-italic">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center h-5">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-text-muted"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

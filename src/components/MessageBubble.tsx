import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Message, Provider } from "../types";
import { PROVIDER_ICONS } from "../assets/providerIcons";

interface Props {
  message: Message;
  sessionProvider?: Provider;
  highlightQuery?: string;
}

export default function MessageBubble({ message, sessionProvider, highlightQuery }: Props) {
  const isUser = message.role === "user";
  const resolvedProvider = message.provider ?? sessionProvider;

  if (message.isContextHandoff) {
    return <HandoffBlock message={message} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-3`}
    >
      {!isUser && resolvedProvider && (
        <img
          src={PROVIDER_ICONS[resolvedProvider]}
          alt={`${resolvedProvider} provider`}
          className="w-4 h-4 object-contain opacity-70 flex-shrink-0 mt-3 mr-2 self-start"
        />
      )}
      {!isUser && !resolvedProvider && (
        <div className="w-4 h-4 flex-shrink-0 mt-3 mr-2 self-start" />
      )}
      <div
        className={`
          message-bubble-wrap chat-font-base min-w-0 max-w-[70%] rounded-2xl px-4 py-3 whitespace-pre-wrap select-text
          ${isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-surface text-text-primary rounded-bl-sm border border-border"
          }
        `}
      >
        {message.streaming && !message.text ? (
          resolvedProvider ? <ProviderSpinner provider={resolvedProvider} /> : <TypingIndicator />
        ) : (
          <>
            {highlightQuery
              ? renderHighlighted(message.text, highlightQuery)
              : message.text}
            {message.streaming && resolvedProvider && (
              <ProviderSpinner provider={resolvedProvider} inline />
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

function HandoffBlock({ message }: { message: Message }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex w-full justify-start mb-3"
    >
      <div className="w-full max-w-[70%] rounded-xl border border-border bg-surface/50 overflow-hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          className="chat-font-small flex w-full items-center justify-between px-3 py-2 text-text-muted hover:text-text-primary transition-colors"
        >
          <span>Context from previous conversation</span>
          <ChevronDown
            size={12}
            className={`flex-shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <div className="message-bubble-wrap chat-font-small px-3 pb-3 text-text-muted whitespace-pre-wrap border-t border-border pt-2 max-h-48 overflow-y-auto">
            {message.text.replace(/^You are an AI assistant taking over.*?Here is the conversation so far:\n\n/s, "")}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function renderHighlighted(text: string, query: string) {
  const q = query.trim();
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

function ProviderSpinner({ provider, inline = false }: { provider: Provider; inline?: boolean }) {
  return (
    <span
      data-testid="message-streaming-spinner"
      className={inline ? "ml-1 inline-flex h-5 w-5 translate-y-0.5 align-text-bottom items-center justify-center" : "flex h-5 w-5 items-center justify-center"}
    >
      <motion.img
        src={PROVIDER_ICONS[provider]}
        alt=""
        aria-hidden="true"
        className="w-5 h-5 object-contain"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
      />
    </span>
  );
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

import { motion } from "framer-motion";
import { Message, Provider } from "../types";
import { PROVIDER_ICONS } from "../assets/providerIcons";

interface Props {
  message: Message;
  highlightQuery?: string;
  provider?: Provider;
}

export default function MessageBubble({ message, highlightQuery, provider }: Props) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-3`}
    >
      {!isUser && provider && (
        <img
          src={PROVIDER_ICONS[provider]}
          alt={`${provider} provider`}
          className="w-4 h-4 object-contain opacity-70 flex-shrink-0 mt-3 mr-2 self-start"
        />
      )}
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
          provider ? <ProviderSpinner provider={provider} /> : <TypingIndicator />
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

function ProviderSpinner({ provider }: { provider: Provider }) {
  return (
    <div className="flex items-center justify-center h-5 w-5">
      <motion.img
        src={PROVIDER_ICONS[provider]}
        alt=""
        aria-hidden="true"
        className="w-5 h-5 object-contain"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
      />
    </div>
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

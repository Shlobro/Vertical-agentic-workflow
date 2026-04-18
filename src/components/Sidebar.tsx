import { useState } from "react";
import { Plus, MessageSquare } from "lucide-react";
import { Provider, PROVIDERS, MODELS } from "../types";
import { ChatSession } from "../types";
import claudeLogo from "../assets/claude_logo.png";
import openaiLogo from "../assets/openai_logo.png";

const LOGOS: Record<Provider, string> = {
  claude: claudeLogo,
  codex: openaiLogo,
};

interface Props {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: (provider: Provider, model: string) => void;
  onSelectSession: (id: string) => void;
}

export default function Sidebar({ sessions, activeSessionId, onNewChat, onSelectSession }: Props) {
  const [provider, setProvider] = useState<Provider>("claude");
  const [model, setModel] = useState(MODELS.claude[0].id);

  function handleProviderChange(p: Provider) {
    setProvider(p);
    setModel(MODELS[p][0].id);
  }

  return (
    <div className="w-60 flex-shrink-0 flex flex-col bg-bg-sidebar border-r border-border h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-lg font-bold text-text-primary tracking-tight">Vertical</h1>
        <p className="text-xs text-text-muted mt-0.5">CLI Chat Interface</p>
      </div>

      <div className="px-3 space-y-2 pb-3 border-b border-border">
        {/* Provider selector */}
        <div>
          <label className="text-xs text-text-muted uppercase tracking-wider font-medium block mb-1">Provider</label>
          <div className="flex gap-1">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => handleProviderChange(p.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  provider === p.id
                    ? "bg-blue-600 text-white"
                    : "bg-surface text-text-muted hover:text-text-primary hover:bg-surface-hover"
                }`}
              >
                <img src={LOGOS[p.id]} alt={p.label} className="w-3.5 h-3.5 object-contain" />
                {p.id === "claude" ? "Claude" : "OpenAI"}
              </button>
            ))}
          </div>
        </div>

        {/* Model selector */}
        <div>
          <label className="text-xs text-text-muted uppercase tracking-wider font-medium block mb-1">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-surface border border-border text-text-primary text-xs rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 transition-colors"
          >
            {MODELS[provider].map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* New Chat button */}
        <button
          onClick={() => onNewChat(provider, model)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          New Chat
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {sessions.length === 0 && (
          <p className="text-xs text-text-muted text-center py-4">No chats yet</p>
        )}
        {[...sessions].reverse().map((sess) => (
          <button
            key={sess.id}
            onClick={() => onSelectSession(sess.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
              sess.id === activeSessionId
                ? "bg-blue-600/20 text-blue-400"
                : "text-text-muted hover:text-text-primary hover:bg-surface"
            }`}
          >
            <MessageSquare size={13} className="flex-shrink-0" />
            <span className="truncate flex-1">{sess.title}</span>
            {sess.isStreaming && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0 animate-pulse" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

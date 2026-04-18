import { useRef, KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";
import { Provider, PROVIDERS, MODELS } from "../types";
import claudeLogo from "../assets/claude_logo.png";
import openaiLogo from "../assets/openai_logo.png";

const LOGOS: Record<Provider, string> = {
  claude: claudeLogo,
  codex: openaiLogo,
};

interface Props {
  disabled: boolean;
  streaming: boolean;
  provider: Provider;
  model: string;
  onProviderChange: (p: Provider) => void;
  onModelChange: (m: string) => void;
  onSend: (text: string) => void;
  onCancel: () => void;
}

export default function InputBar({ disabled, streaming, provider, model, onProviderChange, onModelChange, onSend, onCancel }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const text = ref.current?.value.trim();
    if (!text || disabled) return;
    ref.current!.value = "";
    ref.current!.style.height = "auto";
    onSend(text);
  }

  function autoResize() {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = Math.min(ref.current.scrollHeight, 120) + "px";
  }

  return (
    <div className="px-4 py-3 border-t border-border bg-bg-primary">
      {/* Provider + model row */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex gap-1">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => onProviderChange(p.id)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
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
        <select
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          className="flex-1 bg-surface border border-border text-text-primary text-xs rounded-lg px-2 py-1 outline-none focus:border-blue-500 transition-colors"
        >
          {MODELS[provider].map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Input row */}
      <div className="flex items-end gap-2 bg-surface rounded-xl border border-border px-3 py-2">
        <label htmlFor="chat-input" className="sr-only">Message</label>
        <textarea
          id="chat-input"
          ref={ref}
          rows={1}
          placeholder="Message..."
          disabled={streaming}
          onKeyDown={handleKeyDown}
          onInput={autoResize}
          className="flex-1 bg-transparent resize-none outline-none text-sm text-text-primary placeholder-text-muted leading-relaxed max-h-[120px] overflow-y-auto"
        />
        {streaming ? (
          <button
            onClick={onCancel}
            aria-label="Cancel response"
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          >
            <Square size={14} />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={disabled}
            aria-label="Send message"
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={14} />
          </button>
        )}
      </div>
      <p className="text-xs text-text-muted mt-1.5 text-center">
        Enter to send | Shift+Enter for newline
      </p>
    </div>
  );
}

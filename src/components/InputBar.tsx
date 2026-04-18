import { useRef, useState, useEffect, KeyboardEvent } from "react";
import { Send, Square, ChevronDown, Check } from "lucide-react";
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

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

  function selectProvider(p: Provider) {
    onProviderChange(p);
  }

  function selectModel(m: string) {
    onModelChange(m);
    setOpen(false);
  }

  const activeModel = MODELS[provider].find((m) => m.id === model);
  const shortModelLabel = activeModel?.label.replace(/^(Claude|GPT-\S+)\s*/i, "") || activeModel?.label || model;

  return (
    <div className="px-4 py-3 border-t border-border bg-bg-primary">
      <div className="flex items-end gap-2 bg-surface rounded-xl border border-border px-3 py-2">

        {/* Provider + model picker */}
        <div ref={dropdownRef} className="relative flex-shrink-0 self-center">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all group"
          >
            <img src={LOGOS[provider]} alt={provider} className="w-4 h-4 object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
            <span className="max-w-[80px] truncate">{shortModelLabel}</span>
            <ChevronDown size={11} className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
          </button>

          {open && (
            <div className="absolute bottom-full left-0 mb-2 w-56 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-50">
              {/* Provider tabs */}
              <div className="flex border-b border-border">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectProvider(p.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                      provider === p.id
                        ? "text-text-primary border-b-2 border-blue-500 bg-surface-hover"
                        : "text-text-muted hover:text-text-primary hover:bg-surface-hover"
                    }`}
                  >
                    <img src={LOGOS[p.id]} alt={p.label} className="w-3.5 h-3.5 object-contain" />
                    {p.id === "claude" ? "Claude" : "OpenAI"}
                  </button>
                ))}
              </div>

              {/* Model list */}
              <div className="py-1 max-h-52 overflow-y-auto">
                {MODELS[provider].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => selectModel(m.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                      model === m.id
                        ? "text-text-primary bg-blue-600/15"
                        : "text-text-muted hover:text-text-primary hover:bg-surface-hover"
                    }`}
                  >
                    <span>{m.label}</span>
                    {model === m.id && <Check size={11} className="text-blue-400 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px self-stretch bg-border flex-shrink-0" />

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

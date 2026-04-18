import { useRef, useState, useEffect, KeyboardEvent } from "react";
import { Send, Square, ChevronDown, Check } from "lucide-react";
import { Provider, PROVIDERS, MODELS } from "../types";
import { PROVIDER_ICONS } from "../assets/providerIcons";

interface Props {
  streaming: boolean;
  provider: Provider;
  model: string;
  onProviderChange: (p: Provider) => void;
  onModelChange: (m: string) => void;
  onSend: (text: string) => void;
  onCancel: () => void;
}

export default function InputBar({
  streaming,
  provider,
  model,
  onProviderChange,
  onModelChange,
  onSend,
  onCancel,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const providerDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const [providerOpen, setProviderOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [hasText, setHasText] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(event.target as Node)) {
        setProviderOpen(false);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setModelOpen(false);
      }
    }

    if (providerOpen || modelOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [providerOpen, modelOpen]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  function submit() {
    const text = ref.current?.value.trim();
    if (!text) return;
    ref.current!.value = "";
    ref.current!.style.height = "auto";
    setHasText(false);
    onSend(text);
  }

  function autoResize() {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = `${Math.min(ref.current.scrollHeight, 120)}px`;
    setHasText(ref.current.value.trim().length > 0);
  }

  function selectProvider(nextProvider: Provider) {
    onProviderChange(nextProvider);
    setProviderOpen(false);
  }

  function selectModel(nextModel: string) {
    onModelChange(nextModel);
    setModelOpen(false);
  }

  const activeProvider = PROVIDERS.find((p) => p.id === provider);
  const activeModel = MODELS[provider].find((m) => m.id === model);

  return (
    <div className="px-4 py-3 border-t border-border bg-bg-primary">
      <div className="flex flex-col rounded-xl border border-border bg-surface px-3 pt-2 pb-2">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-input"
          ref={ref}
          rows={1}
          placeholder="Message..."
          disabled={streaming}
          onKeyDown={handleKeyDown}
          onInput={autoResize}
          className="chat-input-font mb-2 max-h-[120px] w-full resize-none overflow-y-auto bg-transparent text-[17px] leading-relaxed text-text-primary outline-none placeholder-text-muted"
        />

        <div className="flex items-center justify-end gap-1">
          {/* Provider dropdown */}
          <div ref={providerDropdownRef} className="relative">
            <button
              onClick={() => { setProviderOpen((v) => !v); setModelOpen(false); }}
              aria-label="Select provider"
              className="group flex w-24 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-text-muted transition-all hover:bg-surface-hover hover:text-text-primary"
            >
              <img
                src={PROVIDER_ICONS[provider]}
                alt={provider}
                className="h-4 w-4 flex-shrink-0 object-contain opacity-80 transition-opacity group-hover:opacity-100"
              />
              <span className="flex-1 truncate">
                {activeProvider?.id === "claude" ? "Claude" : activeProvider?.id === "codex" ? "OpenAI" : "Gemini"}
              </span>
              <ChevronDown size={11} className={`transition-transform duration-150 ${providerOpen ? "rotate-180" : ""}`} />
            </button>

            {providerOpen && (
              <div className="absolute bottom-full right-0 z-50 mb-2 w-36 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl py-1">
                {PROVIDERS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => selectProvider(item.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                      provider === item.id
                        ? "bg-blue-600/15 text-text-primary"
                        : "text-text-muted hover:bg-surface-hover hover:text-text-primary"
                    }`}
                  >
                    <img src={PROVIDER_ICONS[item.id]} alt={item.label} className="h-3.5 w-3.5 object-contain" />
                    <span>{item.id === "claude" ? "Claude" : item.id === "codex" ? "OpenAI" : "Gemini"}</span>
                    {provider === item.id && <Check size={11} className="ml-auto flex-shrink-0 text-blue-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Model dropdown */}
          <div ref={modelDropdownRef} className="relative">
            <button
              onClick={() => { setModelOpen((v) => !v); setProviderOpen(false); }}
              aria-label="Select model"
              className="group flex w-36 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-text-muted transition-all hover:bg-surface-hover hover:text-text-primary"
            >
              <span className="flex-1 truncate text-left">
                {activeModel?.label.replace(/^(Claude|Gemini)\s*/i, "") || activeModel?.label || model}
              </span>
              <ChevronDown size={11} className={`transition-transform duration-150 ${modelOpen ? "rotate-180" : ""}`} />
            </button>

            {modelOpen && (
              <div className="absolute bottom-full right-0 z-50 mb-2 w-52 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
                <div className="max-h-52 overflow-y-auto py-1">
                  {MODELS[provider].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => selectModel(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                        model === item.id
                          ? "bg-blue-600/15 text-text-primary"
                          : "text-text-muted hover:bg-surface-hover hover:text-text-primary"
                      }`}
                    >
                      <span>{item.label}</span>
                      {model === item.id && <Check size={11} className="flex-shrink-0 text-blue-400" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {streaming ? (
            <button
              onClick={onCancel}
              aria-label="Cancel response"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20 text-red-400 transition-colors hover:bg-red-500/30"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!hasText}
              aria-label="Send message"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

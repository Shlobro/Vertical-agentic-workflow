import { useRef, KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";

interface Props {
  disabled: boolean;
  streaming: boolean;
  onSend: (text: string) => void;
  onCancel: () => void;
}

export default function InputBar({ disabled, streaming, onSend, onCancel }: Props) {
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

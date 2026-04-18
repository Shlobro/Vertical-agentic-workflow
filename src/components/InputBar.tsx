import { useEffect, useId, useRef, useState, KeyboardEvent } from "react";
import { Send, Square, ChevronDown, Check } from "lucide-react";
import { Provider, PROVIDERS, MODELS } from "../types";
import { PROVIDER_ICONS } from "../assets/providerIcons";

interface Props {
  streaming: boolean;
  provider: Provider;
  model: string;
  projectFilePaths: string[];
  onProviderChange: (p: Provider) => void;
  onModelChange: (m: string) => void;
  onSend: (text: string) => void;
  onCancel: () => void;
}

interface MentionOption {
  path: string;
  score: number;
}

interface MentionState {
  start: number;
  end: number;
  query: string;
  options: MentionOption[];
}

const MAX_INPUT_BAR_HEIGHT_RATIO = 0.5;
const MAX_MENTION_OPTIONS = 8;
const DEFAULT_MENTION_LIST_MAX_HEIGHT = 224;
const MIN_MENTION_LIST_MAX_HEIGHT = 96;
const MENTION_LIST_VIEWPORT_MARGIN = 16;

export default function InputBar({
  streaming,
  provider,
  model,
  projectFilePaths,
  onProviderChange,
  onModelChange,
  onSend,
  onCancel,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const providerDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const mentionListId = useId();
  const [providerOpen, setProviderOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [text, setText] = useState("");
  const [mentionState, setMentionState] = useState<MentionState | null>(null);
  const [highlightedMentionIndex, setHighlightedMentionIndex] = useState(0);
  const [mentionPlacement, setMentionPlacement] = useState<"above" | "below">("below");
  const [mentionMaxHeight, setMentionMaxHeight] = useState(DEFAULT_MENTION_LIST_MAX_HEIGHT);
  const mentionOpen = !!mentionState && mentionState.options.length > 0;

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

  useEffect(() => {
    const nextMentionState = getMentionState(text, ref.current?.selectionStart ?? text.length, projectFilePaths);
    setMentionState(nextMentionState);
    setHighlightedMentionIndex((current) => {
      if (!nextMentionState || nextMentionState.options.length === 0) {
        return 0;
      }
      return Math.min(current, nextMentionState.options.length - 1);
    });
  }, [text, projectFilePaths]);

  useEffect(() => {
    if (!mentionOpen) {
      return;
    }

    const updateMentionLayout = () => {
      if (!containerRef.current) {
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const spaceAbove = Math.max(0, rect.top - MENTION_LIST_VIEWPORT_MARGIN);
      const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - MENTION_LIST_VIEWPORT_MARGIN);
      const shouldPlaceAbove = spaceBelow < MIN_MENTION_LIST_MAX_HEIGHT && spaceAbove > spaceBelow;
      const availableSpace = shouldPlaceAbove ? spaceAbove : spaceBelow;

      setMentionPlacement(shouldPlaceAbove ? "above" : "below");
      setMentionMaxHeight(
        Math.max(
          MIN_MENTION_LIST_MAX_HEIGHT,
          Math.min(DEFAULT_MENTION_LIST_MAX_HEIGHT, Math.floor(availableSpace)),
        ),
      );
    };

    updateMentionLayout();
    window.addEventListener("resize", updateMentionLayout);

    return () => {
      window.removeEventListener("resize", updateMentionLayout);
    };
  }, [mentionOpen]);

  useEffect(() => {
    const handleWindowResize = () => resizeTextarea();

    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionState && mentionState.options.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedMentionIndex((current) => (current + 1) % mentionState.options.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedMentionIndex((current) => (current - 1 + mentionState.options.length) % mentionState.options.length);
        return;
      }

      if (event.key === "Tab" || event.key === "Enter") {
        event.preventDefault();
        applyMention(mentionState.options[highlightedMentionIndex]?.path ?? mentionState.options[0].path);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setMentionState(null);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  function submit() {
    const nextText = text.trim();
    if (!nextText) return;
    setText("");
    resizeTextarea();
    setMentionState(null);
    onSend(nextText);
  }

  function getMaxTextareaHeight() {
    if (!ref.current || !wrapperRef.current) {
      return Math.floor(window.innerHeight * MAX_INPUT_BAR_HEIGHT_RATIO);
    }

    const maxInputBarHeight = Math.floor(window.innerHeight * MAX_INPUT_BAR_HEIGHT_RATIO);
    const chromeHeight = Math.max(0, wrapperRef.current.offsetHeight - ref.current.offsetHeight);
    const minimumVisibleHeight = ref.current.clientHeight || ref.current.rows * 24;
    return Math.max(minimumVisibleHeight, maxInputBarHeight - chromeHeight);
  }

  function resizeTextarea(nextValue?: string) {
    if (typeof nextValue === "string") {
      setText(nextValue);
    }

    requestAnimationFrame(() => {
      if (!ref.current) return;
      ref.current.style.height = "auto";
      ref.current.style.height = `${Math.min(ref.current.scrollHeight, getMaxTextareaHeight())}px`;
    });
  }

  function autoResize(nextValue: string) {
    resizeTextarea(nextValue);
  }

  function selectProvider(nextProvider: Provider) {
    onProviderChange(nextProvider);
    setProviderOpen(false);
  }

  function selectModel(nextModel: string) {
    onModelChange(nextModel);
    setModelOpen(false);
  }

  function applyMention(path: string) {
    if (!mentionState || !ref.current) return;

    const completedPath = `${path} `;
    const nextText = `${text.slice(0, mentionState.start)}${completedPath}${text.slice(mentionState.end)}`;
    const nextCursorPosition = mentionState.start + completedPath.length;
    setText(nextText);
    setMentionState(null);

    requestAnimationFrame(() => {
      if (!ref.current) return;
      ref.current.focus();
      ref.current.selectionStart = nextCursorPosition;
      ref.current.selectionEnd = nextCursorPosition;
      resizeTextarea();
    });
  }

  const activeProvider = PROVIDERS.find((p) => p.id === provider);
  const activeModel = MODELS[provider].find((m) => m.id === model);
  const hasText = text.trim().length > 0;
  const activeMentionId =
    mentionOpen
      ? `${mentionListId}-option-${highlightedMentionIndex}`
      : undefined;
  const compactControlStyle = {
    minHeight: "var(--input-control-height)",
    width: "var(--input-provider-control-width)",
    paddingInline: "var(--input-control-padding-x)",
    paddingBlock: "var(--input-control-padding-y)",
    gap: "var(--input-control-gap)",
  } as const;
  const modelControlStyle = {
    ...compactControlStyle,
    width: "var(--input-model-control-width)",
  } as const;
  const compactIconStyle = {
    width: "var(--input-control-icon-size)",
    height: "var(--input-control-icon-size)",
  } as const;
  const compactChevronStyle = {
    width: "var(--input-control-chevron-size)",
    height: "var(--input-control-chevron-size)",
  } as const;
  const actionButtonStyle = {
    width: "var(--input-action-size)",
    height: "var(--input-action-size)",
  } as const;

  return (
    <div ref={wrapperRef} className="max-h-[50vh] px-4 py-4 border-t border-border bg-bg-primary">
      <div ref={containerRef} className="relative flex max-h-full flex-col rounded-xl border border-border bg-surface px-3 pt-2 pb-2">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-input"
          ref={ref}
          rows={1}
          placeholder="Message..."
          disabled={streaming}
          value={text}
          onKeyDown={handleKeyDown}
          onClick={() => setMentionState(getMentionState(text, ref.current?.selectionStart ?? text.length, projectFilePaths))}
          onKeyUp={() => setMentionState(getMentionState(text, ref.current?.selectionStart ?? text.length, projectFilePaths))}
          onChange={(event) => autoResize(event.target.value)}
          className="chat-input-font input-font-base mb-2 w-full resize-none overflow-y-auto bg-transparent text-text-primary outline-none placeholder-text-muted"
          aria-autocomplete="list"
          aria-controls={mentionOpen ? mentionListId : undefined}
          aria-expanded={mentionOpen ? true : undefined}
          aria-activedescendant={activeMentionId}
        />

        {mentionOpen && (
          <div
            id={mentionListId}
            role="listbox"
            aria-label="File suggestions"
            data-placement={mentionPlacement}
            className={`absolute left-3 right-3 z-50 overflow-hidden rounded-xl border border-border bg-bg-primary shadow-2xl ${
              mentionPlacement === "above" ? "bottom-full mb-2" : "top-full mt-2"
            }`}
          >
            <div className="overflow-y-auto py-1" style={{ maxHeight: `${mentionMaxHeight}px` }}>
              {mentionState.options.map((option, index) => (
                <button
                  key={option.path}
                  id={`${mentionListId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === highlightedMentionIndex}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applyMention(option.path);
                  }}
                  onMouseEnter={() => setHighlightedMentionIndex(index)}
                  className={`input-font-small flex w-full items-center px-3 py-2 text-left transition-colors ${
                    index === highlightedMentionIndex
                      ? "bg-blue-600/15 text-text-primary"
                      : "text-text-muted hover:bg-surface-hover hover:text-text-primary"
                  }`}
                >
                  <span className="truncate">{option.path}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-1">
          {/* Provider dropdown */}
          <div ref={providerDropdownRef} className="relative">
            <button
              onClick={() => { setProviderOpen((v) => !v); setModelOpen(false); }}
              aria-label="Select provider"
              className="input-font-small group flex items-center rounded-lg text-text-muted transition-all hover:bg-surface-hover hover:text-text-primary"
              style={compactControlStyle}
            >
              <img
                src={PROVIDER_ICONS[provider]}
                alt={provider}
                className="flex-shrink-0 object-contain opacity-80 transition-opacity group-hover:opacity-100"
                style={compactIconStyle}
              />
              <span className="flex-1 truncate">
                {activeProvider?.id === "claude" ? "Claude" : activeProvider?.id === "codex" ? "OpenAI" : "Gemini"}
              </span>
              <ChevronDown
                className={`flex-shrink-0 transition-transform duration-150 ${providerOpen ? "rotate-180" : ""}`}
                style={compactChevronStyle}
              />
            </button>

            {providerOpen && (
              <div
                className="absolute bottom-full right-0 z-50 mb-2 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl py-1"
                style={{ width: "var(--input-provider-menu-width)" }}
              >
                {PROVIDERS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => selectProvider(item.id)}
                    className={`input-font-small w-full flex items-center gap-2 px-3 py-2 transition-colors ${
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
              className="input-font-small group flex items-center rounded-lg text-text-muted transition-all hover:bg-surface-hover hover:text-text-primary"
              style={modelControlStyle}
            >
              <span className="flex-1 truncate text-left">
                {activeModel?.label.replace(/^(Claude|Gemini)\s*/i, "") || activeModel?.label || model}
              </span>
              <ChevronDown
                className={`flex-shrink-0 transition-transform duration-150 ${modelOpen ? "rotate-180" : ""}`}
                style={compactChevronStyle}
              />
            </button>

            {modelOpen && (
              <div
                className="absolute bottom-full right-0 z-50 mb-2 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
                style={{ width: "var(--input-model-menu-width)" }}
              >
                <div className="max-h-52 overflow-y-auto py-1">
                  {MODELS[provider].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => selectModel(item.id)}
                      className={`input-font-small w-full flex items-center justify-between px-3 py-2 transition-colors ${
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
              style={actionButtonStyle}
            >
              <Square style={compactIconStyle} />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!hasText}
              aria-label="Send message"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
              style={actionButtonStyle}
            >
              <Send style={compactIconStyle} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function getMentionState(text: string, cursor: number, projectFilePaths: string[]): MentionState | null {
  const mentionRange = findMentionRange(text, cursor);
  if (!mentionRange) {
    return null;
  }

  const options = rankMentionOptions(projectFilePaths, mentionRange.query);
  if (options.length === 0) {
    return null;
  }

  return {
    ...mentionRange,
    options,
  };
}

function findMentionRange(text: string, cursor: number) {
  const safeCursor = Math.max(0, Math.min(cursor, text.length));
  let start = safeCursor - 1;

  while (start >= 0) {
    const character = text[start];
    if (character === "@") {
      break;
    }
    if (/\s/.test(character)) {
      return null;
    }
    start -= 1;
  }

  if (start < 0 || text[start] !== "@") {
    return null;
  }

  const query = text.slice(start + 1, safeCursor);
  if (query.includes("@")) {
    return null;
  }

  return {
    start,
    end: safeCursor,
    query,
  };
}

function rankMentionOptions(projectFilePaths: string[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const scored = projectFilePaths
    .map((path) => ({ path, score: scoreMentionPath(path, normalizedQuery) }))
    .filter((option): option is MentionOption => option.score !== null)
    .sort((left, right) => {
      const scoreDifference = right.score - left.score;
      return scoreDifference !== 0 ? scoreDifference : left.path.localeCompare(right.path);
    });

  return scored.slice(0, MAX_MENTION_OPTIONS);
}

function scoreMentionPath(path: string, query: string) {
  if (query.length === 0) {
    return 1;
  }

  const normalizedPath = path.toLowerCase();
  const basename = normalizedPath.split("/").pop() ?? normalizedPath;

  if (normalizedPath === query) {
    return 120;
  }
  if (basename === query) {
    return 110;
  }
  if (basename.startsWith(query)) {
    return 100 - basename.length;
  }
  if (normalizedPath.startsWith(query)) {
    return 90 - normalizedPath.length;
  }
  if (basename.includes(query)) {
    return 70 - basename.indexOf(query);
  }
  if (normalizedPath.includes(query)) {
    return 50 - normalizedPath.indexOf(query);
  }

  return null;
}

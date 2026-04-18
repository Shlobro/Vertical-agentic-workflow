export type Provider = "claude" | "codex" | "gemini";
export type CompanionFileName = "CLAUDE.md" | "AGENTS.md" | "GEMINI.md";

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
  provider?: Provider;
  model?: string;
  isContextHandoff?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  provider: Provider;
  model: string;
  cliSessionId: string;
  messages: Message[];
  isStreaming: boolean;
}

export interface ChatProject {
  id: string;
  title: string;
  workingDir: string;
  collapsed: boolean;
  lastActiveSessionId: string | null;
  sessions: ChatSession[];
}

export interface TextZoomState {
  chatRem: number;
  inputRem: number;
  sidebarRem: number;
}

export interface PersistedWorkspaceState {
  projects: ChatProject[];
  activeSessionId: string | null;
  sidebarWidthRatio: number | null;
  textZoom: TextZoomState | null;
  companionFileSelectionDefaults: CompanionFileName[] | null;
  companionFileTemplate: string | null;
}

export interface MissingCompanionFilesState {
  missingFiles: CompanionFileName[];
}

export interface StreamChunkEvent {
  session_uuid: string;
  text: string;
}

export interface MessageDoneEvent {
  session_uuid: string;
  full_text: string;
  cli_session_id: string;
}

export interface MessageErrorEvent {
  session_uuid: string;
  error: string;
  partial_text: string;
}

export const PROVIDERS: { id: Provider; label: string; logo: string }[] = [
  { id: "claude", label: "Claude Code", logo: "claude_logo.png" },
  { id: "codex", label: "OpenAI / Codex CLI", logo: "openai_logo.png" },
  { id: "gemini", label: "Gemini CLI", logo: "gemini_logo.svg" },
];

export const DEFAULT_MODELS: Record<Provider, string> = {
  claude: "claude-sonnet-4-6",
  codex: "gpt-5.4",
  gemini: "gemini-3-flash-preview",
};

export const MODELS: Record<Provider, { id: string; label: string }[]> = {
  gemini: [
    { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (Preview)" },
    { id: "gemini-3-flash-preview", label: "Gemini 3 Flash (Preview)" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  ],
  claude: [
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { id: "claude-opus-4-7", label: "Claude Opus 4.7" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  ],
  codex: [
    { id: "gpt-5.4", label: "GPT-5.4 (Medium)" },
    { id: "gpt-5.4:low", label: "GPT-5.4 (Low)" },
    { id: "gpt-5.4:high", label: "GPT-5.4 (High)" },
    { id: "gpt-5.4:xhigh", label: "GPT-5.4 (Ultra High)" },
    { id: "gpt-5.3-codex", label: "GPT-5.3 Codex (Medium)" },
    { id: "gpt-5.3-codex:low", label: "GPT-5.3 Codex (Low)" },
    { id: "gpt-5.3-codex:high", label: "GPT-5.3 Codex (High)" },
    { id: "gpt-5.3-codex:xhigh", label: "GPT-5.3 Codex (Ultra High)" },
  ],
};

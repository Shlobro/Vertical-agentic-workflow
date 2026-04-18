export type Provider = "claude" | "codex";

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
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

export const PROVIDERS: { id: Provider; label: string; logo: string }[] = [
  { id: "claude", label: "Claude Code", logo: "claude_logo.png" },
  { id: "codex", label: "Codex CLI", logo: "openai_logo.png" },
];

export const MODELS: Record<Provider, { id: string; label: string }[]> = {
  claude: [
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { id: "claude-opus-4-7", label: "Claude Opus 4.7" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  ],
  codex: [
    { id: "codex-mini-latest", label: "Codex Mini" },
    { id: "o4-mini", label: "o4-mini" },
  ],
};

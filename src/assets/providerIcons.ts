import { Provider } from "../types";
import claudeLogo from "./claude_logo.png";
import openaiLogo from "./openai_logo.png";
import geminiLogo from "./gemini_logo.svg";

export const PROVIDER_ICONS: Record<Provider, string> = {
  claude: claudeLogo,
  codex: openaiLogo,
  gemini: geminiLogo,
};

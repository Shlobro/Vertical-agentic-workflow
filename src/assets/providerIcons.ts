import { Provider } from "../types";
import claudeLogo from "./claude_logo.png";
import openaiLogo from "./openai_logo.png";

export const PROVIDER_ICONS: Record<Provider, string> = {
  claude: claudeLogo,
  codex: openaiLogo,
};

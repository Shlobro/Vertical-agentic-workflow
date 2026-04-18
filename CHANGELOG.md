# Changelog

## 2026-04-18
- Integrated "Plus Jakarta Sans" font for the chat input and increased its font size to 17px for improved readability.
- Replaced the simple provider buttons and model selector with an integrated dropdown picker inside the InputBar for a cleaner, more compact UI.
- Moved provider and model selectors from the Sidebar into the InputBar area at the bottom of the chat. Sidebar now only handles session navigation and new-chat creation. Provider/model state lives in `App.tsx` and is passed down as props.
- Expanded the OpenAI/Codex model catalog to include GPT-5.4 and GPT-5.3 Codex reasoning-effort variants in the frontend.
- Updated the Codex Rust adapter to translate `model:effort` ids into Codex CLI arguments and parse newer nested assistant-message JSON payloads.
- Added frontend and Rust test coverage for OpenAI/Codex session handling and nested Codex output parsing.

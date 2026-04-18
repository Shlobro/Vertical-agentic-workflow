# Vertical Developer Guide

## Purpose
Vertical is a desktop chat client built with Tauri, React, TypeScript, and Rust. It provides a local multi-session UI for sending prompts to Claude Code or the OpenAI/Codex CLI stack, streaming responses back into the app, and resuming provider CLI sessions per chat.

## Top-Level Map
- `src/`: Frontend application. React renders the shell, Zustand stores chat state, and Tailwind v4 theme tokens live in CSS.
- `src-tauri/`: Native shell. Tauri registers commands, spawns CLI processes, parses JSON lines, and emits stream events back to the frontend.
- `public/`: Static Vite assets if the app grows beyond bundled imports.
- `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`: Agent workflow rules for this repository.
- `vertical_developer_guide.md`: Root architecture guide. Read this first before changing code.
- `package.json`: Frontend dependencies and scripts.
- `vite.config.ts`, `tsconfig*.json`, `index.html`: Vite and TypeScript configuration.
- `run.bat`: Local launch helper.

## Runtime Flow
1. The app boots through Vite/Tauri. `src/main.tsx` mounts `App` and imports `src/styles/globals.css`.
2. `src/App.tsx` subscribes to Tauri events once on mount: `stream-chunk`, `message-done`, and `message-error`. Event payload contracts live in `src/types/index.ts`.
3. `Sidebar` creates or switches projects and chat sessions. Each project stores its title, chosen working directory, collapse state, and nested chat list. Each session stores provider, model, title, messages, streaming state, and the provider CLI session identifier.
4. Creating a project opens the directory picker first. Once the user picks a folder, the store creates a project named after that folder and inserts one empty chat inside it.
5. `InputBar` is only rendered when a chat is selected. The selected chat session is the source of truth for its provider/model configuration, and changing either resets that session's saved provider CLI session id.
6. Sending appends the user prompt and a placeholder assistant message into the Zustand store, then invokes the Rust command `send_message` with the selected chat plus the owning project's working directory.
7. `src-tauri/src/commands/chat.rs` maps the provider string to a command builder, starts the external CLI process, tracks the running child per chat session, reads JSON from stdout plus diagnostics from stderr, applies a provider timeout, and emits normalized stream updates back to the frontend.
8. As events arrive, the store updates the in-progress assistant message in place. Completion persists the provider CLI session id so later prompts can resume the same conversation, while failures and cancellations emit a dedicated error event.

## Current Frontend Shape
- The layout is a fixed two-column shell: project and chat controls on the left, conversation on the right.
- Each sidebar project row exposes a collapse arrow, folder icon, persistent new-chat button, and actions menu for inline rename plus delete. Chat rows show the session provider icon and keep their own rename and delete menu.
- `ChatView` handles three empty states: no active session, active session with no messages, and active session with transcript.
- `MessageBubble` animates message entry and uses a typing indicator while the assistant placeholder is still empty.
- `InputBar` handles enter-to-send, shift-enter newline, textarea auto-growth, provider/model selection, and cancellation of the active provider request. It stays hidden until a chat is selected.
- Theme colors come from custom Tailwind tokens in `src/styles/globals.css`. The current visual language is dark, minimal, and blue-accented.

## Current Native Shape
- `src-tauri/src/lib.rs` wires Tauri, registers the opener plugin, and exposes the `send_message` command.
- `src-tauri/capabilities/default.json` grants the dialog open permission used by the working-directory picker and the fs mkdir permission used for the fallback default workspace.
- Provider-specific command construction and JSON parsing live under `src-tauri/src/providers/`.
- `ClaudeProvider` builds `claude --dangerously-skip-permissions --print --output-format stream-json --include-partial-messages ...`.
- `CodexProvider` builds `codex exec --skip-git-repo-check --full-auto --json ...`, supports GPT and Codex model ids, and maps `:<reasoning-effort>` suffixes into Codex CLI config flags.
- The command layer captures stderr for user-visible failures, times out stalled provider runs, and tracks running provider processes so the frontend can cancel them.
- The command layer also resolves common Windows executable suffixes when spawning provider CLIs, falls back to `cmd.exe` for shell-style resolution on Windows, and returns explicit PATH/install errors if a provider executable is unavailable.
- Streaming events now carry the best known full assistant text for the active request, normalizing providers that emit either deltas, cumulative snapshots, or nested assistant-message payloads.

## Change Map
- Application shell and event wiring: `src/App.tsx`
- Project tree and nested chat controls: `src/components/Sidebar.tsx`
- Project/session state transitions: `src/store/chatStore.ts`
- Conversation rendering and scroll behavior: `src/components/ChatView.tsx`, `src/components/MessageBubble.tsx`
- Prompt input and send/cancel controls: `src/components/InputBar.tsx`
- Project, session, transcript, and sidebar action state transitions: `src/store/chatStore.ts`
- Shared TypeScript contracts, event payloads, and model catalog: `src/types/index.ts`
- Tauri bootstrap and command registration: `src-tauri/src/lib.rs`, `src-tauri/src/main.rs`
- CLI process spawning and stream event emission: `src-tauri/src/commands/chat.rs`
- Provider command/JSON adapters: `src-tauri/src/providers/*.rs`
- Frontend tests: `src/**/*.test.ts?(x)` through `npm test`

## Working Rules For This Repo
- Keep frontend state transitions deterministic. Project creation, nested session creation, streaming updates, and completion updates should remain easy to trace through the Zustand store.
- Prefer adding new backend functionality behind explicit Tauri commands instead of overloading `send_message`.
- When changing provider integrations, update both the Rust provider module and the frontend model catalog if exposed models change.
- Keep the Tauri event contract explicit. `stream-chunk` should stay compatible with `updateLastAssistant`, while failures should use `message-error` instead of silent fallback text.
- Keep generated artifacts ignored. `node_modules`, Vite build output, Cargo `target`, schemas, and temp folders should never become tracked files.
- Verify meaningful changes with `npm test`, `npm run build`, and a Rust sanity check before finalizing.

# Vertical Developer Guide

## Purpose
Vertical is a desktop chat client built with Tauri, React, TypeScript, and Rust. It provides a local multi-session UI for sending prompts to Claude Code or the OpenAI/Codex CLI stack, streaming responses back into the app, resuming provider CLI sessions per chat, and persisting projects directly into each working directory.

## Top-Level Map
- `src/`: Frontend application. React renders the shell, Zustand stores chat state, and Tailwind v4 theme tokens live in CSS.
- `src-tauri/`: Native shell. Tauri registers commands, spawns CLI processes, loads and saves project state, parses JSON lines, and emits stream events back to the frontend.
- `public/`: Static Vite assets if the app grows beyond bundled imports.
- `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`: Agent workflow rules for this repository.
- `vertical_developer_guide.md`: Root architecture guide. Read this first before changing code.
- `package.json`: Frontend dependencies and scripts.
- `vite.config.ts`, `tsconfig*.json`, `index.html`: Vite and TypeScript configuration.
- `run.bat`: Local launch helper.

## Runtime Flow
1. The app boots through Vite/Tauri. `src/main.tsx` mounts `App` and imports `src/styles/globals.css`.
2. `src/App.tsx` loads persisted workspace state on mount, restores the saved sidebar width ratio when present, subscribes to Tauri events once on mount, and debounces autosave writes back through Tauri persistence commands. Event payload contracts live in `src/types/index.ts`.
3. `Sidebar` creates or switches projects and chat sessions. `App.tsx` owns the shell-level sidebar width and drag lifecycle, persisting the sidebar as a viewport ratio and clamping the derived pixel width between a fixed minimum and 75% of the viewport, while `Sidebar` renders the resize separator plus the project tree. Each project stores its title, chosen working directory, collapse state, remembered last-active chat, and nested chat list. Each session stores provider, model, title, messages, streaming state, and the provider CLI session identifier.
4. Choosing `New project` opens the directory picker first. After the user picks a folder, the app checks the selected project root for `CLAUDE.md`, `AGENTS.md`, and `GEMINI.md`. If any are missing, the shell opens an in-app checklist dialog, preselecting files from the last remembered choice, and can create the selected defaults before continuing. That dialog also includes a shared template editor for all three files, a restore-system-default action, and an optional remembered custom template for future new projects only. If the selected folder already contains `.Vertical` state, the app loads it. Otherwise the store creates a project named after that folder and inserts one empty chat inside it.
5. `InputBar` is only rendered when a chat is selected. The selected chat session is the source of truth for its provider/model configuration, and changing either resets that session's saved provider CLI session id.
6. Sending appends the user prompt and a placeholder assistant message into the Zustand store, then invokes the Rust command `send_message` with the selected chat plus the owning project's working directory.
7. `src-tauri/src/commands/chat.rs` maps the provider string to a command builder, starts the external CLI process, tracks the running child per chat session, reads JSON from stdout plus diagnostics from stderr, applies a provider timeout, and emits normalized stream updates back to the frontend.
8. `src-tauri/src/commands/persistence.rs` writes `.Vertical/project.json`, one file per chat under `.Vertical/chats/`, and an executable-adjacent `.Vertical/registry.json` that remembers known project folders, the last active project, shell-level workspace preferences such as the persisted sidebar width ratio, the last chosen default set for companion markdown-file creation, and the optional remembered custom template used for future new projects.
9. As events arrive, the store updates the in-progress assistant message in place. Completion persists the provider CLI session id so later prompts can resume the same conversation, while failures and cancellations emit a dedicated error event.

## Current Frontend Shape
- The layout is a two-column shell with a draggable left sidebar: project and chat controls on the left, conversation on the right.
- Each sidebar project row exposes a collapse arrow, folder icon, persistent new-chat button, and actions menu for inline rename plus delete. Chat rows show the session provider icon and keep their own rename and delete menu.
- `ChatView` handles three empty states: no active session, active session with no messages, and active session with transcript.
- `MessageBubble` animates message entry and uses a typing indicator while the assistant placeholder is still empty.
- `InputBar` handles enter-to-send, shift-enter newline, textarea auto-growth, provider/model selection, and cancellation of the active provider request. It stays hidden until a chat is selected.
- The shell uses themed in-app dialogs for both destructive confirmations and the missing-companion-file checklist that appears immediately after a working directory is chosen, including the embedded shared-template editor for repo instruction files.

## Current Native Shape
- `src-tauri/src/lib.rs` wires Tauri, registers plugins, and exposes chat plus persistence commands.
- `src-tauri/capabilities/default.json` grants the dialog open permission used by the working-directory picker and the fs mkdir permission used by existing filesystem flows.
- Provider-specific command construction and JSON parsing live under `src-tauri/src/providers/`.
- Persistence commands live under `src-tauri/src/commands/persistence.rs` and own on-disk workspace and project state.
- Companion markdown-file inspection and optional creation also live under `src-tauri/src/commands/persistence.rs` so the frontend does not reimplement repo-root filesystem behavior.
- Streaming events carry the best known full assistant text for the active request, normalizing providers that emit either deltas, cumulative snapshots, or nested assistant-message payloads.
- Three providers are supported: Claude Code CLI (`claude`), OpenAI Codex CLI (`codex`), and Gemini CLI (`gemini`). All three support session resume via a stored session identifier.

## Change Map
- Application shell, workspace hydration, and autosave orchestration: `src/App.tsx`
- Project tree, nested chat controls, and resize handle rendering: `src/components/Sidebar.tsx`
- Project/session state transitions: `src/store/chatStore.ts`
- Shared TypeScript contracts, event payloads, and model catalog: `src/types/index.ts`
- Tauri bootstrap and command registration: `src-tauri/src/lib.rs`, `src-tauri/src/main.rs`
- Persistence command and on-disk schema: `src-tauri/src/commands/persistence.rs`
- CLI process spawning and stream event emission: `src-tauri/src/commands/chat.rs`
- Provider command/JSON adapters: `src-tauri/src/providers/*.rs`
- Frontend tests: `src/**/*.test.ts?(x)` through `npm test`
- Rust tests: `cargo test` in `src-tauri/`

## Working Rules For This Repo
- Keep frontend state transitions deterministic. Project creation, nested session creation, remembered active-chat changes, streaming updates, and completion updates should remain easy to trace through the Zustand store.
- Keep persisted project state local to the selected working directory. Schema changes should update the Rust persistence command and frontend contracts together.
- Prefer adding new backend functionality behind explicit Tauri commands instead of overloading `send_message`.
- When changing provider integrations, update both the Rust provider module and the frontend model catalog if exposed models change.
- Keep the Tauri event contract explicit. `stream-chunk` should stay compatible with `updateLastAssistant`, while failures should use `message-error` instead of silent fallback text.
- Keep generated artifacts ignored. `node_modules`, Vite build output, Cargo `target`, schemas, and temp folders should never become tracked files.
- Verify meaningful changes with `npm test`, `npm run build`, and a Rust sanity check before finalizing.

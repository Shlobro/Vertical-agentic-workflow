# Vertical Developer Guide

## Purpose
Vertical is a desktop chat client built with Tauri, React, TypeScript, and Rust. It provides a local multi-session UI for sending prompts to Claude Code or Codex CLI, streaming responses back into the app, and resuming provider CLI sessions per chat.

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
2. `src/App.tsx` subscribes to Tauri events once on mount: `stream-chunk`, `message-done`, and `message-error`.
3. `Sidebar` creates or switches chat sessions. Each session stores provider, model, title, messages, streaming state, and the provider CLI session identifier.
4. `InputBar` appends the user prompt and a placeholder assistant message into the Zustand store, then invokes the Rust command `send_message`.
5. `src-tauri/src/commands/chat.rs` maps the provider string to a command builder, starts the external CLI process, reads line-oriented JSON from stdout, and emits incremental updates back to the frontend.
6. As events arrive, the store updates the last assistant message in place. Completion persists the provider CLI session id so later prompts can resume the same conversation.

## Current Frontend Shape
- The layout is a fixed two-column shell: provider and session controls on the left, conversation on the right.
- `ChatView` handles three empty states: no active session, active session with no messages, and active session with transcript.
- `MessageBubble` animates message entry and uses a typing indicator while the assistant placeholder is still empty.
- `InputBar` handles enter-to-send, shift-enter newline, textarea auto-growth, and a placeholder cancel action that still needs a Tauri command.
- Theme colors come from custom Tailwind tokens in `src/styles/globals.css`. The current visual language is dark, minimal, and blue-accented.

## Current Native Shape
- `src-tauri/src/lib.rs` wires Tauri, registers the opener plugin, and exposes the `send_message` command.
- Provider-specific command construction and JSON parsing live under `src-tauri/src/providers/`.
- `ClaudeProvider` builds `claude --dangerously-skip-permissions --output-format json ...`.
- `CodexProvider` builds `codex exec --skip-git-repo-check --full-auto --json ...`.
- The command layer treats stdout as the only source of structured data and ignores stderr.
- Streaming currently depends on JSON lines containing either `message.content[].text` or `result`.

## Change Map
- Application shell and event wiring: `src/App.tsx`
- Session list and provider/model selection: `src/components/Sidebar.tsx`
- Conversation rendering and scroll behavior: `src/components/ChatView.tsx`, `src/components/MessageBubble.tsx`
- Prompt input and send/cancel controls: `src/components/InputBar.tsx`
- Session and transcript state transitions: `src/store/chatStore.ts`
- Shared TypeScript contracts and model catalog: `src/types/index.ts`
- Tauri bootstrap and command registration: `src-tauri/src/lib.rs`, `src-tauri/src/main.rs`
- CLI process spawning and stream event emission: `src-tauri/src/commands/chat.rs`
- Provider command/JSON adapters: `src-tauri/src/providers/*.rs`

## Working Rules For This Repo
- Keep frontend state transitions deterministic. Session creation, streaming updates, and completion updates should remain easy to trace through the Zustand store.
- Prefer adding new backend functionality behind explicit Tauri commands instead of overloading `send_message`.
- When changing provider integrations, update both the Rust provider module and the frontend model catalog if exposed models change.
- Keep generated artifacts ignored. `node_modules`, Vite build output, Cargo `target`, schemas, and temp folders should never become tracked files.
- Verify meaningful changes with frontend checks plus a Rust sanity check before finalizing.

# Commands Developer Guide

## Purpose
`src-tauri/src/commands/` exposes backend operations to the frontend through Tauri invoke handlers.

## Current Scope
- `chat.rs`: Starts a provider CLI process, tracks the active child by chat session, streams normalized text back to the UI, emits completion or error events, supports cancellation, times out stalled provider runs, and normalizes nested provider payloads such as Codex `item.completed` assistant messages.
- `mod.rs`: Re-exports command modules.

## Guardrails
- Each new frontend capability that needs native execution should usually become its own Tauri command.
- Keep command modules focused on orchestration. Provider-specific argument construction and JSON extraction belong in `providers/`.
- Keep the process registry authoritative for cancellation. Any command that ends a request must remove its session entry and emit either `message-done` or `message-error`.
- Keep stream parsing Unicode-safe because providers may emit partial text with non-ASCII content.
- Provider launch failures should be actionable. On Windows, try common executable suffixes for CLIs installed as scripts, then fall back to launching through `cmd.exe`, and return a clear PATH/install error when the executable still cannot be resolved.

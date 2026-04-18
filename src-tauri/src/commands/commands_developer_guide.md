# Commands Developer Guide

## Purpose
`src-tauri/src/commands/` exposes backend operations to the frontend through Tauri invoke handlers.

## Current Scope
- `chat.rs`: Starts a provider CLI process, streams parsed text back to the UI, and emits a final completion event with the discovered CLI session id.
- `mod.rs`: Re-exports command modules.

## Guardrails
- Each new frontend capability that needs native execution should usually become its own Tauri command.
- Keep command modules focused on orchestration. Provider-specific argument construction and JSON extraction belong in `providers/`.
- If cancellation or multi-window support is added, document the ownership and lifecycle model here.

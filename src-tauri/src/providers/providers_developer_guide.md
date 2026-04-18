# Providers Developer Guide

## Purpose
`src-tauri/src/providers/` adapts each external CLI provider to a common internal shape: build a command, parse session identifiers, and recover output text from JSON.

## Current Providers
- `claude.rs`: Builds Claude Code stream-json print commands with the required `--verbose` flag for `--print`, requests partial message chunks, and extracts `session_id` plus `result`.
- `codex.rs`: Builds Codex CLI JSON-mode commands, translates model ids with optional `:<reasoning-effort>` suffixes into CLI arguments, and extracts `thread_id` or `session_id` plus nested assistant output from current Codex event payloads.
- `mod.rs`: Re-exports provider adapters.

## Guardrails
- Keep provider modules independent. One provider changing its JSON format should not force unrelated providers to change shape.
- Prefer provider-local parsing helpers over one shared parser with many conditionals.
- Keep command-builder tests in this folder when provider flags or resume semantics change.
- If a provider requires richer streaming semantics, extend the command layer carefully and document the event contract in the root guide.

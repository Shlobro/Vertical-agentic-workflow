# Providers Developer Guide

## Purpose
`src-tauri/src/providers/` adapts each external CLI provider to a common internal shape: build a command, parse session identifiers, and recover output text from JSON.

## Current Providers
- `claude.rs`: Builds Claude Code JSON-mode commands and extracts `session_id` plus `result`.
- `codex.rs`: Builds Codex CLI JSON-mode commands and extracts `thread_id` or `session_id` plus `result` or `output`.
- `mod.rs`: Re-exports provider adapters.

## Guardrails
- Keep provider modules independent. One provider changing its JSON format should not force unrelated providers to change shape.
- Prefer provider-local parsing helpers over one shared parser with many conditionals.
- If a provider requires richer streaming semantics, extend the command layer carefully and document the event contract in the root guide.

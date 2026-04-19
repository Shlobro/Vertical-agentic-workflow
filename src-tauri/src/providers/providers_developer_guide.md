# Providers Developer Guide

## Purpose
`src-tauri/src/providers/` adapts each external CLI provider to a common internal shape: build a command, parse session identifiers, and recover output text from JSON.

## Current Providers
- `claude.rs`: Builds Claude Code stream-json print commands with the required `--verbose` flag for `--print`, relying on stdin for prompt delivery so multiline prompts do not depend on Windows command-line quoting. It requests partial message chunks and extracts `session_id` plus `result`.
- `codex.rs`: Builds Codex CLI JSON-mode commands, translating model ids with optional `:<reasoning-effort>` suffixes into CLI arguments and placing the `resume` subcommand immediately after `exec` when resuming a session. Prompts are passed as `-` and written through stdin so multiline follow-ups survive the Windows `.cmd` fallback path. Before resuming, it rejects persisted diagnostic text masquerading as a session id so stale launch errors are not fed back into the CLI. It also extracts `thread_id` or `session_id` plus nested assistant output from current Codex event payloads.
- `gemini.rs`: Builds Gemini CLI commands using non-interactive mode with `--prompt`, `--yolo`, and `--output-format stream-json`, while sending the actual prompt over stdin so multiline prompts survive Windows wrapper launches. Extracts `session_id` from the `init` event emitted first in every run. Supports session resume via `--resume <uuid>`. Stream text comes from `message` events where `role` is `assistant`.
- `mod.rs`: Re-exports provider adapters.

## Guardrails
- Keep provider modules independent. One provider changing its JSON format should not force unrelated providers to change shape.
- Prefer provider-local parsing helpers over one shared parser with many conditionals.
- Keep command-builder tests in this folder when provider flags or resume semantics change.
- If a provider requires richer streaming semantics, extend the command layer carefully and document the event contract in the root guide.

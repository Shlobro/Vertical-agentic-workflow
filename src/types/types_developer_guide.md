# Types Developer Guide

## Purpose
`src/types/` contains stable TypeScript contracts shared across the frontend.

## Current Scope
- `index.ts`: Provider union, message/session/project interfaces, persisted workspace payloads, Tauri event payloads, provider catalog, and model catalog used by the UI.
- `ChatProject` carries `lastActiveSessionId` so the app can reopen the latest chat per project after reloading from disk.
- The OpenAI/Codex catalog currently exposes GPT-5.4 and GPT-5.3 Codex entries with reasoning-effort variants encoded as `model:effort`.

## Guardrails
- Keep this folder declarative. Do not add runtime behavior here.
- Persistence payloads should stay schema-aligned with the Rust command layer because Tauri responses deserialize directly into these contracts.
- When backend provider support changes, update these contracts together with the Rust provider adapters so the UI and command layer stay aligned.
- Keep project ownership explicit here rather than rebuilding project/session relationships ad hoc in components.

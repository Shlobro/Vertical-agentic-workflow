# Types Developer Guide

## Purpose
`src/types/` contains stable TypeScript contracts shared across the frontend.

## Current Scope
- `index.ts`: Provider union, message/session/project interfaces, persisted workspace payloads, text-zoom preference contracts, companion-file dialog contracts, Tauri event payloads, provider catalog, and model catalog used by the UI.
- `Message` carries optional `provider` and `model` fields so each bubble can display the correct provider logo independent of the session's current provider. The `isContextHandoff` flag marks the synthetic transcript message injected when switching providers mid-chat.
- `ChatProject` carries `lastActiveSessionId` so the app can reopen the latest chat per project after reloading from disk.
- `PersistedWorkspaceState` carries `sidebarWidthRatio`, `textZoom`, the remembered default selection for the missing-companion-file checklist, and the optional remembered custom template for future new projects.
- The OpenAI/Codex catalog currently exposes GPT-5.4 and GPT-5.3 Codex entries with reasoning-effort variants encoded as `model:effort`.

## Guardrails
- Keep this folder declarative. Do not add runtime behavior here.
- Persistence payloads should stay schema-aligned with the Rust command layer because Tauri responses deserialize directly into these contracts.
- When backend provider support changes, update these contracts together with the Rust provider adapters so the UI and command layer stay aligned.
- Keep project ownership explicit here rather than rebuilding project/session relationships ad hoc in components.

# Types Developer Guide

## Purpose
`src/types/` contains stable TypeScript contracts shared across the frontend.

## Current Scope
- `index.ts`: Provider union, message/session interfaces, Tauri event payloads, provider catalog, and model catalog used by the UI. The OpenAI/Codex catalog currently exposes GPT-5.4 and GPT-5.3 Codex entries with reasoning-effort variants encoded as `model:effort`.

## Guardrails
- Keep this folder declarative. Do not add runtime behavior here.
- When backend provider support changes, update these contracts together with the Rust provider adapters so the UI and command layer stay aligned.

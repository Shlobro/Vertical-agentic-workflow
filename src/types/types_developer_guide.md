# Types Developer Guide

## Purpose
`src/types/` contains stable TypeScript contracts shared across the frontend.

## Current Scope
- `index.ts`: Provider union, message/session interfaces, Tauri event payloads, provider catalog, and model catalog used by the UI.

## Guardrails
- Keep this folder declarative. Do not add runtime behavior here.
- When backend provider support changes, update these contracts together with the Rust provider adapters so the UI and command layer stay aligned.

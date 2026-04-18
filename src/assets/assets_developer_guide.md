# Assets Developer Guide

## Purpose
`src/assets/` stores frontend-imported static assets that are bundled by Vite.

## Current Scope
- Provider logos and the shared `providerIcons.ts` lookup used by chat-selection UI.
- Default scaffold assets that should be removed once unused.

## Guardrails
- Keep only assets that are actually imported by the frontend.
- Prefer descriptive filenames tied to product concepts rather than generic temporary names.

# Frontend Developer Guide

## Purpose
`src/` contains the entire React frontend for Vertical. It owns layout, session state, empty states, conversation rendering, and the invocation bridge into the Tauri backend.

## Folder Map
- `main.tsx`: React entry point.
- `App.tsx`: Root composition and Tauri event subscription layer.
- `components/`: Presentational and interaction components.
- `store/`: Zustand state container for sessions and message streaming.
- `types/`: Shared frontend data contracts, event payloads, and provider/model definitions.
- `styles/`: Tailwind v4 import and theme tokens.
- `assets/`: Imported frontend image assets such as provider logos.

## Frontend Data Flow
1. `App.tsx` reads the Zustand store and derives the active session through `activeSession()`.
2. UI events call store actions directly for local state changes.
3. Choosing a working directory from the `InputBar` creates a session first if the shell is still in the no-chat state, so the picker can configure where the first agent run will start.
4. Sending a prompt writes optimistic user and assistant messages before calling Tauri.
5. Tauri events flow back into the same store to mutate the in-progress assistant message and session metadata.
6. `message-error` events may include partial assistant text. The frontend should preserve that text and append the failure reason instead of replacing it with a blank error state.

## Guardrails
- Keep `App.tsx` as orchestration glue, not a dumping ground for UI logic.
- Put reusable UI behavior into `components/`, state transitions into `store/`, and contracts into `types/`.
- Keep invoke failures and event-subscription failures visible in developer tooling; do not silently swallow bridge errors.
- Frontend behavior changes should land with Vitest coverage close to the touched surface, usually in the same folder as the code under test.
- If a folder grows past a small, scannable surface area, split it by responsibility instead of letting one folder become mixed.

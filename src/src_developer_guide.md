# Frontend Developer Guide

## Purpose
`src/` contains the entire React frontend for Vertical. It owns layout, project and session state, persisted-workspace hydration, empty states, conversation rendering, and the invocation bridge into the Tauri backend.

## Folder Map
- `main.tsx`: React entry point.
- `App.tsx`: Root composition, startup hydration, autosave orchestration, shell-level `Ctrl + wheel` text-zoom routing, Tauri event subscription layer, and destructive-action confirmation flow.
- `components/`: Presentational and interaction components.
- `store/`: Zustand state container for projects, chat sessions, and message streaming.
- `types/`: Shared frontend data contracts, persistence payloads, event payloads, and provider/model definitions.
- `styles/`: Tailwind v4 import and theme tokens.
- `assets/`: Imported frontend image assets plus the shared provider-icon lookup used by multiple components.

## Frontend Data Flow
1. `App.tsx` loads persisted workspace state through `load_workspace_state`, then reads the Zustand store and derives the active session through `activeSession()`.
2. UI events call store actions directly for local state changes.
3. `Sidebar.tsx` owns project-tree presentation details while `App.tsx` owns destructive confirmation state plus the bounded left-sidebar width, per-surface text-zoom preferences, and the shell-level drag/wheel lifecycle.
4. The shell persists the sidebar as a viewport ratio, stores transcript/composer/sidebar text sizes in workspace state, and derives sidebar pixels from the ratio while clamping between a fixed minimum and 75% of the current viewport.
5. Choosing `New project` opens the folder picker first. After the user selects a folder, `App.tsx` asks Tauri which of `CLAUDE.md`, `AGENTS.md`, and `GEMINI.md` are missing in that project root. If any are missing, the shell opens an in-app checklist dialog, preselecting the user's remembered defaults, and can create the selected files before continuing.
6. The active chat session owns the selected provider and model shown in `InputBar`. Changing either updates that session immediately.
7. Sending a prompt writes optimistic user and assistant messages before calling Tauri with the selected chat and its parent project's working directory.
8. A debounced save path invokes `save_workspace_state` after relevant project/chat changes, sidebar-ratio changes, text-zoom changes, companion-file default-selection changes, and remembered companion-template changes so project folders and the workspace registry stay synchronized with the in-memory store.
9. Tauri events flow back into the same store to mutate the in-progress assistant message and session metadata.

## Guardrails
- Keep `App.tsx` as orchestration glue, not a dumping ground for UI logic.
- Shell-level layout state such as the resizable sidebar width and per-surface text zoom belongs in `App.tsx`; content components should receive it through props or CSS variables.
- Persistence timing belongs in `App.tsx`; on-disk layout and file writes belong in Tauri commands.
- Put reusable UI behavior into `components/`, nested project/session state transitions into `store/`, and contracts into `types/`.
- Keep invoke failures and event-subscription failures visible in developer tooling; do not silently swallow bridge errors.
- Frontend behavior changes should land with Vitest coverage close to the touched surface, usually in the same folder as the code under test.
- If a folder grows past a small, scannable surface area, split it by responsibility instead of letting one folder become mixed.

# Frontend Developer Guide

## Purpose
`src/` contains the entire React frontend for Vertical. It owns layout, project and session state, persisted-workspace hydration, empty states, conversation rendering, and the invocation bridge into the Tauri backend.

## Folder Map
- `main.tsx`: React entry point.
- `App.tsx`: Root composition, startup hydration, autosave orchestration, Tauri event subscription layer, and destructive-action confirmation flow.
- `components/`: Presentational and interaction components.
- `store/`: Zustand state container for projects, chat sessions, and message streaming.
- `types/`: Shared frontend data contracts, persistence payloads, event payloads, and provider/model definitions.
- `styles/`: Tailwind v4 import and theme tokens.
- `assets/`: Imported frontend image assets plus the shared provider-icon lookup used by multiple components.

## Frontend Data Flow
1. `App.tsx` loads persisted workspace state through `load_workspace_state`, then reads the Zustand store and derives the active session through `activeSession()`.
2. UI events call store actions directly for local state changes.
3. `Sidebar.tsx` owns project-tree presentation details such as inline rename fields, collapse controls, nested chat actions, the top-of-sidebar project action area, and the rendered resize separator, while `App.tsx` owns destructive confirmation state plus the bounded left-sidebar width and drag lifecycle. The shell persists the sidebar as a viewport ratio, then derives pixels from that ratio while clamping between a fixed minimum and 75% of the current viewport before calling store delete actions.
4. Choosing `New project` opens the folder picker first. After the user selects a folder, `App.tsx` asks Tauri which of `CLAUDE.md`, `AGENTS.md`, and `GEMINI.md` are missing in that project root. If any are missing, the shell opens an in-app checklist dialog, preselecting the user's remembered defaults, and can create the selected files before continuing. If the chosen folder already contains `.Vertical` state, `App.tsx` loads it through `load_project_state`; otherwise the store creates a project named after that folder plus one empty chat inside it.
5. The active chat session owns the selected provider and model shown in `InputBar`. Changing either updates that session immediately and clears its saved CLI session id when the configuration changes.
6. Sending a prompt writes optimistic user and assistant messages before calling Tauri with the selected chat and its parent project's working directory.
7. A debounced save path invokes `save_workspace_state` after relevant project/chat changes, sidebar-ratio changes, and companion-file default-selection changes so project folders and the workspace registry stay synchronized with the in-memory store.
8. Tauri events flow back into the same store to mutate the in-progress assistant message and session metadata.
9. `message-error` events may include partial assistant text. The frontend should preserve that text and append the failure reason instead of replacing it with a blank error state.

## Guardrails
- Keep `App.tsx` as orchestration glue, not a dumping ground for UI logic.
- Shell-level layout state such as the resizable sidebar width belongs in `App.tsx`; content components should receive it through props.
- Persistence timing belongs in `App.tsx`; on-disk layout and file writes belong in Tauri commands.
- Put reusable UI behavior into `components/`, nested project/session state transitions into `store/`, and contracts into `types/`.
- Keep invoke failures and event-subscription failures visible in developer tooling; do not silently swallow bridge errors.
- Frontend behavior changes should land with Vitest coverage close to the touched surface, usually in the same folder as the code under test.
- If a folder grows past a small, scannable surface area, split it by responsibility instead of letting one folder become mixed.

# Store Developer Guide

## Purpose
`src/store/` owns application state that must survive component re-renders and coordinate the project, chat, and persistence workflow.

## Current Store
- `chatStore.ts`: Single Zustand store for projects, nested chat sessions, active selection, per-project remembered last-active chat ids, workspace hydration, streaming updates, explicit rename/delete actions, and derived session titles.
- `chatStore.test.ts`: Coverage for project creation, nested chat creation, workspace hydration, remembered active-chat tracking, project deletion, and assistant streaming/finalization transitions.

## State Rules
- Every project is the source of truth for working directory, title, collapse state, remembered last-active chat id, and chat membership.
- Every session is the source of truth for provider, model, transcript, CLI session id, and streaming status.
- Provider/model changes update the session immediately via `updateSessionConfig`. The CLI session id is **not** cleared at config-change time; it is cleared at send time when a context handoff is in progress, so the user can revert the provider selection before sending without losing the existing session.
- `finalizeAssistant` stamps `provider` and `model` from the session onto the completed assistant message so each bubble retains its origin even if the session provider changes later.
- Collapsing a project that owns the active chat should clear the active selection so the main pane falls back to the no-chat empty state.
- Selecting a chat should update the owning project's remembered last-active chat so persistence can restore the same session later.
- Stream updates currently target the last assistant message in a session and expect `stream-chunk` payloads to contain the best known full assistant text. If streaming becomes more complex, keep ordering guarantees explicit.
- Store actions should stay mutation-focused and synchronous. Async work belongs in components or dedicated service layers that call store actions.

# Store Developer Guide

## Purpose
`src/store/` owns application state that must survive component re-renders and coordinate the project and chat workflow.

## Current Store
- `chatStore.ts`: Single Zustand store for projects, nested chat sessions, active selection, streaming updates, explicit rename/delete actions, and derived session titles.
- `chatStore.test.ts`: Coverage for project creation, nested chat creation, collapse behavior, project deletion, and assistant streaming/finalization transitions.

## State Rules
- Every project is the source of truth for working directory, title, collapse state, and chat membership.
- Every session is the source of truth for provider, model, transcript, CLI session id, and streaming status.
- Collapsing a project that owns the active chat should clear the active selection so the main pane falls back to the no-chat empty state.
- Stream updates currently target the last assistant message in a session and expect `stream-chunk` payloads to contain the best known full assistant text. If streaming becomes more complex, keep ordering guarantees explicit.
- Store actions should stay mutation-focused and synchronous. Async work belongs in components or dedicated service layers that call store actions.

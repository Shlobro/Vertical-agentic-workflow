# Store Developer Guide

## Purpose
`src/store/` owns application state that must survive component re-renders and coordinate the chat workflow.

## Current Store
- `chatStore.ts`: Single Zustand store for chat sessions, active selection, streaming updates, explicit rename/delete actions, and derived session titles.
- `chatStore.test.ts`: Coverage for session creation, rename/delete transitions, OpenAI/Codex model preservation, and assistant streaming/finalization transitions.

## State Rules
- Every session is the source of truth for provider, model, transcript, CLI session id, and streaming status.
- Deleting the active session should promote a nearby remaining session to active state so the shell never points at a missing session.
- Stream updates currently target the last assistant message in a session and expect `stream-chunk` payloads to contain the best known full assistant text. If streaming becomes more complex, keep ordering guarantees explicit.
- Store actions should stay mutation-focused and synchronous. Async work belongs in components or dedicated service layers that call store actions.

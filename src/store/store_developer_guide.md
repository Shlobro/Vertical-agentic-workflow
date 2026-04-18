# Store Developer Guide

## Purpose
`src/store/` owns application state that must survive component re-renders and coordinate the chat workflow.

## Current Store
- `chatStore.ts`: Single Zustand store for chat sessions, active selection, streaming updates, and derived session titles.

## State Rules
- Every session is the source of truth for provider, model, transcript, CLI session id, and streaming status.
- Stream updates currently target the last assistant message in a session. If streaming becomes more complex, keep ordering guarantees explicit.
- Store actions should stay mutation-focused and synchronous. Async work belongs in components or dedicated service layers that call store actions.

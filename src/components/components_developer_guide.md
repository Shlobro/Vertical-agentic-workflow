# Components Developer Guide

## Purpose
`src/components/` holds the UI pieces that render the chat shell. Components are thin and mostly controlled by props; state that matters across the app belongs in Zustand or higher-level orchestration.

## Current Components
- `Sidebar.tsx`: Provider selection, model selection, new chat creation, and chat-session navigation. Provider labels are presentational only; the canonical model catalog still lives in `src/types/index.ts`.
- `ChatView.tsx`: Transcript area plus no-session and no-message empty states, including provider-specific empty-state copy.
- `MessageBubble.tsx`: Animated user and assistant message card, including typing placeholder behavior.
- `InputBar.tsx`: Textarea, submit keyboard handling, auto-resize, and send/cancel controls for the active request.
- `InputBar.test.tsx`: Coverage for keyboard submission, accessible labelling, and cancel-state controls.

## Guardrails
- Keep provider/model business rules out of visual components unless they are strictly presentational.
- New shared UI elements should enter this folder only if they are used by more than one screen or keep `App.tsx` simpler.
- Preserve message rendering as plain text unless the product intentionally adopts markdown or rich content.
- Keep icon-only controls labelled for assistive technology, and prefer tests that cover keyboard behavior when changing input affordances.

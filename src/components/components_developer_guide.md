# Components Developer Guide

## Purpose
`src/components/` holds the UI pieces that render the chat shell. Components are thin and mostly controlled by props; state that matters across the app belongs in Zustand or higher-level orchestration.

## Current Components
- `Sidebar.tsx`: New chat creation, chat-session navigation, inline rename editing, and per-chat action menus. Provider/model selection has moved to `InputBar`.
- `ConfirmDialog.tsx`: Themed in-app confirmation dialog used for destructive chat actions.
- `ChatView.tsx`: Transcript area plus no-session and no-message empty states, including provider-specific empty-state copy.
- `MessageBubble.tsx`: Animated user and assistant message card, including typing placeholder behavior.
- `InputBar.tsx`: Textarea on top, bottom-right toolbar row with provider/model selector, folder picker button, and send/cancel controls. Provider/model/workingDir values are passed in as props from `App.tsx`. The folder button shows the selected directory's base name when set.
- `InputBar.test.tsx`: Coverage for keyboard submission, accessible labelling, and cancel-state controls.
- `ConfirmDialog.test.tsx`: Coverage for themed destructive-confirmation rendering and button wiring.
- `Sidebar.test.tsx`: Coverage for the sidebar actions menu, inline rename flow, and delete affordance wiring.

## Guardrails
- Keep provider/model business rules out of visual components unless they are strictly presentational.
- New shared UI elements should enter this folder only if they are used by more than one screen or keep `App.tsx` simpler.
- Preserve message rendering as plain text unless the product intentionally adopts markdown or rich content.
- Keep icon-only controls labelled for assistive technology, and prefer tests that cover keyboard behavior when changing input affordances such as inline rename inputs and action menus.
- Destructive confirmations should prefer themed in-app UI over native system prompts when they are part of the main shell flow.

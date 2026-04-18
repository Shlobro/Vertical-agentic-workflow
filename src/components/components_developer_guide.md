# Components Developer Guide

## Purpose
`src/components/` holds the UI pieces that render the chat shell. Components are thin and mostly controlled by props; state that matters across the app belongs in Zustand or higher-level orchestration.

## Current Components
- `Sidebar.tsx`: Project creation, project collapse state, nested chat navigation, inline rename editing for both projects and chats, per-item action menus, per-chat provider icons in the session list, and the right-edge resize handle. Width state lives in `App.tsx`; `Sidebar` receives the current width plus the drag-start callback and renders a border-straddling resize target so hover, cursor, and guide line align with the visible shell edge.
- `ConfirmDialog.tsx`: Themed in-app confirmation dialog used for destructive chat actions.
- `ChatView.tsx`: Transcript area plus no-session and no-message empty states, including provider-specific empty-state copy.
- `MessageBubble.tsx`: Animated user and assistant message card, including typing placeholder behavior.
- `InputBar.tsx`: Textarea on top, bottom-right toolbar row with provider/model selector and send/cancel controls, and no extra instructional footer copy. It only renders when a chat is selected.
- `InputBar.test.tsx`: Coverage for keyboard submission, accessible labelling, cancel-state controls, and the absence of a working-directory button.
- `ConfirmDialog.test.tsx`: Coverage for themed destructive-confirmation rendering and button wiring.
- `Sidebar.test.tsx`: Coverage for project collapse, project rename, nested chat creation, chat action wiring, per-session provider icon rendering, and the resize handle contract.

## Guardrails
- Keep provider/model business rules out of visual components unless they are strictly presentational.
- Keep sidebar width state and drag lifecycle in the shell layer; `Sidebar.tsx` should only render the handle and forward drag-start events.
- New shared UI elements should enter this folder only if they are used by more than one screen or keep `App.tsx` simpler.
- Preserve message rendering as plain text unless the product intentionally adopts markdown or rich content.
- Keep icon-only controls labelled for assistive technology, and prefer tests that cover keyboard behavior when changing input affordances such as inline rename inputs, collapse toggles, and action menus.
- Destructive confirmations should prefer themed in-app UI over native system prompts when they are part of the main shell flow.

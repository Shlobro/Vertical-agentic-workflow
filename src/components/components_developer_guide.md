# Components Developer Guide

## Purpose
`src/components/` holds the UI pieces that render the chat shell. Components are thin and mostly controlled by props; state that matters across the app belongs in Zustand or higher-level orchestration.

## Current Components
- `Sidebar.tsx`: Project creation, project collapse state, nested chat navigation, inline rename editing for both projects and chats, per-item action menus, per-chat provider icons in the session list, the right-edge resize handle, and a live search bar with a scope dropdown. The `⋯` button next to the search input opens a three-checkbox dropdown (Project names, Chat names, Chat contents); defaults are project and chat names on, contents off. If all boxes are unchecked the effective scope silently falls back to project and chat names. Matched titles are highlighted with `<mark>`; a content-only match shows the chat and on click emits `onSearchSelectSession(sessionId, lastMatchingMessageId)` so `App.tsx` scrolls ChatView to the last hit. Clearing the query restores the pre-search collapsed state. Width state lives in `App.tsx`; `Sidebar` receives the current width plus the drag-start callback and renders a border-straddling resize target so hover, cursor, and guide line align with the visible shell edge.
- `ConfirmDialog.tsx`: Themed in-app confirmation dialog used for destructive chat actions.
- `MissingCompanionFilesDialog.tsx`: Themed in-app checklist dialog shown after choosing a project directory when the repo root is missing one or more of `CLAUDE.md`, `AGENTS.md`, or `GEMINI.md`. It also owns the shared-template editor, the restore-system-default action, and the remember-template checkbox.
- `ChatView.tsx`: Transcript area plus no-session and no-message empty states. Accepts `highlightQuery` (passed to each `MessageBubble`) and `scrollToMessageId` (scrolls that message into view on mount/change instead of scrolling to the bottom).
- `MessageBubble.tsx`: Animated user and assistant message card, including typing placeholder behavior. Accepts `highlightQuery` to render inline `<mark>` highlights, `isHighlightTarget` to add a yellow ring around the targeted message bubble, and `provider` to show a spinning provider logo instead of the three-dot indicator while the assistant message is streaming but empty (thinking phase).
- `InputBar.tsx`: Textarea on top, bottom-right toolbar row with provider/model selector and send/cancel controls, and no extra instructional footer copy. It only renders when a chat is selected.
- `InputBar.test.tsx`: Coverage for keyboard submission, accessible labelling, cancel-state controls, and the absence of a working-directory button.
- `ConfirmDialog.test.tsx`: Coverage for themed destructive-confirmation rendering and button wiring.
- `MissingCompanionFilesDialog.test.tsx`: Coverage for the companion-file checklist rendering, checkbox wiring, shared-template editor actions, and action buttons.
- `Sidebar.test.tsx`: Coverage for project collapse, project rename, nested chat creation, chat action wiring, per-session provider icon rendering, the resize handle contract, and the search bar (project-name filter, chat-title filter, content-match navigation callback, no-results state, and search clear).

## Guardrails
- Keep provider/model business rules out of visual components unless they are strictly presentational.
- Keep sidebar width state and drag lifecycle in the shell layer; `Sidebar.tsx` should only render the handle and forward drag-start events.
- New shared UI elements should enter this folder only if they are used by more than one screen or keep `App.tsx` simpler.
- Preserve message rendering as plain text unless the product intentionally adopts markdown or rich content.
- Keep icon-only controls labelled for assistive technology, and prefer tests that cover keyboard behavior when changing input affordances such as inline rename inputs, collapse toggles, and action menus.
- Destructive confirmations should prefer themed in-app UI over native system prompts when they are part of the main shell flow.
- Post-selection project setup prompts should also stay in themed in-app UI so multi-step folder onboarding remains testable and visually consistent.

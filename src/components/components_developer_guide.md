# Components Developer Guide

## Purpose
`src/components/` holds the UI pieces that render the chat shell. Components are thin and mostly controlled by props; state that matters across the app belongs in Zustand or higher-level orchestration.

## Current Components
- `Sidebar.tsx`: Project creation, project collapse state, nested chat navigation, inline rename editing for both projects and chats, per-item action menus, per-chat provider icons in the session list, the right-edge resize handle, live search bar with a scope dropdown, and sidebar text sizing driven by shell-level text-zoom variables. The scope menu controls project-name, chat-name, and chat-content search. Width state and `Ctrl + wheel` zoom routing live in `App.tsx`; `Sidebar` only renders the handle and the tree.
- `ConfirmDialog.tsx`: Themed in-app confirmation dialog used for destructive chat actions.
- `MissingCompanionFilesDialog.tsx`: Themed in-app checklist dialog shown after choosing a project directory when the repo root is missing one or more of `CLAUDE.md`, `AGENTS.md`, or `GEMINI.md`. It also owns the shared-template editor, the restore-system-default action, and the remember-template checkbox.
- `ChatView.tsx`: Transcript area plus no-session and no-message empty states. Accepts `highlightQuery` and `scrollToMessageId`, and renders transcript typography from the shared chat text-zoom variables.
- `MessageBubble.tsx`: Animated user and assistant message card. Reads `message.provider` directly to show the correct provider logo per bubble, renders a collapsible block for `isContextHandoff` messages, shows a spinning provider logo while the assistant message is streaming but empty, and applies the chat text-zoom typography classes to both normal bubbles and handoff content.
- `ProviderSwitchDialog.tsx`: Modal warning shown when the user selects a different provider on a session that already has messages. Presents "Yes, switch" / "Cancel" options. Always shown until an app-settings screen exists.
- `InputBar.tsx`: Textarea on top, bottom-right toolbar row with provider/model selector and send/cancel controls, and no extra instructional footer copy. It only renders when a chat is selected and uses the shell-provided composer text-zoom variables for both the textarea and compact controls.
- `InputBar.test.tsx`: Coverage for keyboard submission, accessible labelling, cancel-state controls, and the absence of a working-directory button.
- `ConfirmDialog.test.tsx`: Coverage for themed destructive-confirmation rendering and button wiring.
- `MissingCompanionFilesDialog.test.tsx`: Coverage for the companion-file checklist rendering, checkbox wiring, shared-template editor actions, and action buttons.
- `Sidebar.test.tsx`: Coverage for project collapse, project rename, nested chat creation, chat action wiring, per-session provider icon rendering, the resize handle contract, and the search bar.

## Guardrails
- Keep provider/model business rules out of visual components unless they are strictly presentational.
- Keep sidebar width state and shell-level wheel handling in `App.tsx`; `Sidebar.tsx` should only render the handle and forward drag-start events.
- New shared UI elements should enter this folder only if they are used by more than one screen or keep `App.tsx` simpler.
- Preserve message rendering as plain text unless the product intentionally adopts markdown or rich content.
- Keep icon-only controls labelled for assistive technology, and prefer tests that cover keyboard behavior when changing input affordances such as inline rename inputs, collapse toggles, and action menus.
- Destructive confirmations should prefer themed in-app UI over native system prompts when they are part of the main shell flow.
- Post-selection project setup prompts should also stay in themed in-app UI so multi-step folder onboarding remains testable and visually consistent.

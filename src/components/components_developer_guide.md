# Components Developer Guide

## Purpose
`src/components/` holds the UI pieces that render the chat shell. Components are thin and mostly controlled by props; state that matters across the app belongs in Zustand or higher-level orchestration.

## Current Components
- `Sidebar.tsx`: Project creation, project collapse state, nested chat navigation, inline rename editing for both projects and chats, always-visible project-row actions for new chat, File Explorer, and Windows Terminal, per-item action menus, native hover tooltips on icon-only project and chat controls using concise generic labels such as `New chat`, `Open in File Explorer`, `Open in Terminal`, and `Settings`, per-chat provider icons in the session list, the right-edge resize handle, and a single-row header with a compact `+` new-project button beside the live search bar. The search scope menu is exposed through a distinct settings button embedded inside the search field and controls project-name, chat-name, and chat-content search. Width state and `Ctrl + wheel` zoom routing live in `App.tsx`; `Sidebar` only renders the handle and the tree.
- `ConfirmDialog.tsx`: Themed in-app confirmation dialog used for destructive chat actions.
- `MissingCompanionFilesDialog.tsx`: Themed in-app checklist dialog shown after choosing a project directory when the repo root is missing one or more of `CLAUDE.md`, `AGENTS.md`, or `GEMINI.md`. It also owns the shared-template editor, the restore-system-default action, and the remember-template checkbox.
- `ChatView.tsx`: Transcript area plus no-session and no-message empty states. Accepts `highlightQuery` and `scrollToMessageId`, and renders transcript typography from the shared chat text-zoom variables.
- `MessageBubble.tsx`: Animated user and assistant message card. Reads `message.provider` directly to show the correct provider logo per bubble, renders a collapsible block for `isContextHandoff` messages, shows a spinning provider logo while the assistant message is streaming but empty, applies the chat text-zoom typography classes to both normal bubbles and handoff content, and force-wraps long unbroken strings so text never escapes the bubble width.
- `ProviderSwitchDialog.tsx`: Modal warning shown when the user selects a different provider on a session that already has messages. Presents "Yes, switch" / "Cancel" options. Always shown until an app-settings screen exists.
- `InputBar.tsx`: Textarea on top, bottom-right toolbar row with provider/model selector and send/cancel controls, and no extra instructional footer copy. It only renders when a chat is selected, uses the shell-provided composer text-zoom variables for both the textarea and compact controls, scales the provider/model trigger width, height, padding, and icons with composer zoom while keeping the model trigger proportionally wider than the provider trigger, and provides `@` file-path completion with arrow-key navigation plus `Tab` insertion. Accepted completions append a trailing space so typing can continue immediately. The composer auto-grows with content until the full bottom panel reaches 50% of the viewport height, after which the textarea scrolls internally. The suggestion list flips above the composer when the viewport does not have enough space below it.
- `InputBar.test.tsx`: Coverage for keyboard submission, accessible labelling, cancel-state controls, the absence of a working-directory button, and `@` file mention completion.
- `ConfirmDialog.test.tsx`: Coverage for themed destructive-confirmation rendering and button wiring.
- `MissingCompanionFilesDialog.test.tsx`: Coverage for the companion-file checklist rendering, checkbox wiring, shared-template editor actions, and action buttons.
- `Sidebar.test.tsx`: Coverage for project collapse, project rename, nested chat creation, hover tooltip labels on project and chat controls, File Explorer and Windows Terminal project actions, chat action wiring, per-session provider icon rendering, the resize handle contract, and the search bar.

## Guardrails
- Keep provider/model business rules out of visual components unless they are strictly presentational.
- Keep sidebar width state and shell-level wheel handling in `App.tsx`; `Sidebar.tsx` should only render the handle and forward drag-start events.
- New shared UI elements should enter this folder only if they are used by more than one screen or keep `App.tsx` simpler.
- Preserve message rendering as plain text unless the product intentionally adopts markdown or rich content.
- Keep transcript content visually contained within its bubble. Long unbroken paths, URLs, hashes, or inline-code-like text should wrap inside the bubble instead of overflowing outside it.
- Keep icon-only controls labelled for assistive technology, and prefer tests that cover project-row utility actions plus keyboard behavior when changing input affordances such as inline rename inputs, collapse toggles, and action menus.
- Keep composer mention behavior keyboard-first. `ArrowUp` and `ArrowDown` should move the highlighted file suggestion, while `Tab` should insert the highlighted relative path followed by a trailing space into the textarea.
- Keep composer mention popovers viewport-aware. If the composer is near the bottom edge, the file suggestion list should render above it instead of overflowing off-screen.
- Destructive confirmations should prefer themed in-app UI over native system prompts when they are part of the main shell flow.
- Post-selection project setup prompts should also stay in themed in-app UI so multi-step folder onboarding remains testable and visually consistent.

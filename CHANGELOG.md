# Changelog

## Unreleased
- Added a post-folder-selection checklist that detects missing `CLAUDE.md`, `AGENTS.md`, and `GEMINI.md` files in the chosen project root and can create the selected defaults before opening the project.
- Persisted the remembered default checkbox selection for the companion-file checklist in workspace state so later project selections reuse the user's last choice.
- Added a shared template editor to the missing-file checklist, including `Edit default content`, `Restore system default`, and an optional remembered custom template for future new projects.
- Added frontend and Rust tests covering the missing-companion-file onboarding flow, checkbox defaults, and repo-root file creation without overwriting existing files.
- Added a draggable left-sidebar resize handle with `ew-resize` cursor feedback and bounded width updates in the app shell.
- Added frontend tests covering the sidebar resize handle contract and drag-based width changes.
- Adjusted the sidebar resize affordance so its hit area and visual guide align with the actual border, and switched the hover cursor to `col-resize`.
- Increased the sidebar expansion limit from a fixed width to 75% of the current viewport width.
- Persisted the sidebar width in workspace state so resizing survives app restarts.
- Changed sidebar persistence from raw pixels to a viewport ratio so the sidebar keeps the same percentage when the window is resized or maximized.

## 2026-04-18
- Removed the remaining top-left `Vertical` title so the sidebar now starts directly with the `New Project` action.
- Simplified the chat shell chrome by removing the sidebar subtitle and the composer keyboard-hint footer text.
- Added local project persistence with `.Vertical/project.json` plus one JSON file per chat under `.Vertical/chats/` inside each project working directory.
- Added an executable-adjacent `.Vertical/registry.json` that tracks known project folders and the last active project so startup can restore saved work.
- Added startup workspace hydration, folder-level project loading, and debounced autosave for projects, chats, provider/model settings, CLI session ids, and last-selected chats.
- Picking a folder that already contains `.Vertical` state now loads the saved project instead of creating a fresh one.
- Deleting a project now removes its local `.Vertical` storage from the project directory.
- Added frontend and Rust persistence coverage for workspace hydration, saved project loading, stale chat cleanup, and project-storage deletion.
- Fixed Claude CLI streaming by adding the required `--verbose` flag when using `--print --output-format stream-json`, matching the CLI contract instead of failing at launch.
- Replaced the generic sidebar chat icon with the selected provider icon for each chat row and shared the provider icon mapping across sidebar and composer UI.
- Fixed active chat provider/model selection so sending from a session uses the configuration shown in the input bar instead of stale session settings.
- Clearing a chat's provider/model now resets its saved CLI session id to avoid resuming an incompatible provider thread.
- Added frontend tests covering session config updates and the send path after switching to Codex.
- Improved provider startup on Windows by trying common executable suffixes and returning clearer install/PATH errors when Codex or Claude cannot be launched.
- Added a Windows `cmd.exe` provider-launch fallback so npm-installed CLI shims behave more like the shell-based workflow app.

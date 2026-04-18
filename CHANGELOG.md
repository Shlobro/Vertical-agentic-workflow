# Changelog

## 2026-04-18
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

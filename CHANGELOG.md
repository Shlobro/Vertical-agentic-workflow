# Changelog

## 2026-04-18
- Replaced the generic sidebar chat icon with the selected provider icon for each chat row and shared the provider icon mapping across sidebar and composer UI.
- Fixed active chat provider/model selection so sending from a session uses the configuration shown in the input bar instead of stale session settings.
- Clearing a chat's provider/model now resets its saved CLI session id to avoid resuming an incompatible provider thread.
- Added frontend tests covering session config updates and the send path after switching to Codex.
- Improved provider startup on Windows by trying common executable suffixes and returning clearer install/PATH errors when Codex or Claude cannot be launched.
- Added a Windows `cmd.exe` provider-launch fallback so npm-installed CLI shims behave more like the shell-based workflow app.

## Unreleased

### Added
- Projects now own the working directory for all chats inside them.
- New project creation requires selecting a folder first, names the project from that folder, and creates one empty chat automatically.
- Sidebar now renders collapsible project groups with a folder icon, persistent new-chat action, project actions menu, and nested chat rows.
- The input composer now stays hidden until a chat is selected.

### Fixed
- Sending now always uses the selected project's working directory instead of a per-chat override or fallback directory.
- Project collapse clears the active chat selection so the main pane returns to the no-chat state.
- Added frontend test coverage for project creation, collapse behavior, nested chat actions, and the composer without a working-directory picker.

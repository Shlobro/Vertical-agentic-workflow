# Changelog

## Unreleased

### Added
- Per-chat working directory picker: folder icon in the InputBar bottom-right toolbar lets users select a directory for each chat session.
- If no working directory is selected when sending, a warning dialog appears and the agent runs in `<appLocalDataDir>/default` (created automatically).
- Selected working directory is passed as `current_dir` to the spawned CLI process.
- InputBar layout restructured: textarea fills the top of the input bubble; provider/model selector, folder picker, and send/cancel button are pinned to the bottom-right row.
- Per-chat sidebar actions menu with inline rename support.
- Themed in-app confirmation dialog for destructive chat deletion.

### Fixed
- Clicking the folder icon in the empty-chat state now creates a session first, so users can choose the agent working directory before sending the first message.
- Tauri capabilities now explicitly allow the directory-open dialog and default-workspace creation used by working-directory selection.
- Confirmed chat deletion from the sidebar now clears the removed session and promotes a nearby remaining session to active state.
- Added sidebar and store test coverage for chat rename/delete flows.
- Chat deletion no longer uses the native system confirm dialog, avoiding out-of-theme UI and system alert sounds.

# Changelog

## Unreleased

### Added
- Per-chat working directory picker: folder icon in the InputBar bottom-right toolbar lets users select a directory for each chat session.
- If no working directory is selected when sending, a warning dialog appears and the agent runs in `<appLocalDataDir>/default` (created automatically).
- Selected working directory is passed as `current_dir` to the spawned CLI process.
- InputBar layout restructured: textarea fills the top of the input bubble; provider/model selector, folder picker, and send/cancel button are pinned to the bottom-right row.

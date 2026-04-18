# Changelog

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

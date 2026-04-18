# Tauri Shell Developer Guide

## Purpose
`src-tauri/` contains the native desktop shell for Vertical. It packages the frontend, registers Tauri commands, and bridges the React UI to local CLI providers and local on-disk project state.

## Folder Map
- `Cargo.toml`: Rust package manifest and dependency list.
- `build.rs`: Tauri build integration.
- `tauri.conf.json`: Desktop app packaging/runtime configuration.
- `capabilities/`: Tauri permission capability definitions.
- `src/`: Rust application code.
- `.gitignore`: Cargo target and generated schema ignores.

## Runtime Role
- The frontend never shells out directly. All provider execution and all persistence I/O go through Tauri commands.
- This folder is responsible for process spawning, active child-process tracking, stdout/stderr parsing, provider timeouts, event emission back into the window, and local workspace/project persistence, including shell-level workspace preferences such as the sidebar width ratio stored beside the app executable.
- Capability files under `capabilities/` are part of the runtime contract. The working-directory picker depends on dialog open permission and existing fs flows depend on the matching plugin capability entries.
- Keep generated Cargo and Tauri artifacts out of version control.
- Provider process startup should handle platform-specific executable resolution, especially Windows script wrappers for locally installed CLIs, and may need to go through `cmd.exe` to mirror shell-based launches.

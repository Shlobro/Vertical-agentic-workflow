# Tauri Shell Developer Guide

## Purpose
`src-tauri/` contains the native desktop shell for Vertical. It packages the frontend, registers Tauri commands, and bridges the React UI to local CLI providers.

## Folder Map
- `Cargo.toml`: Rust package manifest and dependency list.
- `build.rs`: Tauri build integration.
- `tauri.conf.json`: Desktop app packaging/runtime configuration.
- `capabilities/`: Tauri permission capability definitions.
- `src/`: Rust application code.
- `.gitignore`: Cargo target and generated schema ignores.

## Runtime Role
- The frontend never shells out directly. All provider execution goes through Tauri commands.
- This folder is responsible for process spawning, active child-process tracking, stdout/stderr parsing, provider timeouts, and event emission back into the window.
- Capability files under `capabilities/` are part of the runtime contract. The working-directory picker depends on dialog open permission and the fallback workspace setup depends on fs mkdir permission.
- Keep generated Cargo and Tauri artifacts out of version control.
- Provider process startup should handle platform-specific executable resolution, especially Windows script wrappers for locally installed CLIs, and may need to go through `cmd.exe` to mirror shell-based launches.

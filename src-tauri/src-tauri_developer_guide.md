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
- Keep generated Cargo and Tauri artifacts out of version control.

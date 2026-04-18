# Rust Source Developer Guide

## Purpose
`src-tauri/src/` holds the Rust runtime for provider execution, persistence, and Tauri command registration.

## Folder Map
- `main.rs`: Binary entry point delegating to the library crate.
- `lib.rs`: Tauri builder setup and command registration for both provider execution and persistence commands.
- `commands/`: Tauri commands callable from the frontend, including provider execution and local persistence.
- `providers/`: Provider-specific command builders and response parsers.

## Guardrails
- Keep `lib.rs` small and declarative.
- Keep filesystem persistence in `commands/`, not in provider modules or frontend code. Workspace-level UI preferences that must survive restarts should persist through the same command layer, preferably as stable normalized values such as ratios instead of window-size-specific pixels.
- Put provider branching behind `commands/` and `providers/`, not in unrelated modules.
- Treat provider process lifecycle and stdout/stderr parsing as fragile integration code: small, explicit helpers are easier to maintain than large generic abstractions.
- Keep Rust-side integration coverage close to command builders and persistence helpers so CLI or schema regressions fail under `cargo test`.
- When spawning external CLIs on Windows, account for `.cmd`/`.bat` wrappers and, if direct spawning still fails, fall back to `cmd.exe` before reporting a missing-`PATH` error.

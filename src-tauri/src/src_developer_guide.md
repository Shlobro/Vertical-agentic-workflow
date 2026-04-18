# Rust Source Developer Guide

## Purpose
`src-tauri/src/` holds the Rust runtime for provider execution and Tauri command registration.

## Folder Map
- `main.rs`: Binary entry point delegating to the library crate.
- `lib.rs`: Tauri builder setup and command registration.
- `commands/`: Tauri commands callable from the frontend.
- `providers/`: Provider-specific command builders and response parsers.

## Guardrails
- Keep `lib.rs` small and declarative.
- Put provider branching behind `commands/` and `providers/`, not in unrelated modules.
- Treat provider process lifecycle and stdout/stderr parsing as fragile integration code: small, explicit helpers are easier to maintain than large generic abstractions.
- Keep Rust-side integration coverage close to command builders and stream parsers so CLI contract regressions fail under `cargo test`.
- When spawning external CLIs on Windows, account for `.cmd`/`.bat` wrappers and, if direct spawning still fails, fall back to `cmd.exe` before reporting a missing-`PATH` error.

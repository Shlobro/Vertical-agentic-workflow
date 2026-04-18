# Capabilities Developer Guide

## Purpose
`src-tauri/capabilities/` defines the permission set granted to the desktop window. Frontend plugin calls only work when the matching capability entry is present here.

## Current Scope
- `default.json`: Capability attached to the `main` window.
- The current permission set includes core Tauri APIs, event transport, the dialog open flow used by the working-directory picker, fs mkdir for creating the default workspace, and opener access for external links or file reveal actions.

## Guardrails
- Keep permissions as narrow as practical. Add only the specific plugin commands the frontend actually uses.
- When adding a new frontend plugin call, update this folder in the same change so runtime behavior and permissions do not drift apart.

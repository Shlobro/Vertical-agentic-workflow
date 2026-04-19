# Styles Developer Guide

## Purpose
`src/styles/` defines global CSS and theme tokens for the frontend.

## Current Scope
- `globals.css`: Imports Tailwind v4, defines theme colors and fonts, applies base body styling, customizes scrollbars and select menus, and exposes reusable CSS classes plus shell-level text-zoom variables for transcript, composer, sidebar typography, message-bubble long-token wrapping, and composer control sizing including zoom-aware dropdown widths.

## Guardrails
- Keep reusable design tokens and shared typography helpers here instead of scattering raw colors or surface-specific font rules through components.
- Keep cross-component text containment rules here. If transcript text needs shared wrapping or overflow behavior, expose a named class in `globals.css` instead of duplicating ad hoc `break-*` utilities across bubbles.
- If the app gets a richer design system, this folder should become the entry point for shared variables and cross-app primitives rather than storing component-specific hacks.

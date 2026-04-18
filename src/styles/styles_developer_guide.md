# Styles Developer Guide

## Purpose
`src/styles/` defines global CSS and theme tokens for the frontend.

## Current Scope
- `globals.css`: Imports Tailwind v4, defines theme colors and fonts, applies base body styling, and customizes scrollbars and select menus.

## Guardrails
- Keep reusable design tokens here instead of scattering raw colors through components.
- If the app gets a richer design system, this folder should become the entry point for shared variables and cross-app primitives rather than storing component-specific hacks.

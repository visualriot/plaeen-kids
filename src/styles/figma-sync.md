# Figma Sync Log

**Last sync:** 2026-05-10
**Source:** [Plaeen Design System](https://www.figma.com/design/FqUQApZDI22YgW9KIS4hAE/Plaeen-Design-System?node-id=7-243&m=dev)

## Summary
- **38 color tokens** pulled from Figma
- All tokens added to `src/styles/tokens.css`
- Tokens organized by semantic category (text, background, border, interactive, state)
- Tailwind aliases created for natural utility class naming

## Token Categories Synced

| Category | Count | Examples |
|----------|-------|----------|
| Text Colors | 7 | `color-text-primary`, `color-text-secondary`, `color-text-muted` |
| Background / Surface | 4 | `color-bg-page`, `color-surface-raised`, `color-surface-overlay` |
| Border Colors | 4 | `color-border-subtle`, `color-border-default`, `color-border-accent` |
| Interactive | 6 | Primary, secondary, hover, active states |
| State (Warning/Error/Info/Success) | 10 | Includes base, background, border, text for each |
| Accent | 2 | `color-accent-primary`, `color-accent-secondary` |

## Theme Palette

- **Primary accent:** `#76e900` (lime) — used across interactive, border, text accent
- **Background:** Dark theme — `#0a0514` (page) to `#271d45` (floating)
- **State colors:** Warm (warning), red (error), cyan (info), teal (success)

## Next Steps

1. Import `tokens.css` in your main app entry (e.g., `src/index.css` or `src/main.tsx`)
2. Start using tokens in Tailwind utilities: `text-primary`, `bg-surface`, `border-accent`
3. For raw CSS, reference the full semantic variables: `color: var(--color-text-primary)`

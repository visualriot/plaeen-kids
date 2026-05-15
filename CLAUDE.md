# CLAUDE.md — Plaeen Design System

## Project Context

**Plaeen** is a screen time and gaming management platform for kids and parents.

- **Stack:** Vite + React 19 + TypeScript + Tailwind CSS v4 + React Router v7 + Firebase
- **State of codebase:** Existing, partially built. Styling is inconsistent and embedded per-page. The goal is to refactor toward atomic design with a consistent token system — not a rewrite.
- **Figma:** Source of truth for all design decisions. Colors and typography are defined. Spacing/layout tokens may follow.

---

## Core Principles

1. **Figma is truth.** Every variable, style, and component name in code must match its Figma name exactly. `color/text/primary` in Figma → `color-text-primary` in CSS. No renaming. No "developer-friendly" aliases.

2. **Refactor-first, not greenfield.** This is an existing app. Before creating any new component, check if something already exists in the codebase that serves this need. If it does — clean it up and make it the canonical version. Don't add a second `Button` next to an existing one.

3. **Reuse first, create never (unless you must).** Scan existing components before writing anything new. If something is close but not exact, merge it into one with variants/props.

4. **Atomic structure.** The codebase follows atomic design:
   - **Tokens** → raw design values (colors, typography, spacing, radii)
   - **Atoms** → smallest UI elements (Button, Input, Badge, Icon, Avatar)
   - **Molecules** → combinations of atoms (SearchBar, NavItem, GameCard header)
   - **Organisms** → sections built from molecules (Header, GameGrid, SchedulePanel)
   - **Pages** → full layouts composed from organisms (via React Router routes)

5. **No raw values.** No hardcoded hex colors, px values, or arbitrary font sizes in component files. Everything traces back to a CSS variable from the token layer.

6. **Responsive by default — fill, not hug.** No fixed-width centered containers unless designed that way. Cards in a grid use `auto-fill`/`auto-fit` with `minmax`, not a fixed column count.

7. **Every interactive element needs complete states.** Default, hover, active, focus, disabled — all defined. No bare `button` with no hover style.

8. **Every state change uses transitions.** No instant visual jumps. Default: `transition: all 150ms ease`. Store as a CSS variable when the project has enough to warrant it.

9. **Ask when uncertain.** If two components look similar but you're not sure whether to merge them — show me what exists vs what's new and let me decide.

---

## Tailwind v4 — CSS-First Config

> **Important:** This project uses Tailwind CSS v4, which is CSS-first. There is no `tailwind.config.ts`. All theme customization happens in CSS using `@theme`.

### Token Layer: `src/styles/tokens.css`

```css
@import "tailwindcss";

@theme {
  /* 
    Two-layer naming strategy:
    - CSS variables keep the full category path for clarity in raw CSS (--color-text-primary)
    - Tailwind-facing variables drop the category so utilities read naturally (text-primary, bg-surface)
    
    Figma: color/text/primary → CSS var: --color-text-primary → Tailwind: --color-primary → class: text-primary
  */

  /* Step 1: full semantic vars (mirrors Figma, used in raw CSS if needed) */
  --color-text-primary: #292a2e;
  --color-text-secondary: #6b6f76;
  --color-bg-surface: #ffffff;
  --color-bg-muted: #f5f5f5;

  /* Step 2: Tailwind-facing aliases — what you actually type in className */
  --color-primary: var(
    --color-text-primary
  ); /* → text-primary, border-primary */
  --color-secondary: var(--color-text-secondary); /* → text-secondary */
  --color-surface: var(--color-bg-surface); /* → bg-surface */
  --color-muted: var(--color-bg-muted); /* → bg-muted, text-muted */

  /* Typography — from Figma type styles */
  --font-family-sans: "Inter", sans-serif;
  --font-size-heading-xl: 2rem;
  --font-size-heading-lg: 1.5rem;
  --font-size-body-md: 1rem;
  --font-size-body-sm: 0.875rem;

  /* Spacing — add when Figma defines them */
  /* --spacing-4: 1rem; */

  /* Radius */
  /* --radius-md: 0.5rem; */
}
```

In components, use the short Tailwind aliases — `text-primary`, `bg-surface`, `border-muted`. Never the double-prefix form (`text-text-primary`). The full `--color-text-*` vars exist for raw CSS use and as a paper trail back to Figma.

**Rule: `tokens.css` is the single source of truth. All CSS variables come from Figma. One chain, one truth.**

---

## Naming Convention

All names come from Figma. Two transformations happen:

1. **Full semantic var** — Figma slash path → CSS variable with full path (kept for traceability)
2. **Tailwind alias** — shortened name that reads naturally with Tailwind's utility prefix

| Figma format         | Full CSS var (`tokens.css`) | Tailwind alias → class you type    |
| -------------------- | --------------------------- | ---------------------------------- |
| `color-text-primary` | `--color-text-primary`      | `--color-primary` → `text-primary` |
| `color-bg-surface`   | `--color-bg-surface`        | `--color-surface` → `bg-surface`   |
| `color-border-muted` | `--color-border-muted`      | `--color-muted` → `border-muted`   |
| `spacing-16`         | `--spacing-16`              | → `p-16`, `m-16` (no alias needed) |
| `radius-lg`          | `--radius-lg`               | → `rounded-lg` (no alias needed)   |
| `font-heading-xl`    | `--font-size-heading-xl`    | → `text-heading-xl`                |

**Rule:** When Tailwind's utility prefix already carries the category (spacing, radius), no alias is needed. Only color tokens need aliases to avoid the double-prefix ugliness (`text-text-primary` → `text-primary`).

---

## Project Structure

```
src/
├── styles/
│   ├── tokens.css           ← @theme block (mirrors Figma variables)
│   └── figma-sync.md        ← Log of last Figma sync (date, what changed)
│
├── components/
│   ├── atoms/               ← Button, Input, Badge, Icon, Avatar, Text
│   ├── molecules/           ← GameCard, NavItem, SearchBar, TimeSlot
│   ├── organisms/           ← Header, GameGrid, ScheduleCalendar, SessionTimer
│   └── index.ts             ← Barrel exports
│
├── pages/                   ← React Router route components (compose organisms)
│   ├── Dashboard.tsx
│   ├── GameSearch.tsx
│   └── ...
│
├── showcase/
│   └── Showcase.tsx         ← Live design system reference (route: /showcase)
│
└── specs/                   ← (optional but recommended)
    ├── decisions.md         ← Why we merged X, why Y is separate
    └── components.md        ← Component inventory + status
```

> **Note on existing code:** When refactoring, move inline styles and one-off classnames from page files into the appropriate atomic component. The page file should only compose — it shouldn't contain styling logic.

---

## Before Writing Any UI Code

Every time you create or modify a component:

### Step 1: Check Figma (if link/context provided)

- Pull current tokens and component definitions
- Map Figma names to CSS variable names using the naming convention above

### Step 2: Audit existing code

- Scan `src/components/` — what already exists?
- Scan the page files — is this pattern already embedded somewhere?
- List what exists that could serve this need

### Step 3: Decide — reuse, merge, refactor, or create

- **Reuse**: exact match exists → use it
- **Merge**: near-match exists → unify with variants/props, update all references
- **Refactor**: pattern exists inline in a page → extract it into an atom/molecule
- **Create**: nothing similar exists → create new, using only tokens
- **Confused**: two things look similar but serve different purposes → ask me

### Step 4: Implement

- Use only CSS variables from `tokens.css` — zero raw values
- Use Tailwind utility classes that reference tokens (v4 style)
- Follow atomic hierarchy — atoms don't import organisms
- Match Figma component names exactly

### Step 5: Report (mandatory)

After every UI task, output a **Change Report**:

```
## Change Report

### Tokens
| Action   | Token Name            | Value     | Notes                   |
|----------|-----------------------|-----------|-------------------------|
| REUSED   | color-text-primary    | —         | Already existed          |
| ADDED    | color-bg-card-hover   | #F5F5F5   | New — from Figma         |

### Components
| Action    | Component Name    | Type      | Notes                          |
|-----------|-------------------|-----------|--------------------------------|
| REUSED    | Button            | atom      | Used existing variant           |
| EXTRACTED | GameCard          | molecule  | Was inline in GameSearch.tsx    |
| CREATED   | SessionTimer      | atom      | New                             |

### Summary
- Tokens: X reused, X added
- Components: X reused, X extracted, X created, X merged
- Raw values remaining: 0
```

If raw/hardcoded values remain, list file and line number and explain why.

---

## Refactoring Existing Pages

When working on an existing page:

1. **Don't rewrite it from scratch.** Identify the inline styles and one-off classnames.
2. **Extract the smallest atomic unit first.** If there are 3 buttons with slightly different styles, that's one `Button` atom with variants.
3. **Work bottom-up.** Atoms first, then molecules, then organisms. The page file should end up as a thin composition layer.
4. **Update all callsites.** If you extract a `GameCard` from `GameSearch.tsx`, also check `Dashboard.tsx` and anywhere else a game card appears.
5. **Don't leave orphans.** If the original inline code is replaced by a component, delete the inline version.

---

## Component Spec Format

Add a JSDoc block at the top of each component:

```tsx
/**
 * @component GameCard
 * @atomic molecule
 * @figma GameCard (Components / Cards / GameCard)
 *
 * @tokens
 *   color-bg-surface, color-text-primary, color-text-secondary,
 *   spacing-16, radius-lg
 *
 * @atoms Button, Badge, Text
 *
 * @variants
 *   - default: standard game display
 *   - compact: smaller for list view
 *
 * @states default, hover, focus
 * @transitions all 150ms ease
 */
```

---

## Showcase Page (`/showcase`)

A live, browsable page that displays every token and component. Use it to verify the system works and catch gaps.

Sections:

- **Color Variables** — swatches with name + value, grouped by category
- **Typography** — every type token rendered as a sample line
- **Atoms** — every atom in all variants and states (including hover/focus/disabled)
- **Molecules** — each molecule with a realistic usage example
- **Organisms** — each organism at full width with placeholder content

Rules:

- Showcase imports real components — no recreations
- Showcase uses only tokens
- If a component exists in code but not in showcase, it's not done
- Showcase must be fully responsive

---

## Figma Sync Workflow

When a Figma link is provided:

1. Pull variables and component definitions from Figma
2. Diff against `src/styles/tokens.css`
3. Report:

```
## Figma Sync Report

| Status    | Token / Component       | Figma Value | Code Value | Action Needed    |
|-----------|-------------------------|-------------|------------|------------------|
| IN SYNC   | color-text-primary      | #292A2E     | #292A2E    | None             |
| DRIFT     | color-bg-surface        | #FAFAFA     | #FFFFFF    | Update code      |
| NEW       | color-accent-hover      | #3B82F6     | —          | Add to tokens    |
| ORPHAN    | color-old-brand         | —           | #FF5733    | Remove from code |
```

4. Wait for approval before acting on DRIFT, NEW, and ORPHAN items.

---

## Merge Rules

| Scenario                                     | Action                                                    |
| -------------------------------------------- | --------------------------------------------------------- |
| Same visual output, different names          | Merge → keep the Figma name                               |
| Same structure, different spacing/color      | Merge → add variant prop                                  |
| Similar but different use cases              | Ask me                                                    |
| One is clearly an older version of the other | Merge → keep current Figma version, update all references |
| Both exist in Figma as separate components   | Keep separate — Figma decides                             |
| Pattern is inline in a page file             | Extract to atom/molecule, replace inline usage            |

---

## Anti-Patterns (Never Do This)

| ❌ Don't                                               | ✅ Do                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| `className="text-[#292A2E]"`                           | `className="text-primary"`                                    |
| `style={{ padding: '16px' }}`                          | Use a spacing token class                                     |
| `border-radius: 8px` raw                               | Use a radius token                                            |
| Create `GameCardV2` next to `GameCard`                 | Add variant prop to `GameCard`                                |
| Rename Figma token to a "nicer" name                   | Use exact Figma name                                          |
| Skip the change report                                 | Always output the table                                       |
| Create component without checking existing             | Scan first, always                                            |
| Leave styling logic in a page file                     | Extract to the appropriate atomic level                       |
| Interactive element with no hover/focus state          | All interactive elements need all states                      |
| Instant color/bg change on hover                       | Always use `transition` on state changes                      |
| Component not in `/showcase`                           | If it's not in showcase, it's not done                        |
| Edit `tailwind.config.ts`                              | This project uses Tailwind v4 — all config is in `tokens.css` |
| Assume Next.js patterns (App Router, `app/` dir, etc.) | This is Vite + React Router — use `src/pages/` and routes     |

---

## Quick Reference for New Sessions

1. Read this file
2. Read `src/styles/tokens.css` — what tokens exist?
3. Read `src/components/index.ts` — what components exist?
4. Read `src/specs/decisions.md` if it exists — what decisions were made?
5. For any UI task: audit existing code → decide → implement → report
6. When in doubt, ask. Show me what exists vs what's proposed. Let me pick.

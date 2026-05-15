# Typography Refactoring Guide

## Status: Partial Completion

- **Pages Fully Refactored:** 6/27 (22%)
  - AuthPage ✅
  - CreateTeamPage ✅
  - ProfileSelectionPage ✅
  - TeamAvatarSelectionPage ✅
  - LandingPage ✅
  - FriendsPage ✅

- **Pages with Imports Added (Ready to refactor):** 21/27
- **Total H-tags replaced:** ~100

## Import Pattern (Already added to all pages)

```tsx
import { Heading, Text, Label } from "@/components/atoms";
```

## Refactoring Rules

### 1. Heading Tags

| Old                    | New                       | Notes                                                    |
| ---------------------- | ------------------------- | -------------------------------------------------------- |
| `<h1 className="...">` | `<Heading level={1}>`     | Keep margin/padding classes                              |
| `<h2 className="...">` | `<Heading level={2}>`     | Remove: `text-2xl`, `text-3xl`, `font-bold`, `uppercase` |
| `<h3 className="...">` | `<Heading level={3}>`     | Keep: flex, gap, items-center, etc.                      |
| `<h4>`, `<h5>`, `<h6>` | `<Heading level={4/5/6}>` | Remove all typography classes                            |

### 2. Paragraph Tags

| Old                                          | New                          | Context                     |
| -------------------------------------------- | ---------------------------- | --------------------------- |
| `<p className="text-sm ...">`                | `<Text>`                     | Body text (default)         |
| `<p className="text-xs ...">`                | `<Caption variant="small">`  | Small metadata/labels       |
| `<p className="text-white/40 ...">`          | `<Text variant="secondary">` | Muted/secondary text        |
| `<p className="text-white/60 ...">`          | `<Text variant="secondary">` | Slightly more visible muted |
| `<p className="font-light text-[10px] ...">` | `<Caption variant="small">`  | Helper text                 |

### 3. Label Tags

```tsx
// Old
<label className="block text-[11px] font-semibold text-white/50 uppercase">

// New
<Label variant="default">
```

### 4. Color Modifiers

| Old Class           | New Prop              | Component            |
| ------------------- | --------------------- | -------------------- |
| `text-plaeen-green` | `color="accent"`      | Heading, Text, Label |
| `text-white`        | (remove - default)    | All text components  |
| `text-white/40`     | `variant="secondary"` | Text                 |
| `text-white/60`     | `variant="secondary"` | Text                 |

### 5. Classes to Remove

**ALWAYS REMOVE:**

- `font-bold`, `font-semibold`, `font-light`, `font-black`, `font-normal`
- `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`, `text-5xl`, `text-6xl`
- `uppercase`
- `tracking-*` (letter-spacing)
- `leading-*` (line-height) - except when needed for layout

**KEEP:**

- `flex`, `gap-*`, `items-*`, `justify-*`
- `mb-*`, `mt-*`, `p-*`, `px-*`, `py-*` (spacing)
- `rounded-*`, `border-*` (styling)
- `bg-*`, `text-accent`, `text-secondary`, `text-muted` (color utility only, not typography color)

### 6. Span Elements

```tsx
// If span is just for text color:
<span className="text-plaeen-green">text</span>
// →
<span className="text-accent">text</span>

// If span is for semantic text styling:
<span className="text-white font-bold">text</span>
// → Keep as span but remove typography classes
<span>text</span>
```

### 7. Examples

#### Example 1: Heading with Icon

```tsx
// Before
<h2 className="flex items-center gap-3">
  <Check size={24} className="text-plaeen-green" /> Your Friends
</h2>

// After
<Heading level={2} className="flex items-center gap-3">
  <Check size={24} className="text-accent" /> Your Friends
</Heading>
```

#### Example 2: Metadata Text

```tsx
// Before
<p className="text-[10px] text-white/40 font-bold uppercase mb-1">
  STATUS LABEL
</p>

// After
<Caption variant="small" className="mb-1">
  STATUS LABEL
</Caption>
```

#### Example 3: Mixed Content

```tsx
// Before
<p className="text-sm font-medium text-white">
  <span className="text-plaeen-green">{name}</span>
  <span className="text-white/40 ml-1">Invited You</span>
</p>

// After
<Text>
  <span className="text-accent">{name}</span>
  <span className="text-secondary ml-1">Invited You</span>
</Text>
```

## Remaining Pages to Refactor (21)

All pages below already have imports added. Follow the rules above to refactor:

1. **MyGamesPage.tsx** - ~8 h-tags
2. **ParentDashboard.tsx** - ~20 h-tags (HIGH PRIORITY)
3. **KidDashboard.tsx** - ~9 h-tags (already partially done)
4. **NotificationsPage.tsx** - ~1 h-tag
5. **OvertimeDecisionPage.tsx** - ~6 h-tags
6. **ParentActivityPage.tsx** - ~6 h-tags
7. **ParentSettingsPage.tsx** - ~6 h-tags
8. **ProfilePage.tsx** - ~2 h-tags
9. **ProposeSessionPage.tsx** - ~5 h-tags
10. **ResetPinPage.tsx** - ~3 h-tags
11. **TeamDetailPage.tsx** - ~8 h-tags
12. **TeamGameDetailPage.tsx** - ~6 h-tags
13. **TeamSettingsPage.tsx** - ~6 h-tags
14. **TeamsPage.tsx** - ~2 h-tags
15. **UserAvatarSelectionPage.tsx** - ~1 h-tag
16. **ApprovalsPage.tsx** - ~4 h-tags
17. **ChildManagementPage.tsx** - ~10 h-tags
18. **OnboardingPage.tsx** - ~3 h-tags
19. **CalendarPage.tsx** - partially done
20. **KidCalendarPage.tsx** - partially done
21. **GameSearchPage.tsx** - partially done

## Quick Refactoring Process

1. Open page file
2. Search for `<h1`, `<h2`, `<h3`, `<p `
3. For each match:
   - Identify the context (heading, body, caption, label)
   - Replace tag with appropriate component
   - Remove typography classes
   - Update color classes to color props
   - Add className only for spacing/layout (not typography)

## Commands to Find Tags

```bash
# Find all heading tags in a file
grep -n "<h[1-6]" src/pages/FILENAME.tsx

# Find all paragraph tags
grep -n "<p " src/pages/FILENAME.tsx

# Find all label tags
grep -n "<label" src/pages/FILENAME.tsx
```

## Tokens Available

**Heading variants:**

- `variant="display"` - 48px Abolition (page titles)
- `variant="lg"` - 24px Bold (card headings)
- `variant="md"` - 16px Bold (section headings)
- `variant="sm"` - 14px Bold (widget titles)
- `variant="subtitle"` - 12px SemiBold (subtitles)
- `variant="tab"` - 14px Bold (tab labels)

**Text variants:**

- `default` - 16px, color-text-primary
- `small` - 14px, color-text-primary
- `secondary` - 16px, color-text-secondary
- `muted` - 16px, color-text-muted

**Caption variants:**

- `default` - 12px, color-text-secondary
- `small` - 10px, color-text-secondary (light)
- `muted` - 12px, color-text-muted
- `secondary` - 12px, color-text-secondary

**Label variants:**

- `default` - 12px SemiBold, color-text-primary
- `secondary` - 12px SemiBold, color-text-secondary
- `muted` - 12px SemiBold, color-text-muted

## Color Props Available

- `color="primary"` (default)
- `color="accent"` → maps to text-accent (lime green)
- `color="muted"` → maps to text-muted

---

**Last updated:** 2026-05-10
**Refactoring progress:** 22% complete, ~100 tags refactored
**Estimated remaining:** ~350 tags across 21 pages

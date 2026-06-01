---
title: 'Optimize Export/Import/BindPubKey Pages Style Consistency'
slug: 'optimize-export-import-bind-pubkey-style'
created: '2026-05-22'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['React 19', 'TypeScript', 'Vite + CRX Plugin', 'Tailwind CSS 4', 'CSS Custom Properties (--sx-*)', 'Zustand']
files_to_modify:
  - 'extension/src/entries/popup/components/key-manage/export.tsx'
  - 'extension/src/entries/popup/components/key-manage/import.tsx'
  - 'extension/src/entries/popup/components/bind-pubkey/index.tsx'
  - 'extension/src/entries/popup/components/key-manage/styles.css'
  - 'extension/src/entries/popup/components/key-manage/password.css'
code_patterns: ['CSS custom properties (--sx-*)', 'Tailwind utility classes', 'field card pattern (sx-field-card)', 'button grid layout (sx-task-actions)', 'signing overlay pattern (fixed inset-0 bg-[#101820]/82)', 'key-manage CSS class pattern (key-manage-page + key-manage-card)', '.key-manage-* CSS classes used by KeyManage page but not by export/import/bind-pubkey']
test_patterns: ['Manual visual regression in popup + side panel', 'grep hardcoded color literals verification']
---

# Tech-Spec: Optimize Export/Import/BindPubKey Pages Style Consistency

**Created:** 2026-05-22

## Overview

### Problem Statement

The Export, Import, and BindPubKey pages use hardcoded Tailwind color values (e.g., `bg-[#fff]`, `text-[#000]/60`, `border-[rgba(0,0,0,0.2)]`, `text-[#E99E42]`, `bg-[#00be78]/10`) instead of the project's CSS custom properties (`var(--sx-*)`) defined in `index.css`. This creates visual inconsistency with the rest of the extension's UI (task cards, field cards, buttons, overlays) and makes future theme changes impossible without touching every page individually.

Additionally, the loading/verification mask on the Import page uses a different visual style (white semi-transparent) than the signing overlay on the Task page (dark overlay with branded spinner), and the button layouts don't follow the established grid pattern.

### Solution

Replace all hardcoded Tailwind color literals with the project's CSS design tokens (`--sx-*`). Adopt existing UI patterns consistently: field cards, button action grids, info boxes, warning alerts, and dark overlay for loading states. Ensure Export, Import, and BindPubKey pages feel native to the extension's design system.

### Scope

**In Scope:**
- Replace hardcoded colors with CSS variables across export.tsx, import.tsx, bind-pubkey/index.tsx
- Unify button layouts to use `sx-task-actions` grid pattern
- Unify loading/verification overlay on Import page to match signing overlay style
- Unify info/warning box styles using design tokens
- Update PubKey value display to use monospace font + field card pattern
- Use existing `key-manage-*` CSS classes from `styles.css` where applicable
- Clean up unused/duplicate styles in `password.css`

**Out of Scope:**
- Changing business logic or component behavior
- Adding new features (e.g., copy button)
- Modifying PinPopup component
- Modifying Radio component
- Full accessibility audit
- Google Drive integration logic

## Context for Development

### Codebase Patterns

| Pattern | File | Selector/Class |
| ------- | ---- | -------------- |
| CSS Design Tokens | `index.css` | `--sx-bg`, `--sx-surface`, `--sx-text`, `--sx-muted`, `--sx-brand`, `--sx-brand-soft`, `--sx-warning`, `--sx-warning-soft`, `--sx-danger`, `--sx-border`, `--sx-radius-sm/md/lg/xl`, `--sx-shadow-card/raised` |
| Field Card | `index.css` | `.sx-field-card` — border, radius, bg, padding |
| Field Title | `index.css` | `.sx-field-title` — uppercase, muted, font-weight 700 |
| Field Value | `index.css` | `.sx-field-value` — text color, word-break, monospace for addresses |
| Task Card | `index.css` | `.sx-task-card` — same characteristics |
| Button Grid | `index.css` | `.sx-task-actions` — `grid grid-cols-[1fr_1.15fr] gap-[10px]` |
| Signing Overlay | `index.tsx` | `fixed inset-0 bg-[#101820]/82 flex items-center justify-center z-50` + centered spinner |
| Warning Alert | `index.css` | Uses `var(--sx-warning)` for text, `var(--sx-warning-soft)` for bg |
| Key Manage Styles | `styles.css` | `.key-manage-page`, `.key-manage-card`, `.key-pubkey-block`, `.key-action-grid` |

### Files to Reference

| File | Purpose | Key Sections |
| ---- | ------- | ------------ |
| `extension/src/entries/popup/index.css` | CSS design tokens and component patterns | `:root` vars, `.sx-field-card`, `.sx-task-actions`, `.sx-task-card` |
| `extension/src/entries/popup/components/key-manage/styles.css` | Existing key-manage component styles — **used by index.tsx but NOT by export/import/bind-pubkey** | `.key-manage-page`, `.key-pubkey-value`, `.key-action-grid` |
| `extension/src/entries/popup/components/key-manage/password.css` | Password input styles — **dead code, no component references these classes** | `.key-manage .password`, `.export-password` |
| `extension/src/entries/popup/components/key-manage/export.tsx` | Export page — hardcoded colors throughout | 460 lines |
| `extension/src/entries/popup/components/key-manage/import.tsx` | Import page — hardcoded colors + white overlay | 368 lines |
| `extension/src/entries/popup/components/bind-pubkey/index.tsx` | Bind pubkey page — hardcoded colors, simplest page | 58 lines |
| `extension/src/entries/popup/components/key-manage/index.tsx` | KeyManage main page — **reference pattern**: correctly uses `.key-manage-page` + `.key-manage-card` CSS classes | 47 lines |
| `extension/src/entries/popup/components/task/index.tsx` | Reference for overlay pattern | SigningOverlay component |
| `extension/src/components/radio/index.tsx` | Radio component — also uses hardcoded `#00be78`, `#000]/60`, `rgba(0,0,0,0.2)` but **OUT OF SCOPE** for this task | 68 lines |
| `extension/src/components/button/index.tsx` | Button component — already has `loading` prop, no changes needed | — |

### Key Investigation Findings

1. **`.key-manage-*` CSS classes exist and are used correctly by KeyManage page but ignored by child pages.** Export/import/bind-pubkey pages use inline Tailwind instead of the existing CSS pattern.

2. **`password.css` is dead code** — no component references `.key-manage .password`, `.export-password`, or `.import-password`. Safe to remove.

3. **Radio component also uses hardcoded brand color (`#00be78`)** but changing it affects ALL pages using Radio (initialize, set-session-expire, etc.). This is a separate change and OUT OF SCOPE.

4. **`#00be78` (brand green) appears in ~20 locations** across templates, PinPopup, initialize pages, task categories. Only the 3 target pages (export/import/bind-pubkey) are in scope.

5. **`index.css` defines `@media (max-width: 420px)` responsive rules** for `.sx-task-actions` grid. Export/import pages don't have this protection — their button containers will need it.

### Technical Decisions

1. **Use Tailwind `var(--sx-*)` syntax directly in className**
   - Why: The project already uses this pattern extensively (e.g., `bg-[var(--sx-bg)]`, `text-[var(--sx-muted)]`). No need for custom CSS classes for simple color replacements.

2. **Use existing `key-manage-*` CSS classes alongside inline Tailwind**
   - Why: `styles.css` already defines well-structured classes for key-manage layouts. Combining them with Tailwind utilities for spacing/color keeps changes minimal.

3. **Adopt `sx-task-actions` grid pattern for button groups**
   - Why: Already established, responsive, and visually balanced. `grid-cols-[1fr_1.15fr]` gives the primary button more visual weight.

4. **Replace Import overlay white style with dark signing overlay style**
   - Why: Consistency with the rest of the app. The dark overlay (`bg-[#101820]/82`) with white spinner is the established pattern for loading states.

5. **Use `var(--sx-warning)` for warning text instead of `#E99E42`**
   - Why: `#875300` (sx-warning) is the design system's warning color. The original `#E99E42` (amber) was an ad-hoc choice. Semantic consistency over pixel-matching.

6. **Leverage existing `.key-manage-*` CSS classes to reduce Tailwind bloat**
   - Why: `styles.css` already has `.key-manage-page`, `.key-manage-card`, `.key-pubkey-block` etc. Using them alongside targeted Tailwind utilities keeps className strings shorter and centralizes style definitions.

7. **Simplify outer container DOM structure**
   - Why: Current pages use double-nested `<div>` (`px-[1.5rem] py-[1.5rem] w-full` → `rounded-[20px] bg-[#fff]`). Can collapse to single card layer using `.key-manage-page` + `.key-manage-card`, reducing unnecessary nesting.

### Implementation Order

Tasks should be executed in this sequence to minimize merge conflicts and build confidence:

1. **Task 4** (CSS cleanup) — smallest blast radius, establishes foundation
2. **Task 3** (BindPubKey) — simplest page, 7 sub-steps, validates the pattern
3. **Task 1** (Export) — medium complexity, validates color migration + layout
4. **Task 2** (Import) — most complex (overlay + isVerifying state), do last

### Cross-Functional Notes

- **PM**: Release notes should mention "UI consistency improvements to key management pages" — user-visible difference is minimal (same color family, different shades). No interaction logic changes.
- **Engineer**: `.key-manage-page` class in `styles.css` already sets `background: var(--sx-bg)` and proper padding — reuse it for outermost container instead of repeating Tailwind utilities.
- **Designer**: `var(--sx-warning)` is the design system's canonical warning color. If amber is preferred over brown, update the variable value in `index.css`, not the page files.

## Implementation Plan

### Tasks

- [ ] **Task 1: Style Export page with design tokens**
  - File: `extension/src/entries/popup/components/key-manage/export.tsx`
  - Action:
    1. Replace outer container bg from implied white → `bg-[var(--sx-bg)]` (page background) on outermost div
    2. Replace `bg-[#fff]` → `bg-[var(--sx-surface)]` on inner card
    2. Replace `text-[#000]/60` → `text-[var(--sx-muted)]` on all titles
    3. Replace `border-[rgba(0,0,0,0.2)]` → `border-[var(--sx-border)]` on all card borders
    4. Replace `text-[#E99E42]` → `text-[var(--sx-warning)]` on warning text
    5. Replace `text-[#ff0000]` → `text-[var(--sx-danger)]` on error messages
    6. Replace `bg-[#00be78]/10` → `bg-[var(--sx-brand-soft)]` on info box
    7. Replace input `bg-[#fff]/90 border-[#000]/10` → `bg-[var(--sx-surface-soft)] border-[var(--sx-border)] focus:border-[var(--sx-focus)] focus:outline-none`
    8. Update button container to `sx-task-actions` grid pattern
    9. Verify responsive behavior: button text at side panel width (~490px) doesn't overflow grid cells

- [ ] **Task 2: Style Import page with design tokens**
  - File: `extension/src/entries/popup/components/key-manage/import.tsx`
  - **Phase A — Color migration:**
    1. Replace outer container bg from implied white → `bg-[var(--sx-bg)]` (page background) on outermost div
    2. Replace `bg-[#fff]` → `bg-[var(--sx-surface)]` on inner card
    3. Replace `text-[#000]/60` → `text-[var(--sx-muted)]` on all titles
    4. Replace `border-[rgba(0,0,0,0.2)]` → `border-[var(--sx-border)]` on all card borders
    5. Replace `text-[#E99E42]` → `text-[var(--sx-warning)]` on warning text
    6. Replace `bg-[#00be78]/10` → `bg-[var(--sx-brand-soft)]` on info box
    7. Replace input `bg-[#fff]/90 border-[#000]/10` → `bg-[var(--sx-surface-soft)] border-[var(--sx-border)] focus:border-[var(--sx-focus)] focus:outline-none`
  - **Phase B — Layout & overlay:**
    8. Replace loading overlay from `bg-[#fff]/60` white style to `fixed inset-0 bg-[#101820]/82 z-50` + centered white card (`bg-white rounded-[16px] shadow-[var(--sx-shadow-raised)] p-6`) containing spinner + progress text (matches SigningOverlay timeout state pattern — dark backdrop, white card container)
    9. Add unmount cleanup: useEffect return clears `isVerifying` to prevent permanent button disabled state if component unmounts during verification
    10. Replace hardcoded `#00be78` green in overlay to `var(--sx-brand)`
    11. Update button container to `sx-task-actions` grid pattern

- [ ] **Task 3: Style BindPubKey page with design tokens**
  - File: `extension/src/entries/popup/components/bind-pubkey/index.tsx`
  - **Phase A — Color migration:**
    1. Replace outer container bg from implied white → `bg-[var(--sx-bg)]` (page background) on outermost div
    2. Replace `bg-[#fff]` → `bg-[var(--sx-surface)]` on inner card
    3. Replace `text-[#000]/60` → `text-[var(--sx-muted)]` on title
    4. Replace `border-[rgba(0,0,0,0.2)]` → `border-[var(--sx-border)]` on field card
  - **Phase B — Layout & pubkey styling:**
    5. Update pubkey value to use monospace font + proper spacing (`font-mono text-[13px]`)
    6. Apply `sx-field-card` or equivalent class pattern to the pubkey block
    7. Update button container to `sx-task-actions` grid pattern

- [ ] **Task 4: Clean up styles.css and password.css**
  - Files: `styles.css`, `password.css`
  - Action:
    1. Review `key-manage-*` classes — update if needed for new token usage
    2. Remove unused `.password` styles if no longer referenced
    3. Ensure `.key-action-grid` uses same `grid-cols-[1fr_1.15fr]` as `.sx-task-actions`
    4. Add any missing utility classes needed by the refactored pages

### Acceptance Criteria

- [ ] **AC 1**: Given the Export page is displayed, when visually inspected, all colors (text, borders, backgrounds, warning, info) use CSS custom properties matching the global design system
- [ ] **AC 2**: Given the Import page is displayed, when visually inspected, all colors use CSS custom properties matching the global design system
- [ ] **AC 3**: Given the BindPubKey page is displayed, when visually inspected, all colors use CSS custom properties matching the global design system
- [ ] **AC 4**: Given the Import page is verifying a file, when the loading overlay appears, it matches the dark overlay style (`bg-[#101820]/82` + centered spinner) used in the signing flow
- [ ] **AC 5**: Given any of the three pages is displayed, when viewing the action buttons (Cancel/Export/Import/Bind), they use the `grid-cols-[1fr_1.15fr]` layout pattern matching task actions
- [ ] **AC 6**: Given the BindPubKey page is displayed, when viewing the pubkey value, it uses monospace font and proper field card styling
- [ ] **AC 7**: Given the style changes are applied, when the extension is opened in side panel mode, the pages render correctly without overflow or layout issues
- [ ] **AC 8**: Given the style changes are applied, when navigating between pages, there are no visual regressions (colors flash, missing variables, broken layouts)
- [ ] **AC 9**: Given the implementation is complete, when running `grep -rn '#[0-9a-fA-F]\{6\}\|rgba(0,0,0' export.tsx import.tsx bind-pubkey/index.tsx` (excluding `.css` files and comments), no hardcoded color literals remain
- [ ] **AC 10**: Given all three pages are opened in side panel mode (scale factor 0.8167), when visually inspected, no button overflow, no layout collapse, and all field cards render correctly

## Additional Context

### Dependencies

- No external library changes
- No API changes
- Uses existing CSS variables — no new variables needed
- Uses existing Button component — no changes needed
- **Radio component**: Still uses hardcoded `#00be78`. Out of scope but noted. Future refactor candidate.

### Investigation Findings

1. `.key-manage-*` CSS classes in `styles.css` are used by KeyManage index page but ignored by child pages (export/import/bind-pubkey)
2. `password.css` is dead code — safe to remove entirely
3. `#00be78` appears in ~20 locations across the codebase; only 3 pages are in scope
4. `@media (max-width: 420px)` responsive rules exist in `index.css` for `.sx-task-actions` — child pages lack this protection
5. Radio component also uses hardcoded brand color — separate change, out of scope

### Testing Strategy

- **Manual visual review required** (no visual snapshot testing available):
  1. Open Export page → verify all colors use design tokens, layout consistent
  2. Open Import page → verify all colors use design tokens, loading overlay matches signing style
  3. Open BindPubKey page → verify pubkey monospace, field card styling, button layout
  4. Test all three pages in side panel mode → verify no layout breakage
  5. Verify no hardcoded color values remain in the three pages
  6. Verify error states (red text) still visible and readable

### Notes

- The PinPopup component is NOT in scope — it's used by both Export and Import but has its own styling
- The Radio component is NOT in scope — it works correctly with existing styles
- `password.css` contains mostly unused styles from a previous iteration — safe to clean up
- The Export page's Google Drive section and Import page's Google Drive section inherit the same card styling, so fixing the shared card class fixes both paths

### First Principles Insights

**Core principle: semantic consistency, not mechanical replacement.**

- **Warning color:** The original `#E99E42` (amber) will be unified to `var(--sx-warning)` (`#875300`). This is the design system's warning token — consistent semantics, not pixel-matching the old color.
- **Class reuse over inline Tailwind:** The existing `.key-manage-*` CSS classes in `styles.css` should be used aggressively instead of repeating lengthy Tailwind utility chains. This reduces className bloat and centralizes style definitions.
- **DOM simplification:** Export and Import pages use a double-nested `<div>` pattern for the outer card. Simplify to a single card layer matching the established `.key-manage-card` / `sx-task-card` pattern.
- **Semantic class names:** Where Tailwind utilities are still needed, use the semantic approach — e.g., `text-[var(--sx-muted)]` rather than `text-[#000]/60`.
- **Legacy cleanup:** `password.css` has rules for `.key-manage .password` and `.export-password` that no component references. These are dead code and should be removed.

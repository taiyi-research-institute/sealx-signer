---
title: 'Fix Signing Overlay Animation'
slug: 'fix-signing-overlay-animation'
created: '2026-05-20'
status: 'Implementation Complete'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['React', 'TypeScript', 'Chrome Extension (Manifest V3)', 'Tailwind CSS', 'Zustand']
files_to_modify:
  - 'extension/src/entries/popup/components/task/index.tsx'
  - 'extension/src/entries/popup/components/task/task-render.tsx'
  - 'extension/src/entries/popup/components/task/Task-detail.tsx'
  - 'extension/src/components/button/index.tsx'
code_patterns: ['React state-driven overlay', 'Tailwind animate-spin', 'animate-pulse', 'fixed positioning overlay', 'button loading prop', 'setTimeout deferred close', 'closeWindow via PanelManager message']
test_patterns: ['Manual testing in popup + side panel contexts']
---

# Tech-Spec: Fix Signing Overlay Animation

**Created:** 2026-05-20

## Overview

### Problem Statement

When users sign or reject tasks in the extension, there is no visual feedback (overlay animation). The SigningOverlay component exists in TaskHome but doesn't display during the signing flow. The rejection path has no animation at all — the panel simply disappears instantly with zero feedback.

Root causes (confirmed via Pre-mortem + First Principles analysis):
1. **Approval path — overlay invisible**: `TaskHome` returns a Fragment (`<>`), so the `SigningOverlay` with `absolute inset-0` has no positioned parent. Must use `fixed` positioning instead.
2. **Approval path — window closes too fast**: The `onSign` callback immediately sets `setSigning(false)` and calls `clearTaskAndCloseIfDone()`, closing the window before any overlay can render. This is the **primary blocker**.
3. **Reject path**: `onRejected()` directly calls `props.onSign(taskId, '')` without any loading/animation state — zero feedback.
4. **TaskDetail path**: Has its own inline overlay for approval, but rejection also lacks animation.

### Solution

Apply **weight-matched feedback** for two different action types:

- **Approval (weight: heavy)**: Fix overlay positioning (`fixed` instead of `absolute`), enforce minimum 800ms display duration, delay `clearTaskAndCloseIfDone()` to let the user see the animation before the window closes.
- **Rejection (weight: light)**: Use button-level inline feedback (button transforms to spinner + "Rejecting..." text) with 300-500ms delay before closing. No full-screen overlay needed — rejection is instant and lighter.

### Scope

**In Scope:**
- Fix SigningOverlay: `absolute` → `fixed` positioning for both TaskHome and TaskDetail
- Fix `onSign` callback: delay `clearTaskAndCloseIfDone()` and `setSigning(false)` until after minimum display duration
- Add rejection button-level animation for TaskHome (SignTaskRender)
- Add rejection button-level animation for TaskDetail
- Add basic accessibility (`aria-busy`, `role="alert"`)
- Ensure both popup and side panel contexts work correctly

**Out of Scope:**
- Changing overall UI/UX design style
- Modifying signing/rejection business logic
- Full WCAG accessibility audit
- Adding new features beyond animation fix

## Context for Development

### Codebase Patterns

- React state-driven overlay: boolean `signing` state controls overlay visibility
- Tailwind animations: `animate-spin` for spinner, `animate-pulse` for pulsing text
- Button `disabled={props.signing}` pattern to prevent double-clicks
- **Change**: `absolute inset-0` → `fixed inset-0` for overlay positioning (does not depend on parent)
- Message flow: `onApproval` → `sign()` API → `onSign()` callback → reply + SIGN_RESPONSE
- `closeWindow` is async message-based (`SealxTopic.CLOSE` → `PanelManager.closePanel()`), can be deferred with `setTimeout`
- Side panel mode: `closeWindow` navigates to `#` instead of closing; same component tree as popup via `usePopupType()`
- Button component (`src/components/button`): `variant`/`disabled`/`children` props, no `loading` prop — needs to be added

### Files to Reference

| File | Purpose | Key Lines |
| ---- | ------- | --------- |
| `extension/src/entries/popup/components/task/index.tsx` | TaskHome: signing state, SigningOverlay, onSign callback, overlay render | Overlay: 42-69, onSign: 315-361, render: 522-533 |
| `extension/src/entries/popup/components/task/task-render.tsx` | SignTaskRender: Approve/Reject buttons, onApproval/onRejected handlers | onRejected: 374-376, onApproval: 396-441, buttons: 623-654 |
| `extension/src/entries/popup/components/task/Task-detail.tsx` | TaskDetail: inline overlay, handleSign for multi-subtask | Overlay: 175-182, handleSign: 70-115 |
| `extension/src/components/button/index.tsx` | Button component: needs `loading` prop added | All |
| `extension/src/core/background/index.ts` | `closeWindow` function: sends CLOSE message to background | Line 174 |

### Technical Decisions

1. **Overlay positioning: `fixed` instead of `absolute`**
   - Why: `absolute` requires a positioned parent; `TaskHome` returns a Fragment, so no positioned parent exists. `fixed` works relative to viewport regardless of DOM hierarchy. Works in both popup and side panel.

2. **Weight-matched feedback: approval gets overlay, rejection gets button-level**
   - Why: Approval is an async operation requiring user patience — full overlay is appropriate. Rejection is instant — a full overlay would feel sluggish and over-designed. Button-level feedback is proportional to the action.

3. **Minimum 800ms display duration for approval overlay**
   - Why: React batches state updates; without a minimum duration, the overlay may render and disappear in the same frame. 800ms gives enough time for users to perceive the animation without feeling slow.

4. **Delay `clearTaskAndCloseIfDone()` in `onSign` callback**
   - Why: This is the **primary blocker** — the window closes before any overlay can render. The delay ensures the overlay is visible before the window dismisses.

5. **Accessibility: `aria-busy` + `role="alert"`**
   - Why: Screen readers need to announce the signing/rejecting state. Lightweight addition, no design impact.

## Implementation Plan

### Tasks

- [x] **Task 1: Add `loading` prop to Button component**
  - File: `extension/src/components/button/index.tsx`
  - Action: Add `loading?: boolean` prop. When `loading` is true, render a small spinner (`animate-spin rounded-full h-3 w-3 border-2 border-white/30 border-t-white`) before the children text, and set `disabled` to true
  - Notes: Button already spreads `...props`, add `loading` to destructured props. When loading, disable click and show spinner + children text together

- [x] **Task 2: Fix SigningOverlay positioning — `absolute` → `fixed`**
  - File: `extension/src/entries/popup/components/task/index.tsx`
  - Action: In the `SigningOverlay` component (lines 42-69), change both overlay `<div>` outer containers from `absolute inset-0` to `fixed inset-0`
  - Notes: Both the normal "Signing..." overlay and the timeout overlay need this change. Ensure z-index is high enough (`z-50` or higher)

- [x] **Task 3: Fix `onSign` callback — delay window close after approval**
  - File: `extension/src/entries/popup/components/task/index.tsx`
  - Action: In `onSign` callback (line 315-361), after `setSigning(false)`, wrap `clearTaskAndCloseIfDone(taskId)` in a `setTimeout` of 800ms. This ensures the overlay is visible before the window dismisses
  - Notes: The 800ms timer should start AFTER `setSigning(false)` is called (which removes the overlay), so instead the flow should be: show overlay → wait 800ms → `setSigning(false)` → `clearTaskAndCloseIfDone()`

- [x] **Task 4: Add rejecting state + rejection animation to SignTaskRender**
  - File: `extension/src/entries/popup/components/task/task-render.tsx`
  - Action: 
    1. Add `rejecting` state to `SignTaskRender`: `const [rejecting, setRejecting] = useState(false)`
    2. Replace `onRejected` function: instead of directly calling `props.onSign`, set `setRejecting(true)`, then `setTimeout(() => { props.onSign(props.taskId, ''); }, 400)`
    3. Pass `loading={rejecting}` to the Reject Button, and change button text to "Rejecting..." when `rejecting` is true
    4. Also disable both buttons when `rejecting` is true
  - Notes: The 400ms delay gives time for the spinner to render before the panel closes

- [x] **Task 5: Add rejecting state + rejection animation to TaskDetail**
  - File: `extension/src/entries/popup/components/task/Task-detail.tsx`
  - Action:
    1. Add `rejecting` state: `const [rejecting, setRejecting] = useState(false)`
    2. Modify `handleSign` (line 70-115): for the rejection path (line 75-86 where `signature === '' || signature === null`), first set `setRejecting(true)`, then `setTimeout(() => { ... existing rejection logic ... }, 400)`
    3. Add a small inline "Rejecting..." indicator or use the Button loading pattern for the Reject button
    4. Also add `loading={rejecting}` to the Reject Button if SignTaskRender's reject button supports it, or add a temporary overlay-style indicator
  - Notes: TaskDetail passes `setSigning` to SignTaskRender, so the rejecting state needs to be in TaskDetail and passed down

- [x] **Task 6: Add accessibility attributes to overlay**
  - Files: `extension/src/entries/popup/components/task/index.tsx`, `extension/src/entries/popup/components/task/Task-detail.tsx`
  - Action: Add `role="alert"` and `aria-busy="true"` to the overlay containers (both signing and rejecting states)
  - Notes: Lightweight addition, ensures screen readers announce the state

### Acceptance Criteria

- [x] **AC 1**: Given a signing task is displayed, when the user clicks "Sign to Approve", then a full-screen overlay with spinner and "Signing..." text appears with `fixed` positioning, stays visible for at least 800ms, and then the window closes/navigates away
- [x] **AC 2**: Given a signing task is displayed, when the user clicks "Reject", then the Reject button shows a loading spinner with "Rejecting..." text for ~400ms, then the window closes/navigates away
- [x] **AC 3**: Given a multi-subtask signing flow (TaskDetail), when the user clicks "Sign to Approve", then the inline overlay with spinner appears and stays visible for at least 800ms
- [x] **AC 4**: Given a multi-subtask signing flow (TaskDetail), when the user clicks "Reject", then a loading indicator appears for ~400ms, then the window closes/navigates away
- [x] **AC 5**: Given any signing or rejecting overlay is visible, when a screen reader is active, then the state is announced via `role="alert"` and `aria-busy="true"`
- [x] **AC 6**: Given a signing overlay is visible, when the user tries to interact with buttons, then all buttons are disabled (preventing double-click)
- [x] **AC 7**: Given a rejection is in progress, when the user tries to click other buttons, then all buttons are disabled (preventing double-click)
- [x] **AC 8**: Given the fix works in popup mode, when the same scenario is tested in side panel mode, then the overlay animation and rejection feedback work identically

## Additional Context

### Dependencies

- No external library changes needed
- Uses existing Tailwind animation utilities (`animate-spin`)
- `closeWindow` is already imported and available

### Testing Strategy

- **Manual testing required** (no unit tests for UI animations at this time):
  1. Open extension in popup mode → trigger a signing request → verify spinner overlay appears and is visible
  2. Open extension in side panel mode → trigger a signing request → verify spinner overlay appears and is visible
  3. Click "Reject" in popup mode → verify button shows spinner + "Rejecting..." text before closing
  4. Click "Reject" in side panel mode → verify button shows spinner + "Rejecting..." text before closing
  5. Test multi-subtask flow (TaskDetail) for both approve and reject paths
  6. Verify no double-click during overlay states
  7. Verify no regressions in existing timeout behavior (20s fallback)

### Notes

- **High-risk**: The `onSign` timing change (Task 3). If the delay is too long, users may perceive the app as slow. 800ms is a compromise between perceptibility and speed.
- **Known limitation**: Rejection feedback is button-level (not full overlay). This is intentional per the weight-matched feedback design, but may feel inconsistent if users expect uniform treatment.
- **Future consideration**: If the codebase later adds a `usePopupType()`-aware overlay manager, the `fixed` positioning could be replaced with a proper portal.
- **Pre-mortem finding verified**: The primary blocker was `onSign` immediately closing the window before React could render the overlay. Fixing the timing is the key change.

_Advanced Elicitation applied: Pre-mortem Analysis, Critique and Refine, Red Team vs Blue Team, First Principles Analysis, Cross-Functional War Room_

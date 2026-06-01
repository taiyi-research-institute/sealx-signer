---
title: 'SDK Panel Close Event Forwarding'
slug: 'sdk-panel-close-event'
created: '2026-05-22'
status: 'in-progress'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['TypeScript', 'Chrome Extension (Manifest V3)', 'sealx-sdk', 'sealx-message', 'ContentMessager', 'WindowMessager']
files_to_modify:
  - 'extension/src/entries/background/panel-manager.ts'
  - 'extension/src/entries/content/index.tsx'
  - 'packages/sealx-sdk/src/index.ts'
  - 'packages/sealx-message/src/index.ts'
code_patterns: ['chrome.runtime.sendMessage', 'window.postMessage relay', 'chrome.storage.session broadcast', 'SealxTopic enum', 'messager.on() in SDK', 'dual-channel delivery (tabs + storage)']
test_patterns: ['Manual: open side panel → close → frontend callback fires', 'Manual: React useEffect cleanup test']
---

# Tech-Spec: SDK Panel Close Event Forwarding

**Created:** 2026-05-22

## Overview

### Problem Statement

When the SealX extension side panel closes, the web application has no way to know. There's no event or callback that frontend code can listen to. This means the web app can't update its UI (e.g., hide a "signing in progress" indicator, re-enable buttons, show a notification that the panel was closed).

### Solution

Forward the existing `panel-closing` event through the extension's message pipeline (background → content script → inpage script) and expose a clean event listener API in the SDK so frontend developers can register close handlers.

### Scope

**In Scope:**
- Background: forward `panel-closing` event to content script on the originating tab
- Content script: relay the event to the inpage script (SDK)
- SDK: add `onPanelClose(callback)` API that frontend can call to register handlers
- SDK: add `offPanelClose(callback)` API to deregister handlers
- Document the API

**Out of Scope:**
- Adding close reason or metadata (future enhancement)
- popup mode panel closing (already handled differently)
- Changing the panel closing detection mechanism

## Context for Development

### Codebase Patterns

| Component | Pattern | Key Detail |
|-----------|---------|------------|
| App.tsx → background | `chrome.runtime.sendMessage({ type: 'panel-closing', route })` | Sends on `beforeunload`/`pagehide` |
| Background handler | `notifyPanelClosing()` | Updates `isPanelOpen`, `processingTabId` |
| Background → content | `chrome.tabs.sendMessage(tabId, { type: '...' })` | Standard pattern used for other messages |
| Content → inpage | `window.postMessage({ type: '...' }, '*')` | Existing pattern, e.g., for element updates |
| SDK event system | `messager.on(SealxTopic.X, handler)` | Used for CHECK_INITIALIZED, SIGN, etc. |
| SealxTopic enum | `packages/sealx-message/src/index.ts` | Define new topic for panel close |

### Files to Reference

| File | Purpose | Key Sections |
| ---- | ------- | ------------ |
| `extension/src/entries/popup/App.tsx` | Sends `panel-closing` on unload | Lines 101-115 |
| `extension/src/entries/background/panel-manager.ts` | Handles panel close, has `processingTabId` | `notifyPanelClosing()`, `processingTabId` |
| `extension/src/entries/content/index.tsx` | Relays messages from background to inpage | `window.postMessage` pattern, element update handler |
| `packages/sealx-sdk/src/index.ts` | SDK entry point, event registration | `messager.on()` pattern, `SEALX_ACTION_ATTR` |
| `packages/sealx-message/src/index.ts` | Message topics and channel types | `SealxTopic` enum, `MessageChannel` |

### Technical Decisions

1. **Use existing `processingTabId` to route the close event**
   - Why: Background already tracks which tab triggered the panel. When the panel closes, send the event back to that tab via `chrome.tabs.sendMessage`.
   - Fallback: If `processingTabId` is null (panel opened via extension icon), broadcast to all tabs.

2. **Use `postMessage` from content script to inpage script**
   - Why: Existing pattern. Content script already uses `window.postMessage` to communicate with the inpage SDK. Consistent approach.

3. **Add `PANEL_CLOSE` topic to SealxTopic enum**
   - Why: Follows existing convention. All inter-component messages use SealxTopic for type safety.

4. **SDK API: `onPanelClose(callback)` / `offPanelClose(callback)`**
   - Why: Simple pub/sub pattern. Frontend devs call `onPanelClose(() => { ... })` to register, get a cleanup function back.

5. **No route/reason metadata in v1**
   - Why: Keep it simple. Just signal "panel closed". Metadata can be added later without breaking the API.

## Implementation Plan

### Tasks

- [ ] **Task 1: Add PANEL_CLOSE to SealxTopic enum**
  - File: `packages/sealx-message/src/index.ts`
  - Action: Add `PANEL_CLOSE = 'sealx-panel-close'` to `SealxTopic` enum

- [ ] **Task 2: Forward panel-closing from background to content script (dual-channel)**
  - File: `extension/src/entries/background/panel-manager.ts`
  - Action: In `notifyPanelClosing()`, deliver via two channels:
    a) `chrome.tabs.sendMessage(tabId, { type: SealxTopic.PANEL_CLOSE })` if `processingTabId` is set
    b) `chrome.storage.session.set({ sealxPanelClose: Date.now() })` as fallback broadcast
  - Notes: Don't block — use `.catch(() => {})`. Storage timestamp enables SDK-side dedup.

- [ ] **Task 3: Relay close event from content script to inpage via messager**
  - File: `extension/src/entries/content/index.tsx`
  - Action:
    1. Listen for `SealxTopic.PANEL_CLOSE` via `chrome.runtime.onMessage`
    2. Listen for `sealxPanelClose` via `chrome.storage.onChanged`
    3. On either channel, forward via existing inpage postMessage relay using messager protocol
    4. Deduplicate: track last forwarded timestamp, skip if within 2s
  - Notes: Use `window.postMessage({ type: 'sealx-panel-close' }, window.location.origin)` with origin restriction.

- [ ] **Task 4: Add onPanelClose API to SDK**
  - File: `packages/sealx-sdk/src/index.ts`
  - Action:
    1. Maintain `Set<() => void>` of registered callbacks (dedup via Set)
    2. `onPanelClose(callback): () => void` — register callback, return cleanup function
    3. Internally use `messager.on(SealxTopic.PANEL_CLOSE, () => { /* fire all callbacks */ })` 
    4. Validate: only fire if SDK initialized; discard stale storage timestamps
    5. Export `onPanelClose` as part of SDK public API
  - Notes: Return cleanup for React `useEffect(() => sealxPanel.onPanelClose(cb), [])` pattern. Fire callbacks with no arguments (v1).

### Acceptance Criteria

- [ ] **AC 1**: Given the side panel is open in a web page, when the user closes the panel, then the web page receives `sealx-panel-close` event within 500ms
- [ ] **AC 2**: Given the SDK is initialized, when `sealxPanel.onClose(callback)` is called, then the callback is invoked when the panel closes
- [ ] **AC 3**: Given a callback is registered via `sealxPanel.onClose(callback)`, when `sealxPanel.offClose(callback)` is called, then the callback is NOT invoked when the panel closes
- [ ] **AC 4**: Given `onPanelClose` returns a cleanup function, when the cleanup function is called, then the callback is deregistered
- [ ] **AC 5**: Given the panel closes, when the callback fires, then it receives no arguments (v1 — no metadata)
- [ ] **AC 6**: Given the SDK receives a non-panel-close message or a stale storage timestamp, then no callbacks are invoked (dedup + origin validation)

## Additional Context

### Dependencies

- No new npm packages
- No new Chrome permissions needed
- Uses existing `tabs` permission for `sendMessage`

### Testing Strategy

- **Manual testing:**
  1. Load a web page with the SDK
  2. Register `onPanelClose(() => console.log('Panel closed!'))`
  3. Open the side panel (via SealX button or extension icon)
  4. Close the side panel (click X or navigate away)
  5. Verify the callback fires with the console.log
  6. Test cleanup: register, then deregister, close panel, verify callback does NOT fire

### Notes

- The `beforeunload`/`pagehide` event in App.tsx fires when the side panel's HTML page is unloaded. This covers both user clicking X and browser closing.
- `processingTabId` might be null if panel opened via `openPanelOnActionClick` — need fallback broadcast.
- Content script may already be unloaded by the time the close event fires — use `.catch(() => {})` to handle this gracefully.

### Pre-mortem Risk Mitigations

1. **`processingTabId` null guard**: When `notifyPanelClosing()` is called and `processingTabId` is null (panel opened via extension icon), broadcast via `chrome.storage.session` instead of `chrome.tabs.sendMessage`. The content script subscribes to `storage.onChanged` for the close event.

2. **Dual-channel event delivery**: Primary: `chrome.tabs.sendMessage({ sealx-panel-close })`. Fallback: `chrome.storage.session.set({ sealxPanelClose: Date.now() })`. Content script listens to both channels, delivers whichever fires first — deduplicates subsequent deliveries.

3. **postMessage origin restriction**: Content script uses `window.postMessage({ type: 'sealx-panel-close' }, window.location.origin)` instead of `'*'`. SDK validates `event.source === window && event.origin === window.location.origin`.

4. **SDK defensive initialization**: `onPanelClose()` checks if SDK is initialized. If not, queues handlers and replays on init. Returns a no-op cleanup function if not ready.

5. **API contract**: `onPanelClose(callback)` returns a cleanup function `() => void`. Documentation shows React `useEffect(() => sealxPanel.onPanelClose(cb), [])` pattern prominently.

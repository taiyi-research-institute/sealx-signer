---
title: 'Fix Side Panel Gesture Context for SDK-Triggered Panel Opening'
slug: 'fix-side-panel-gesture-context'
created: '2026-05-09'
updated: '2026-05-09'
status: 'implementation-complete'
stepsCompleted: [1, 2, 3, 4, 5, 6]
# Note: Revised after Adversarial Review — all 14 findings fixed
tech_stack:
  - TypeScript
  - Chrome Extension MV3
  - React
  - Zustand (with persist)
files_to_modify:
  - packages/sealx-sdk/src/index.ts
  - extension/src/entries/content/index.tsx
  - extension/src/entries/web/main.tsx
  - extension/src/entries/background/index.ts
  - extension/src/entries/background/panel-manager.ts
  - extension/src/providers/RequestContextProvider.tsx
code_patterns:
  - Native DOM event → transient activation → chrome.runtime.sendMessage → sidePanel.open()
  - Zustand persist store as sync bridge between background ↔ panel
  - Panel self-routes from stored request (RequestContextProvider.initializeApplication)
  - Signal flag pattern: setAttribute/removeAttribute on documentElement for cross-world communication
test_patterns:
  - Manual: Chrome 120+ verify sidePanel.open succeeds via click
  - Manual: Chrome < 120 verify badge fallback
  - Manual: multi-tab concurrent signing
---

# Tech-Spec: Fix Side Panel Gesture Context for SDK-Triggered Panel Opening

**Created:** 2026-05-09
**Updated:** 2026-05-09 (revised after adversarial review — all 14 findings addressed)

## Overview

### Problem Statement

SDK 从用户按钮点击调用 `signBySealx` / `connectSealx` / `bindSealx` 时，需要打开 Chrome Side Panel。当前代码通过 `document.dispatchEvent(new Event('sealx-gesture-relay'))` 合成事件尝试传递手势上下文给 content script，但存在两个致命问题：

1. **合成事件不生成 transient activation（用户手势标记）**，导致 `chrome.runtime.sendMessage` 传到 service worker 后，`chrome.sidePanel.open()` 抛出 `"must be called in response to a user gesture"` 错误。
2. **`web/main.tsx` 是独立的 HTML page entry**，永远不会注入到用户页面中执行。`document.addEventListener('sealx-gesture-relay')` 从未在用户页面上下文注册——gesture relay 机制从未真正工作过。

### Solution

**核心思路：用原生 click 事件的冒泡阶段替代合成事件，在真正的 transient activation 窗口内发送消息。**

Content script 只负责发送 `open-side-panel` 信号（不带 route）。Panel 打开后，`RequestContextProvider.initializeApplication()` 从 `useRequestStore` 读取已缓存的 request，通过 `routeByRequest()` 自动确定路由——**route 由 panel 自己决定，不走消息传递**。

#### SIGN / BIND_PK 流程

```
用户点击按钮
  │
  ├─ SDK: setAttribute('data-sealx-action', '1')          ← sync, 只设信号标志
  ├─ SDK: setTimeout 30s fallback cleanup                  ← 兜底
  ├─ SDK: messager.send(data, SIGN, POPUP)               ← async
  │       → Background onForward: store request in useRequestStore
  │         (no openPanel, no waitForReady — panel self-routes)
  │
  └─ click 冒泡到 document ← 同一个 tick，transient activation 还在
        └─ content script 原生 click listener
              ├─ 读 data-sealx-action = '1'
              ├─ removeAttribute
              ├─ setTimeout 30s fallback cleanup
              └─ sendMessage({type:'open-side-panel'})    ← 不带 route
                    │
                    ↓ Background
                    sidePanel.open({tabId})  ← ✅ 有 transient activation
                    │
                    ↓ Panel 加载 → panel-ready → resolveReadyWaiters(true)
                    RequestContextProvider.initializeApplication():
                      await rehydrate() → poll 3×100ms → 读 store request
                      → routeByRequest(request) → navigate
                      → 处理签名 / 绑定
```

#### CONNECT 流程（与 SIGN/BIND_PK 不同：需要双向通信）

```
用户点击按钮
  │
  ├─ SDK: setAttribute('data-sealx-action', '1')          ← sync
  ├─ SDK: messager.send(data, CONNECT, BACKGROUND)       ← async
  │       → Background messager.on(CONNECT):
  │           ├─ setRequest(request) → store
  │           ├─ waitForReady(5_000)    ← 等待 panel-ready（但 panel 已在加载）
  │           └─ messager.send(CONNECT, POPUP) → await reply
  │
  └─ click 冒泡 → content script → open-side-panel
        → sidePanel.open → Panel 加载 → self-route to /login
          → process CONNECT → reply with session → SDK receives reply
```

**关键差异**: CONNECT handler 保留 `waitForReady()` 因为 `messager.send(CONNECT, POPUP)` 需要面板就绪才能双向通信。SIGN/BIND_PK 通过 `onForward` 单向转发，无需等待。

### Adversarial Review Fixes Summary

14 项对抗性审查发现已全部修复：

| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| F1 | CONNECT handler 也调用了 `openPanel`/`waitForReady` | Critical | 移除 `openPanel`，保留 `waitForReady`（CONNECT 需要双向通信） |
| F2 | Store 写入-读取竞态（chrome.storage.local 异步） | Critical | panel 侧 `await rehydrate()` + 3 次轮询（100ms 间隔） |
| F3 | `getTargetRoute(CONNECT)` 始终返回 `null` | Critical | session 无效时返回 `'/login'` |
| F4 | Forward handler 中 route 变量和 switch 成为 dead code | High | 移除 route 变量、switch、openPanel、waitForReady |
| F5 | `.catch(() => {})` 静默吞错误 | High | catch 中 log warn + 恢复 flag 供重试 |
| F6 | Stale flag（SDK 设 flag 但 content script 未消费） | High | SDK 30s timeout + content script 30s timeout 双保险 |
| F7 | 异步/debounce 包裹 SDK 调用的局限性 | High | 文档标注（SDK 文档建议不要 debounce） |
| F8 | `notifyPanelClosing` 未 resolve pending waitForReady callers | High | 添加 `resolveReadyWaiters(false)` |
| F9 | `panel-closing` 中 `_sender.tab?.id` 为 undefined | High | 新增 `clearCurrentProcessingQueue()` 通过 `processingTabId` |
| F10 | CONNECT: messager.send 在 waitForReady 之后仍需等待 | Medium | 保留 waitForReady（见 F1），此为 by-design 行为 |
| F11 | `open-side-panel` handler catch 硬编码路径 | Medium | 使用 `PanelManager.panelPath` 常量 |
| F12 | Spec 中用行号引用代码（容易过时） | Medium | 全部替换为函数名/代码块标识 |
| F13 | SDK 侧 flag 没有兜底清理 | Medium | 三处 SDK 函数均添加 30s `setTimeout` fallback cleanup |
| F14 | 扩展更新过渡期行为不确定 | Low | 文档标注 limitation |

### Scope

**In Scope:**
- SDK: `dispatchEvent` → `setAttribute('data-sealx-action', '1')`（只传信号），加 30s timeout 兜底清理
- Content script: 原生 click 监听移到 `content/index.tsx`；只读 flag 不读 route；sendMessage 失败时恢复 flag 重试
- `web/main.tsx`: 移除死代码 `sealx-gesture-relay` listener（从未注入用户页面，从不存在实际功能）
- Background: `open-side-panel` handler 简化为只调 `sidePanel.open()`；catch 中用 `PanelManager.panelPath`
- Background: CONNECT handler 移除 `openPanel()`，保留 `waitForReady()`
- Background: forward handler 移除 `openPanel()` + `waitForReady()` 调用和 route 变量
- Background: `panel-closing` handler 同步 `isPanelOpen = false`，正确清除队列
- PanelManager: 新增 `notifyPanelClosing()`（含 `resolveReadyWaiters(false)`）+ `clearCurrentProcessingQueue()`
- RequestContextProvider: store rehydrate + 轮询（F2），`getTargetRoute(CONNECT)` → `'/login'`（F3）
- Chrome < 120 降级：catch user gesture error → badge fallback

**Out of Scope:**
- Messager 桥接系统改动
- SDK 公开 API 变更
- `chrome.notifications` 引入
- PanelManager 请求队列机制改动
- Panel 自路由逻辑（`RequestContextProvider.initializeApplication` + `routeByRequest`）核心逻辑不变

## Context for Development

### Codebase Patterns

- **Zustand persist store as bridge**: `useRequestStore` 有 `persist.name: 'request'`，通过 `chrome.storage.local` 同步 background ↔ panel。Background 写 `setRequest(request)`，Panel 的 `RequestContextProvider.init` 自动读、绑定 reply、清除缓存。
- **Panel self-routing**: `RequestContextProvider.initializeApplication()` 读取 store request 后调 `routeByRequest(request)`，根据 `request.topic` 决定路由（`SIGN/BATCH_SIGN` → `task-home`，`BIND_PK` → `bind-pubkey`，`CONNECT` → `login`）。**route 不需要从消息传递。**
- **Panel heartbeat**: Panel 每 3s 发 `panel-heartbeat`，每 load 发一次 `panel-ready`。Background 的 `PanelManager` 用 `lastHeartbeatAt` 判断 panel 是否存活（15s 超时）。
- **Signal flag**: SDK 在 `await messager.send()` 之前同步设 `document.documentElement.setAttribute('data-sealx-action', '1')`。Content script 在原生 click 冒泡阶段检查此 flag 决定是否发送 `open-side-panel`。
- **CONNECT 与 SIGN/BIND_PK 流分离**: CONNECT 通过 `messager.on(CONNECT)` → `messager.send(CONNECT, POPUP)` 双向通信；SIGN/BIND_PK 通过 `messager.onForward(POPUP)` 单向转发。两者需要不同的 background 处理。
- **Main world vs Isolated world 通信**: SDK（main world JS）和 content script（isolated world）不能共享 JS 对象，通过 DOM 属性（`data-sealx-action`）和消息传递（`chrome.runtime.sendMessage`）通信。

### Files to Modify

| File | Purpose | Change Type |
|------|---------|-------------|
| `packages/sealx-sdk/src/index.ts` | SDK entry: connectSealx/signBySealx/bindSealx | `dispatchEvent` → `setAttribute('data-sealx-action', '1')` + 30s fallback (F13) |
| `extension/src/entries/content/index.tsx` | Content script (唯一注入用户页面的脚本) | 添加原生 click listener + flag restore on failure (F5, F6) |
| `extension/src/entries/web/main.tsx` | Web entry page (独立 HTML) | 移除死代码 `sealx-gesture-relay` listener |
| `extension/src/entries/background/index.ts` | Background handlers | 简化 open-side-panel (F11), 删 CONNECT openPanel (F1), 删 forward dead code (F4), 修复 panel-closing (F9) |
| `extension/src/entries/background/panel-manager.ts` | Panel lifecycle manager | 新增 `notifyPanelClosing()` + `resolveReadyWaiters` (F8) + `clearCurrentProcessingQueue()` (F9) |
| `extension/src/providers/RequestContextProvider.tsx` | Panel 自路由 | store rehydrate + polling (F2), getTargetRoute(CONNECT) → '/login' (F3) |

### Technical Decisions

1. **Why not pass route in message?** — Panel 的 `RequestContextProvider.initializeApplication()` 已经从 store 读取缓存的 request 并调用 `routeByRequest()` 自动路由。后台传 route 是冗余的，且有 `setOptions` 竞态风险。**Panel 自己决定路由——单一数据源。**

2. **Why `data-sealx-action` instead of `data-sealx-route`?** — Action 只是一个布尔信号（content script 只需知道"这是 SealX 触发的点击"），不需要知道具体是什么操作。route 由 panel 的 `routeByRequest` 决定。

3. **Why delete `PanelManager.openPanel()` from forward handler?** — Panel 的 `RequestContextProvider` 在加载时从 `useRequestStore` 读取缓存请求。不需要 forward handler 等待 panel 就绪才转发——store 已经存好了，panel 自己会来取。

4. **Why `panel-closing` sets `isPanelOpen = false`?** — 当前靠 15s 心跳超时兜底，太慢。Panel 的 `beforeunload` 已经发 `panel-closing` 消息，background handler 收到后直接设 `isPanelOpen = false`，无延迟。同时 resolve 所有 pending `waitForReady()` caller。

5. **Chrome < 120 fallback** — 错误消息包含 `"user gesture"`。catch 后 `setBadge('!')`。`openPanelOnActionClick: true` 已配置，用户点击扩展图标即打开 panel，panel 加载后从 store 恢复 request 并自路由。

6. **Chrome 120-121 边界** — transient activation 传递在 120-121 早期版本可能存在不稳定。fallback 逻辑对所有 `sidePanel.open()` 错误统一处理。

7. **Why keep `waitForReady` in CONNECT handler?** — CONNECT 需要双向通信（`messager.send(CONNECT, POPUP)` 等待 panel reply），panel 必须先就绪才能接收消息。SIGN/BIND_PK 通过 `onForward` 单向转发，不需要等待。

### Known Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **click 冒泡被 `stopPropagation` 阻断** | Medium | 页面按钮 click handler 是 SDK 代码，SDK 不调用 stopPropagation。如第三方框架阻断，可在 content script 加 `{capture: true}` 作为备选。 |
| **Shadow DOM 内事件不冒泡到 document** | Low | 如果业务页面在 Shadow DOM 里渲染按钮且 `composed: false`，click 不穿透。标注 limitation。 |
| **Store 写入-读取时间窗口竞争** | Medium | **【FIXED】** `initializeApplication` 先 `await rehydrate()` 确保 store 已从 `chrome.storage.local` 回灌，再轮询 3 次（100ms 间隔）读取 request。 |
| **Request 残留（Stale Request）** | Medium | Panel 关闭时 `beforeunload` 发 `panel-closing`，background handler 调 `clearRequest()`。SDK flag 有 30s timeout 兜底清理。 |
| **Service Worker 重启后状态丢失** | Low | SW 被系统终结后重启，内存状态清零。心跳机制 15s 超时自动校正 `isPanelOpen`。 |
| **连续快速点击竞态** | Low | 两次 click 各自设 flag、各自发消息。store 中 request 可能被第二次覆盖，panel 只处理最新请求——符合预期。 |
| **Stale flag 残留** | Medium | **【FIXED】** SDK 侧 30s timeout 清除；content script 在每次 click 都检查并移除 flag。sendMessage 失败时恢复 flag 供重试。 |
| **`panel-closing` sender.tab 为 undefined** | Medium | **【FIXED】** 新增 `clearCurrentProcessingQueue()` 通过 `processingTabId` 清除队列。sendMessage 无法返回 sender.tab 时走此路径。 |
| **Store 未 hydrated 即读取** | Medium | **【FIXED】** `initializeApplication()` 先检查 `useRequestStore.persist.hasHydrated()`，未完成则 `await rehydrate()`。 |

## Implementation Plan

### Task 0: web/main.tsx — 移除死代码 sealx-gesture-relay

**File:** `extension/src/entries/web/main.tsx`

**Background:** `web/main.tsx` 是独立的 HTML page entry（`src/entries/web/index.html`），由 `@crxjs/vite-plugin` 自动检测并单独构建。它不是 content script，**永远不会注入到用户页面中执行**。其中的 `sealx-gesture-relay` 监听器从未在任何用户页面注册，是死代码。

**Action:** 删除 `document.addEventListener('sealx-gesture-relay', ...)` 整个监听器块：

```diff
-// 监听 SDK 派发的同步手势事件，保持用户手势上下文到 background
-document.addEventListener('sealx-gesture-relay', () => {
-    const route = document.documentElement.getAttribute('data-sealx-route') || ''
-    document.documentElement.removeAttribute('data-sealx-route')
-    chrome.runtime.sendMessage({ type: 'open-side-panel', route })
-})
-
```

### Task 1: SDK — dispatchEvent → signal flag + timeout cleanup

**File:** `packages/sealx-sdk/src/index.ts`

3 处改动，位于 `connectSealx`、`bindSealx`、`signBySealx` 三个函数的 try 块起始处：

| 函数 | 旧代码 | 新代码 |
|------|--------|--------|
| `connectSealx()` | `setAttribute('data-sealx-route', 'login')` + `dispatchEvent(new Event('sealx-gesture-relay'))` | `setAttribute('data-sealx-action', '1')` + `setTimeout(() => removeAttribute('data-sealx-action'), 30_000)` |
| `bindSealx()` | `setAttribute('data-sealx-route', 'bind-pubkey')` + `dispatchEvent(new Event('sealx-gesture-relay'))` | 同上 |
| `signBySealx()` | `setAttribute('data-sealx-route', 'task-home')` + `dispatchEvent(new Event('sealx-gesture-relay'))` | 同上 |

**删除对应的 `setAttribute('data-sealx-route', ...)` 调用**——不再需要传 route。

**F13 兜底**: 30s timeout 确保 flag 不会永久残留。正常情况下 content script 在同一次 click 冒泡阶段消费 flag（毫秒级），timeout 永远不会触发。此 timeout 仅处理极端边缘情况（如浏览器挂起后恢复时 flag 未清理）。

### Task 2: Content Script — 原生 click 监听 + 错误恢复

**Critical Finding:** 原 `web/main.tsx` 是独立 HTML page entry，**永远不会注入到用户页面中执行**。正确位置是 `content/index.tsx`——manifest 中唯一配置的 content script（`run_at: "document_start"`, `all_frames: true`）。

**File:** `extension/src/entries/content/index.tsx`

在 `waitForBody(initializeSealX)` 之前添加（模块顶层执行，无需等待 DOM ready——但事件冒泡需要 DOM 存在，click 本身即是 DOM 存在时的用户交互）：

```typescript
// ===== 手势中继：原生 click → transient activation 传递 =====
// SDK 在按钮点击时同步设置 data-sealx-action 属性。
// Content script 在 click 冒泡阶段检查此 flag，在 transient activation 窗口内
// 发送 open-side-panel 消息给 background → sidePanel.open() 成功。
// 只发信号不传 route — panel 从 useRequestStore 自路由。
document.addEventListener('click', () => {
    const action = document.documentElement.getAttribute('data-sealx-action')
    if (!action) return

    // 清除 flag，防止后续无关 click 误触发
    document.documentElement.removeAttribute('data-sealx-action')

    // F6: 延迟清理 — 30s 后兜底清除可能残留的 flag
    setTimeout(() => {
        document.documentElement.removeAttribute('data-sealx-action')
    }, 30_000)

    chrome.runtime.sendMessage({ type: 'open-side-panel' }).catch((err) => {
        // F5: sendMessage 失败时恢复 flag，允许用户再次点击重试
        console.warn('[SealX] Failed to send open-side-panel:', err?.message)
        document.documentElement.setAttribute('data-sealx-action', '1')
    })
})
```

### Task 3: Background — 简化 open-side-panel handler

**File:** `extension/src/entries/background/index.ts` — `chrome.runtime.onMessage.addListener` 内 `open-side-panel` 分支

简化后（不再读 route、不设 setOptions 中的 path、catch 中引用常量）：

```typescript
if (message?.type === 'open-side-panel') {
    const tabId = _sender.tab?.id
    if (tabId) {
        chrome.sidePanel.open({ tabId }).then(() => {
            PanelManager.notifyPanelOpened('')
        }).catch((err: Error) => {
            console.warn('open-side-panel: sidePanel.open failed', err.message)
            PanelManager.setBadge()
            // Ensure default path + enabled (use constant, not hardcoded)
            chrome.sidePanel.setOptions({
                path: PanelManager.panelPath,
                enabled: true
            })
        })
    }
    return true
}
```

**变化：**
- 不再读 `message.route`
- 不再 `setOptions({path: fullPath})`（默认 path 已在 `PanelManager.init()` 中设好）
- catch 中只做 badge 降级，使用 `PanelManager.panelPath` 常量（**F11**）
- `notifyPanelOpened('')` — route 为空，panel 自己从 store 恢复

### Task 4: Background — CONNECT handler 移除 openPanel，保留 waitForReady

**File:** `extension/src/entries/background/index.ts` — `messager.on(SealxTopic.CONNECT, ...)` handler

**F1 修复**: CONNECT handler 中移除 `PanelManager.openPanel('login', request.header.tabId)`，但**保留 `waitForReady()`**——因为 CONNECT 需要 `messager.send(CONNECT, POPUP)` 双向通信等待 panel reply，panel 必须先就绪。

```typescript
messager.on(SealxTopic.CONNECT, async (request) => {
    // ... session check ...
    state.setSession(null)
    const setRequest = useRequestStore.getState().setRequest
    setRequest(request)
    // Panel opens via gesture channel (content script click listener),
    // not via openPanel(). Store the request for panel self-routing.

    // 等待面板就绪（gesture channel 触发 sidePanel.open 后 panel 加载→发送 panel-ready）
    const ready = await PanelManager.waitForReady(5_000)
    if (!ready) {
        console.warn('Panel did not become ready within timeout, attempting communication anyway')
    }

    try {
        // ... messager.send(CONNECT, POPUP) unchanged ...
    }
})
```

### Task 5: Background — onForward(POPUP) 移除 dead code

**File:** `extension/src/entries/background/index.ts` — `messager.onForward(MessageChannel.POPUP, ...)` handler

**F4 修复**: 移除 dead route 变量、switch 语句、`openPanel()` 和 `waitForReady()` 调用。Panel 通过 gesture channel + store self-routing 自动处理。

```typescript
messager.onForward(MessageChannel.POPUP, async (request: SealxRequest) => {
    // ... tabId/uid/host setup unchanged ...
    const setRequest = useRequestStore.getState().setRequest
    setRequest(request)
    // Store request in persist store — panel self-routes from store on load.
    // Panel opens via gesture channel (content script click listener).
    // Forward the message to panel via bridge (no-op if panel not loaded).
})
```

### Task 6: Background — panel-closing 修复

**File:** `extension/src/entries/background/index.ts` — `chrome.runtime.onMessage.addListener` 内 `panel-closing` 分支

**F9 修复**: Side Panel 中 `_sender.tab` 为 undefined，`_sender.tab?.id` 返回 null。新增 `clearCurrentProcessingQueue()` 作为 fallback。添加 `notifyPanelClosing()` 调用（**F8**）。

```typescript
if (message?.type === 'panel-closing') {
    const tabId = _sender.tab?.id ?? null
    if (tabId) {
        PanelManager.clearQueueForTab(tabId)
    } else {
        PanelManager.clearCurrentProcessingQueue()  // F9: side panel sender.tab is undefined
    }
    PanelManager.notifyPanelClosing()      // F8: sync isPanelOpen + resolve waiters
    useRequestStore.getState().clearRequest()
    return true
}
```

### Task 7: PanelManager — 新增 notifyPanelClosing + clearCurrentProcessingQueue

**File:** `extension/src/entries/background/panel-manager.ts`

在 `Close Panel` 区域添加两个新方法：

```typescript
/**
 * Panel closed by user — immediately sync state (faster than heartbeat timeout).
 * Called from background's panel-closing handler.
 * Resolves all pending waitForReady() callers with false.
 */
static notifyPanelClosing(): void {
    // F8: resolve any pending waitForReady() callers with false
    // (panel closed while someone was waiting for it to be ready)
    this.resolveReadyWaiters(false)
    this.isPanelOpen = false
    this.processingTabId = null
    this.isProcessing = false
}

/**
 * Clear the queue entry for the currently processing tab.
 * Used by panel-closing handler where sender.tab is undefined for side panels,
 * so clearQueueForTab(sender.tab.id) wouldn't work.
 */
static clearCurrentProcessingQueue(): void {
    if (this.processingTabId) {
        this.clearQueueForTab(this.processingTabId)
    }
}
```

### Task 8: RequestContextProvider — store polling + CONNECT routing

**File:** `extension/src/providers/RequestContextProvider.tsx`

**F2 修复** — `initializeApplication()` 中在读取 `useRequestStore` 之前先 rehydrate + 轮询（3 次 × 100ms），确保 `chrome.storage.local` 异步同步的 request 数据不会被遗漏。

**F3 修复** — `getTargetRoute()` 中 CONNECT 分支：当 session 无效时返回 `'/login'` 而不是 `null`，确保用户能够路由到登录页面。

详见代码中的 `// F2:` 和 `// F3:` 注释块。

## Acceptance Criteria

| ID | Given | When | Then |
|----|-------|------|------|
| AC-1 | Chrome ≥ 120, panel closed | SDK `signBySealx()` click 调用 | sidePanel 打开，从 store 读取 SIGN request，路由到 task-home，签名请求显示 |
| AC-2 | Chrome ≥ 120, panel closed | SDK `connectSealx()` click 调用 | sidePanel 打开，从 store 读取 CONNECT request，路由到 login |
| AC-3 | Chrome ≥ 120, panel closed | SDK `bindSealx()` click 调用 | sidePanel 打开，从 store 读取 BIND_PK request，路由到 bind-pubkey |
| AC-4 | Chrome < 120, panel closed | SDK 任意调用 | `sidePanel.open()` 抛 user gesture error → badge '!' → 用户点扩展图标 → panel 自路由 |
| AC-5 | Panel 已打开 | SDK `signBySealx()` click 调用 | Panel 不重新加载，当前 route 上显示签名请求 |
| AC-6 | Panel 被用户关闭 | 关闭 panel | `beforeunload` → `panel-closing` → `isPanelOpen = false`，pending waitForReady callers resolve(false) |
| AC-7 | 无关 click | 用户点击任意按钮 | `data-sealx-action` 为空，content script 不发送任何消息 |
| AC-8 | sendMessage 失败 | content script catch | flag 恢复 → 用户可再次点击重试 |

## Testing Strategy

| 测试 | 方法 | 关键验证点 |
|------|------|-----------|
| Gesture 传递 | click 页面按钮 → panel 打开 | transient activation 传递成功 |
| Panel 自路由 | sign → task-home; connect → login | routeByRequest 正确 |
| Multi-tab | Tab A sign → 处理完 → Tab B sign | 队列不阻塞，各自正确 |
| Chrome < 120 | Mock throw user gesture error | badge 降级生效 |
| Panel close | 关闭 panel → 立刻再触发 | isPanelOpen 同步正确 |
| Store recovery | Panel 打开时读取 request（含 rehydrate + polling） | 数据正确，无竞态 |
| Flag recovery | Mock sendMessage 失败 | flag 恢复 + 用户可重试 |
| CONNECT routing | session 无效时 connect | panel 路由到 /login（F3） |
| Queue clearing | panel-closing with _sender.tab undefined | clearCurrentProcessingQueue 生效（F9） |
| Flag timeout | 等待 30s 不触发 click | flag 自动清除（F13） |

## Additional Context

### Dependencies

- Chrome 120+（transient activation 通过 sendMessage 传递至 service worker）
- Zustand persist（`chrome.storage.local` 序列化——已有）
- No new npm dependencies

### Notes

- Forward handler 的 `BackgroundMessager.postMessage()` 在 panel 未加载时会静默失败，不影响主流程。Panel 通过 store 恢复 request。
- SDK 的 `messager.send()` promise 在 panel reply 之前一直 pending。Panel 不打开则无 reply——但这是现有行为，不在 scope。
- **Limitation: debounce/throttle 包裹 SDK 调用（F7）** — 业务方如果对 `signBySealx()` 做了 debounce，调用时原始 click macrotask 已结束，`data-sealx-action` flag 在同一个 click tick 内已被消费（content script 的 click listener 在同一事件冒泡阶段已 fire 并 removeAttribute）。debounced 调用会导致 flag 设置和 click propagation 分离——flag 在下一个无关 click 时可能被误读。**建议 SDK 文档明确标注不要 debounce/throttle 包裹 SDK 调用。**
- **Limitation: Shadow DOM `composed: false`** — 极少见。如果业务方 Shadow DOM 设 `composed: false`，click 不冒泡到主 document，content script listener 不触发。
- **Limitation: 扩展更新过渡期（F14）** — 扩展自动更新时，content script 使用新版本代码，service worker 可能仍运行旧版本（或反之）。`open-side-panel` 消息类型和 `data-sealx-action` flag 在前后版本保持一致，但更新期间可能出现短暂行为不一致。更新期间首次 click 可能失败——用户重试即可。

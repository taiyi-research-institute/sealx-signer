---
title: 'Fix Side Panel Flash — 按钮触发打开时 Loading 状态'
slug: 'fix-side-panel-flash-loading'
created: '2026-05-11'
status: 'implementation-complete'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['TypeScript', 'React', 'Chrome Extension API', 'Tailwind CSS', 'Zustand', 'sealx-message']
files_to_modify:
  - 'extension/src/entries/background/index.ts'
  - 'extension/src/entries/background/panel-manager.ts'
  - 'extension/src/providers/RequestContextProvider.tsx'
code_patterns:
  - '`chrome.sidePanel.setOptions({ path })` 在 `open()` 前设置 URL 参数 — panelPath 是 public static property (panel-manager.ts:42)'
  - '`new URLSearchParams(window.location.search).get()` 读取 URL 参数'
  - '`request.topic` 为 BIND_PK / SIGN / BATCH_SIGN 时结束 loading'
  - '`useRequestStore.getState().setRequest(request)` 持久化请求到 chrome.storage.local (request/index.ts:22)'
  - '`PanelManager.waitForReady(5_000)` 阻塞等待 panel-ready (panel-manager.ts:450)'
  - '`SealxTopic.CONNECT` / `SIGN` / `BIND_PK` / `BATCH_SIGN` 来自 sealx-message'
test_patterns: []
---

# Tech-Spec: Fix Side Panel Flash — 按钮触发打开时 Loading 状态

**Created:** 2026-05-11

## Overview

### Problem Statement

点击 DApp 页面上的 `[data-sealx-action="open"]` 按钮打开 Side Panel 时出现闪屏：Home 页面先渲染一帧，然后 `checkRoute` / `panel-navigate` 异步重定向到 sign/bind/login 页面。时序如下：

```
用户点击 → sidePanel.open(defaultPath, 无 hash)
              │
              ├── HashRouter 默认路由 '/' → Home 渲染 (用户看到!)
              │
              ├── 500ms 后 panel-ready 发出 (route='')
              │
              ├── RootLayout.checkRoute() 异步重定向 → /login 或 /initialize
              │
              └── messager 推送请求 → 导航到 sign/bind 页
```

`RequestContextProvider` 已有 `loading` 状态和 `Loading` 组件（半透明遮罩），但两个问题导致闪屏：
1. `Loading` 遮罩是半透明的（`bg-[#000]/10 backdrop-blur-sm`），Home 内容透出
2. `initializeApplication` 的 loading 在请求到达前就结束，Home 暴露后才收到请求进行二次跳转

### Solution

在后台收到 `open-side-panel` 消息时，通过 `chrome.sidePanel.setOptions({ path })` 将面板 URL 设为带 `?source=button` 参数的地址。面板端检测到 `source=button` 且为 Side Panel 模式时，显示不透明全屏 Loading，直到绑定/签名请求到达（`request.topic` 为 `BIND_PK` / `SIGN` / `BATCH_SIGN`），然后正常渲染路由。CONNECT 请求不结束 loading。

### Scope

**In Scope:**
- 后台 `open-side-panel` 处理器：`setOptions` 带 `?source=button` 参数
- `PanelManager`：面板打开后恢复默认路径
- `RequestContextProvider`：检测 `source=button` + side panel → 延长 loading 到请求到达
- `Loading` 组件：`source=button` 时全不透明白色背景

**Out of Scope:**
- popup/action/tab 模式的 loading 逻辑
- 手动点击扩展图标打开 Side Panel
- 修改路由逻辑（`checkRoute`、`routeByRequest` 保持不变）
- `App.tsx` 的 `panel-ready` 时序

## Context for Development

### Codebase Patterns

- Side Panel 模式检测：`usePopupType()` hook，`popupType === 'sidepanel'`
- URL 参数读取：`new URLSearchParams(window.location.search)`
- 请求上下文：`RequestContextProvider` 管理 `request: SealxRequest` 状态
- 请求到达信号：`request.header` 有值
- Loading 组件：`RequestContextProvider` 内置 `Loading: React.FC`，当前为半透明遮罩
- 面板管理器：`PanelManager` 类，管理 `isPanelOpen`、`panelPath`、`navigateToRoute` 等

### Files to Reference

| File | Line | Anchor Point |
| ---- | ---- | ------------ |
| `extension/src/entries/background/panel-manager.ts` | 42 | `static panelPath: string = 'src/entries/popup/index.html'` — public static，可直接改写 |
| `extension/src/entries/background/panel-manager.ts` | 98-115 | `init()` — `setOptions({ path: panelPath })` |
| `extension/src/entries/background/panel-manager.ts` | 165-222 | `openPanel(route, tabId)` — 不调用 `sidePanel.open()`，仅 setOptions + navigateToRoute |
| `extension/src/entries/background/panel-manager.ts` | 71-77 | `notifyPanelOpened(route: string)` — 设 isPanelOpen=true，resolve waiters |
| `extension/src/entries/background/panel-manager.ts` | 450-472 | `waitForReady(timeoutMs)` — 返回 `Promise<boolean>`，默认 5s 超时 |
| `extension/src/entries/background/panel-manager.ts` | 46 | `private static isPanelOpen` — private，不可外部访问 |
| `extension/src/entries/background/index.ts` | 142-159 | `open-side-panel` handler — `chrome.sidePanel.open({ tabId })`，then `notifyPanelOpened('')` |
| `extension/src/entries/background/index.ts` | 74-120 | CONNECT handler — `setRequest(request)` 写 store，`waitForReady(5_000)` 等面板 |
| `extension/src/entries/background/index.ts` | 122-138 | `messager.onForward(POPUP)` — `setRequest(request)` 写 store，面板自路由 |
| `extension/src/providers/RequestContextProvider.tsx` | 44-384 | 全文件 — loading 状态、initializeApplication、handleRequest、routeByRequest |
| `extension/src/providers/RequestContextProvider.tsx` | 248-327 | `initializeApplication` — 等 hydration → 读 useRequestStore → 路由判断 → setLoading(false) |
| `extension/src/providers/RequestContextProvider.tsx` | 194-243 | `handleRequest` — 接收 messager 消息，设 request.header，过滤 CONNECT |
| `extension/src/providers/RequestContextProvider.tsx` | 137-152 | `routeByRequest` — 根据 topic 决定目标路由并 navigate |
| `extension/src/providers/RequestContextProvider.tsx` | 386-408 | `Loading` 组件 — 当前半透明遮罩 `bg-[#000]/10` |
| `extension/src/core/state/request/index.ts` | 1-31 | `requestStore` — persisted Zustand store, `setRequest`/`clearRequest` |
| `extension/src/hooks/usePopupType.ts` | 1-130 | `usePopupType()` — 返回 `popupType`、`isSidePanel` 等

### Technical Decisions

- **Loading 结束条件**: `request.header` 有值 且 `request.topic` 为 `SealxTopic.BIND_PK` / `SealxTopic.SIGN` / `SealxTopic.BATCH_SIGN`。CONNECT 不结束 loading。加 5s 超时兜底
- **URL 参数传参**: `?source=button` 作为 signal，通过 `window.location.search` 读取
- **不透明遮罩**: `source=button` 模式下 `bg-white` 全白，不透视底层内容
- **路径恢复**: 面板打开 500ms 后用 `setOptions` 恢复默认路径（无 ?source），避免后续手动打开也进入 loading
- **已有 loading 流转**: `initializeApplication` 中 `setLoading(true)` 保持不变，仅在请求到达后才 `setLoading(false)`

## Implementation Plan

### Tasks

- [x] **Task 1: PanelManager 新增 `openPanelWithSource` 方法**
  - File: `extension/src/entries/background/panel-manager.ts`
  - Action:
    1. **先 await `chrome.sidePanel.setOptions({ path: '...index.html?source=button' })`**，确保异步生效
    2. 调用 `chrome.sidePanel.open({ tabId })`
    3. 面板已打开时仍会重新加载（Chrome 行为），无需额外判重
    4. 500ms 后用 `setOptions` 恢复默认路径（无 `?source`）
  - Notes: `setOptions` 必须在 `open()` 前 await，否则面板可能加载默认 path。方法内部 try-catch，`setOptions` 失败时回退到直接 `open()`（降级，无 loading 但不阻塞）

- [x] **Task 2: 后台 `open-side-panel` 处理器调用新方法**
  - File: `extension/src/entries/background/index.ts`
  - Action: 将 `chrome.sidePanel.open({ tabId })` 替换为 `PanelManager.openPanelWithSource(tabId)`
  - Notes: 保持 `notifyPanelOpened('')` 调用不变

- [x] **Task 3: `RequestContextProvider` 检测 `source=button` 并延长 loading**
  - File: `extension/src/providers/RequestContextProvider.tsx`
  - Action:
    1. 组件初始化时读取 `URLSearchParams(window.location.search).get('source')`，存为 `const buttonSource`
    2. **Mount 后立即 `history.replaceState({}, '', location.pathname + location.hash)` 去掉 `?source`**，防止后续刷新/切换触发 loading
    3. 引入 `usePopupType()`，放宽判断：`popupType 不为 'action'/'window'/'tab' 时视为 sidepanel 候选`（覆盖 `'unknown'` 状态）
    4. `isSidePanelCandidate && buttonSource === 'button'` → `isButtonTriggered`
    5. `isButtonTriggered` 为 true 时：`initializeApplication` 完成后不设 `loading=false`
    6. 新增 `useEffect` 监听 `request.topic` 变化：为 `BIND_PK`/`SIGN`/`BATCH_SIGN` 时 `setLoading(false)`
    7. 加 5s 超时兜底：`isButtonTriggered` 时启动 `setTimeout(() => setLoading(false), 5_000)`
    8. **Critical**: `isButtonTriggered && loading` 时 `return <Loading opaque />`，不渲染 `children`（避免 Home mount）
    9. loading 结束后正常渲染 `children`
  - Notes: `popupType === 'unknown'` 时保守进入 loading；`isButtonTriggered` 用 `useRef` 存 mount 时的初始值，避免后续 re-render popupType 变化导致误判。`request.topic` 变化时 `useEffect` 会重新评估是否解锁

- [x] **Task 4: `Loading` 组件 `source=button` 时不透明背景**
  - File: `extension/src/providers/RequestContextProvider.tsx`
  - Action: Loading 组件接收 `opaque` prop，为 true 时用 `bg-white` 替代 `bg-[#000]/10 backdrop-blur-sm`

### Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC1 | Side Panel 模式，DApp 页面点击 `[data-sealx-action="open"]` 按钮 | 面板开始加载 | 显示不透明白色全屏 Loading，不渲染任何 Routes（children 不 mount） |
| AC2 | AC1 的 loading 状态中 | messager 收到 `SIGN` / `BIND_PK` / `BATCH_SIGN` 请求（`request.topic` 匹配） | Loading 结束，children mount，路由直接跳到签名/绑定页面，全程无 Home 闪现 |
| AC3 | Side Panel 模式，手动点击扩展图标打开 | 面板开始加载 | 行为不变：无 loading 遮罩，正常渲染 Routes（`?source=button` 不存在时跳过） |
| AC4 | AC1 的 loading 状态中，但 5s 内无 bind/sign 请求 | 5s 超时到达 | Loading 结束，children 正常 mount，`checkRoute` 走默认路由逻辑 |
| AC5 | popup / action / tab 模式，任何方式打开 | 面板开始加载 | `RequestContextProvider` 行为不变，不受 `isButtonTriggered` 影响 |
| AC6 | Side Panel 已打开且 loading 中 | 收到 CONNECT 请求 | Loading **不**结束，继续等待 bind/sign（CONNECT 不触发解锁） |
| AC7 | `open-side-panel` handler 中 `setOptions` 调用失败 | 错误被 catch | 回退到直接 `sidePanel.open()`，面板正常打开但无 loading（降级不阻塞） |

## Additional Context

### Dependencies

- 依赖 `usePopupType()` hook 正常工作
- 依赖 `chrome.sidePanel.setOptions` API 在 `open()` 前生效
- 依赖 `PanelManager` 现有接口

### Testing Strategy

- 手动测试：在安装了 SealX 的 DApp 页面点击 `[data-sealx-action="open"]` 按钮
- 验证 Side Panel 打开时显示白色 loading，不闪现 Home
- 验证 loading 结束后直接显示目标页面
- 验证手动打开 Side Panel 无异常

### Notes

- `?source=button` 参数只在首次按钮触发打开时存在，后续手动打开不会带此参数
- 路由逻辑（`checkRoute`、`routeByRequest`）不修改，loading 只是挡住首页内容

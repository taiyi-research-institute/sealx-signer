---
title: 'Fix Side Panel Flash — 按钮触发打开时 Loading 状态'
slug: 'fix-side-panel-flash-loading'
created: '2026-05-11'
status: 'in-progress'
stepsCompleted: [1]
tech_stack: ['TypeScript', 'React', 'Chrome Extension API', 'Tailwind CSS']
files_to_modify:
  - 'extension/src/entries/background/index.ts'
  - 'extension/src/entries/background/panel-manager.ts'
  - 'extension/src/providers/RequestContextProvider.tsx'
  - 'extension/src/hooks/usePopupType.ts'
code_patterns:
  - '`chrome.sidePanel.setOptions({ path })` 在 `open()` 前设置 URL 参数'
  - '`new URLSearchParams(window.location.search).get()` 读取 URL 参数'
  - '`request.topic` 为 BIND_PK / SIGN / BATCH_SIGN 时结束 loading'
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

| File | Purpose |
| ---- | ------- |
| `extension/src/entries/background/index.ts` | `open-side-panel` 消息处理 (line 142)，设置 URL 参数 |
| `extension/src/entries/background/panel-manager.ts` | `PanelManager`，`setOptions`/`open`/`init`，发布后恢复默认 path |
| `extension/src/providers/RequestContextProvider.tsx` | 请求上下文 + `loading` 状态 + `Loading` 组件 |
| `extension/src/hooks/usePopupType.ts` | `usePopupType()` hook，返回 `isSidePanel` |

### Technical Decisions

- **Loading 结束条件**: `request.header` 有值 且 `request.topic` 为 `SealxTopic.BIND_PK` / `SealxTopic.SIGN` / `SealxTopic.BATCH_SIGN`。CONNECT 不结束 loading。加 3s 超时兜底
- **URL 参数传参**: `?source=button` 作为 signal，通过 `window.location.search` 读取
- **不透明遮罩**: `source=button` 模式下 `bg-white` 全白，不透视底层内容
- **路径恢复**: 面板打开 500ms 后用 `setOptions` 恢复默认路径（无 ?source），避免后续手动打开也进入 loading
- **已有 loading 流转**: `initializeApplication` 中 `setLoading(true)` 保持不变，仅在请求到达后才 `setLoading(false)`

## Implementation Plan

### Tasks

- [ ] **Task 1: PanelManager 新增 `openPanelWithSource` 方法**
  - File: `extension/src/entries/background/panel-manager.ts`
  - Action: 新增方法，设置 `setOptions({ path: 'src/entries/popup/index.html?source=button' })`，调用 `open()`，然后 500ms 后恢复默认路径
  - Notes: 方法返回 Promise，确保 open 完成

- [ ] **Task 2: 后台 `open-side-panel` 处理器调用新方法**
  - File: `extension/src/entries/background/index.ts`
  - Action: 将 `chrome.sidePanel.open({ tabId })` 替换为 `PanelManager.openPanelWithSource(tabId)`
  - Notes: 保持 `notifyPanelOpened('')` 调用不变

- [ ] **Task 3: `RequestContextProvider` 检测 `source=button` 并延长 loading**
  - File: `extension/src/providers/RequestContextProvider.tsx`
  - Action:
    1. 读取 `URLSearchParams(window.location.search).get('source')`
    2. 检测 `popupType === 'sidepanel' && source === 'button'`
    3. 满足条件时，`initializeApplication` 完成后 `setLoading(true)` 不释放
    4. 在 `request.topic` 为 `BIND_PK` / `SIGN` / `BATCH_SIGN` 时 `setLoading(false)`（CONNECT 不解锁）
    5. 加 3s 超时兜底

- [ ] **Task 4: `Loading` 组件 `source=button` 时不透明背景**
  - File: `extension/src/providers/RequestContextProvider.tsx`
  - Action: Loading 组件接收 `opaque` prop，为 true 时用 `bg-white` 替代 `bg-[#000]/10 backdrop-blur-sm`

### Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC1 | Side Panel 模式，DApp 点击按钮触发打开 | 面板加载 | 显示不透明白色 Loading 页面，不出现 Home 页内容 |
| AC2 | Side Panel 模式，点击按钮触发 | bind/sign 请求到达 | Loading 结束，直接渲染签名/绑定页面，无 Home 闪现 |
| AC3 | Side Panel 模式，手动打开（非按钮触发） | 面板加载 | 行为不变，无 loading 遮罩 |
| AC4 | Side Panel 模式，按钮触发但 3s 无请求 | 超时 | Loading 结束，正常渲染默认路由 |
| AC5 | popup/action/tab 模式，任何方式打开 | 页面加载 | 行为不变，不受影响 |

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

---
title: '修复 Side Panel 按钮触发 Loading 的用户手势丢失问题'
slug: 'fix-side-panel-loading'
created: '2026-05-11'
status: 'implementation-complete'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Chrome Extension MV3', 'TypeScript', 'React', 'chrome.storage.session API']
files_to_modify:
  - 'extension/src/entries/background/panel-manager.ts'
  - 'extension/src/providers/RequestContextProvider.tsx'
files_reviewed:
  - 'extension/src/entries/background/panel-manager.ts'
  - 'extension/src/providers/RequestContextProvider.tsx'
  - 'extension/src/entries/background/index.ts'
  - 'extension/src/entries/content/index.tsx'
  - 'extension/src/hooks/usePopupType.ts'
  - 'extension/manifest/manifest.json'
  - 'packages/sealx-sdk/src/index.ts'
code_patterns:
  - 'chrome.sidePanel.open() must be called synchronously within user gesture activation window'
  - 'chrome.storage.session for transient cross-context messaging (set in background, get+remove in panel)'
  - 'content script event delegation preserves gesture token via sendMessage → background onMessage chain'
  - 'async/await breaks Chrome transient activation; sync API calls preserve it'
test_patterns: []
---

# Tech-Spec: 修复 Side Panel 按钮触发 Loading 的用户手势丢失问题

**Created:** 2026-05-11

## Overview

### Problem Statement

在 Service Worker 上下文中，`openPanelWithSource` 方法在调用 `chrome.sidePanel.open()` 之前先执行了 `await chrome.sidePanel.setOptions({ path: '...?source=button' })`。这个异步操作使 Service Worker 的用户手势 token 过期，导致后续 `sidePanel.open()` 抛出 `"may only be called in response to a user gesture"` 错误，面板无法打开。

### Solution

去掉 URL query 参数方案，改为 `chrome.storage.session` 传递 "button source" 标识：
- **写入（Background）**：收到 content script 的 `open-side-panel` 消息后，`chrome.storage.session.set({ panelTriggerSource: 'button' })`，然后直接 `sidePanel.open()`（不经过 setOptions）
- **读取（Panel/Provider）**：`RequestContextProvider` 挂载时通过 `chrome.storage.session.get('panelTriggerSource')` 检测来源，读到 `'button'` 则显示 opaque loading，读取后立即清除

### Scope

**In Scope:**
- 重写 `PanelManager.openPanelWithSource`：移除 `setOptions` + query path，改用 `chrome.storage.session.set`
- 重写 `RequestContextProvider` 的 `isButtonTriggered` 检测：移除 URL 参数解析，改用 `chrome.storage.session.get`
- 确保 storage flag 在面板加载完成后及时清除

**Out of Scope:**
- 心跳机制改动
- Panel 队列系统
- Content script 的 click delegation 逻辑
- 其他 Side Panel 功能

## Context for Development

### Codebase Patterns

- **手势链**：Content script click → `sendMessage({ type: 'open-side-panel' })` → background `onMessage` → `openPanelWithSource` → `await setOptions()` 打破手势 → `sidePanel.open()` 失败
- `chrome.sidePanel.open()` 仅在 `panel-manager.ts:239-262` 的 `openPanelWithSource` 中被调用
- `isButtonTriggered` 当前通过 `URLSearchParams('source')` 检测（`RequestContextProvider.tsx:72`），清理 URL 在 `useEffect`（line 77-81）
- Panel 通过 `messager` 系统与 background 通信
- `usePopupType` hook 通过 `chrome.windows.getCurrent()` + `chrome.tabs.getCurrent()` 推断是否为 sidepanel，返回 'sidepanel' | 'action' | 'window' | 'tab' | 'unknown'
- `isSidePanelCandidate` 派生逻辑：排除已知非 sidepanel 模式后保守判定（`RequestContextProvider.tsx:85-86`）

### Files to Reference

| File | Purpose | Key Line(s) |
| ---- | ------- | ----------- |
| `extension/src/entries/background/panel-manager.ts` | `openPanelWithSource()` — 需要移除 setOptions + query path | 239-262 |
| `extension/src/providers/RequestContextProvider.tsx` | `isButtonTriggered` 检测 + loading 渲染 — 从 URL → storage 迁移 | 72-81, 88-128, 447-456 |
| `extension/src/entries/background/index.ts` | `open-side-panel` 消息处理 — 无需改，已有错误兜底 | 142-158 |
| `extension/src/entries/content/index.tsx` | click 事件委托发送 `open-side-panel` 消息 | 75-82 |
| `extension/src/hooks/usePopupType.ts` | popup type 检测 hook | 全文件 |
| `extension/manifest/manifest.json` | 确认 `side_panel.default_path` = `src/entries/popup/index.html` | 9-11 |
| `packages/sealx-sdk/src/index.ts` | SDK 自动设置 `data-sealx-action="open"` 属性 | 63-118 |

### Technical Decisions

- **`chrome.storage.session`（非 `localStorage`）**：session storage 生命周期与浏览器会话一致，避免持久化残留
- **写入不 await，直接 `open()`**：`chrome.storage.session.set()` 同步入队，不阻塞主线程；不使用 await 打断手势链
- **读取后立即 `remove()`**：防止后续刷新或手动打开 panel 时误触发 loading 状态
- **`chrome.storage.session.set` → `sidePanel.open` 无竞态**：storage 操作在扩展进程内序列化，`set` 在 `open` 触发面板加载前完成
- **`open-side-panel` handler 已有 catch 兜底**：`index.ts:148-156` 包含 `setBadge()` + `setOptions restore` 降级逻辑

### Investigation Findings

1. **根因确认**：`panel-manager.ts:242` 的 `await chrome.sidePanel.setOptions()` 创建 microtask 边界，使 Chrome transient activation token 在 `sidePanel.open()`（line 251）执行前过期
2. **`sendMessage` 传递手势**：content script 的 `sendMessage` 保留 transient activation 上下文到 background 的 `onMessage` 监听器，但任何 `await` 都会丢失
3. **URL 方案不可行**：`?source=button` query param 方案需要在 `open()` 前 `await setOptions()`，天生与手势要求冲突
4. **storage.session 方案优势**：
   - 无 microtask 边界：`set` 同步调用，不打断链
   - 自然隔离：手动点击扩展图标不会写 storage flag，故不触发 loading
   - 自动清理：读取后 remove，无残留风险
5. **`RequestContextProvider` 需要适配异步**：`isButtonTriggered` 状态当前由同步的 URLSearchParams 驱动；改为 `chrome.storage.session.get()` 后需异步初始化，loading 显示时机不变（React state 驱动）

## Implementation Plan

### Tasks

- [x] **Task 1: 重写 `PanelManager.openPanelWithSource`**
  - File: `extension/src/entries/background/panel-manager.ts` (line 239-262)
  - Action: 替换整个方法体
  - Changes:
    1. 移除 `const sourcedPath`、`await setOptions`、`catch fallback open()` 块
    2. 替换为：`chrome.storage.session.set({ panelTriggerSource: 'button' })` → `await chrome.sidePanel.open({ tabId })`
    3. 移除 `setTimeout restore default path`（line 253-261）
    4. 在 `set` 和 `open` 之间加 `// MUST remain synchronous — no await between set and open, preserves transient activation`
  - Notes: 不再需要 catch 中的降级 open()——调用方 handler（index.ts）已有完整错误处理

- [x] **Task 2: 重写 `RequestContextProvider` 的 `buttonSource` 检测**
  - File: `extension/src/providers/RequestContextProvider.tsx` (line 72-105)
  - Action: 替换 URL 解析为 storage.session 读取
  - Changes:
    1. 移除 `buttonSource` useMemo（line 72-74）——URLSearchParams 解析
    2. 移除 URL cleanup useEffect（line 77-81）——`history.replaceState`
    3. 新增 `useEffect`：`chrome.storage.session.get('panelTriggerSource')` → 如值为 `'button'` 则 `setIsButtonTriggered(true)` → 立即 `chrome.storage.session.remove('panelTriggerSource')`
    4. 移除 `initializeApplication` 中 `if (buttonSource !== 'button') { setLoading(false) }` 的条件（line 326-328, 358-359, 390-392），改为由新的 isButtonTriggered 状态统一管理
  - Notes: `get` 和 `remove` 在同一个 async 函数内顺序执行，中间不会被打断。`remove` 失败不影响功能（session storage 生命周期 = 浏览器会话，自然过期）

- [x] **Task 3: `open-side-panel` handler catch 分支清除 storage flag**
  - File: `extension/src/entries/background/index.ts` (line 148-156)
  - Action: 在 `.catch()` 中添加 `chrome.storage.session.remove('panelTriggerSource')`
  - Changes: 在 `PanelManager.setBadge()` 之前添加 `chrome.storage.session.remove('panelTriggerSource').catch(() => {})`
  - Notes: 防止 `sidePanel.open()` 失败（如 tab 无效）后残留 flag，导致手动打开面板时误显示 opaque loading

### Acceptance Criteria

- [ ] **AC1: 按钮触发打开面板并显示 loading**
  - Given: 用户在业务页面（如 `localhost:5173`）
  - When: 点击带有 `data-sealx-action="open"` 的按钮
  - Then: Side Panel 打开，显示不透明白色全屏 loading（`<Loading opaque />`）

- [ ] **AC2: SIGN/BIND_PK/BATCH_SIGN 请求到达后解除 loading**
  - Given: Side Panel 因按钮触发而显示 opaque loading
  - When: messager 收到 `SealxTopic.BIND_PK` / `SealxTopic.SIGN` / `SealxTopic.BATCH_SIGN` 请求
  - Then: loading 消失，路由跳转到对应页面（`/bind-pubkey` / `/task-home`）

- [ ] **AC3: CONNECT 请求不解除 loading**
  - Given: Side Panel 因按钮触发而显示 opaque loading
  - When: messager 收到 `SealxTopic.CONNECT` 请求（session 无效需登录）
  - Then: loading 保持，等待后续 SIGN/BIND_PK 或 5 秒超时

- [ ] **AC4: 5 秒超时 fallback**
  - Given: Side Panel 因按钮触发而显示 opaque loading
  - When: 5 秒内没有收到 SIGN/BIND_PK/BATCH_SIGN 请求
  - Then: loading 自动消失，面板显示当前路由页面

- [ ] **AC5: 手动点击扩展图标不显示 loading**
  - Given: Side Panel 未打开
  - When: 用户点击 Chrome 工具栏的扩展图标（非业务页面按钮）
  - Then: Side Panel 正常打开，无 opaque loading，直接显示对应路由页面

- [ ] **AC6: 无手势错误**
  - Given: 用户在业务页面点击按钮
  - When: content script 发送 `open-side-panel` 消息
  - Then: console 无 `sidePanel.open() may only be called in response to a user gesture` 错误

- [ ] **AC7: 无 heartbeat timeout**
  - Given: Side Panel 正常打开并存活
  - When: 面板加载完成后
  - Then: console 无 `PanelManager: heartbeat timeout, panel likely closed` 日志

- [ ] **AC8: open() 失败时清除 storage flag**
  - Given: `sidePanel.open()` 因非手势原因失败（如 tab 无效）
  - When: catch 分支执行
  - Then: `chrome.storage.session` 中 `panelTriggerSource` 被清除，后续手动打开面板不显示 loading

- [ ] **AC9: 快速连续点击不同 tab**
  - Given: 用户在不同 tab 快速连续点击按钮
  - When: 第一个 tab 的面板正在处理请求
  - Then: 后续 tab 的请求进入队列，队列依次处理，无静默丢失

## Additional Context

### Dependencies

- 无外部依赖，仅使用 Chrome Extension API

### Testing Strategy

- 在本地开发环境 `localhost:5173` 中，点击带有 `data-sealx-action="open"` 属性的按钮，验证 Side Panel 正常打开
- 验证 loading 行为：按钮触发 → opaque loading；扩展图标触发 → 正常面板（无 loading）
- 检查 console 无报错

### Notes

- 原始 `setOptions + timeout restore` 设计是为了在 URL 层面区分 button 触发和手动触发。改用 session storage 后，通过 storage key 的存在性做区分，逻辑更简洁。
- **Advanced Elicitation 加固发现**：
  - Red Team：catch 分支缺乏 storage 清理逻辑，会导致 `open()` 失败后残留 flag → 已加入 Task 3
  - Pre-mortem：快速连续点击行为已通过队列系统处理，符合预期；`get→remove` 不存在竞态（同步顺序调用）
  - First Principles：`storage.session` 是唯一同时满足 "无 await 写入" + "跨上下文" + "非持久化" 的方案
  - 5 Whys 根因：Chrome API 的手势约束是隐式知识，`await` 打断 transient activation 不可见 — 后续 code review 应对 `sidePanel.open()` 周边代码做专项检查

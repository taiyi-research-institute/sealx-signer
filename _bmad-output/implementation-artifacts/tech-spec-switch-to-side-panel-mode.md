---
title: '插件打开模式改为 Chrome Side Panel 侧边栏'
slug: 'switch-to-side-panel-mode'
created: '2026-05-08'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
implementation_guide: 'tech-spec-side-panel-implementation-guide.md'
tech_stack:
  - Chrome Extension Manifest V3
  - Chrome Side Panel API
  - React + TypeScript
  - @crxjs/vite-plugin
files_to_modify:
  - extension/manifest/manifest.json
  - extension/src/entries/background/popup-manager.ts
  - extension/src/entries/background/index.ts
  - extension/src/core/background/index.ts
  - extension/src/entries/popup/App.tsx
  - extension/src/hooks/usePopupType.ts
  - extension/src/entries/popup/components/layout/popup-menu.tsx
  - extension/src/entries/popup/components/home/index.tsx
code_patterns:
  - Chrome Side Panel API (chrome.sidePanel.open / setOptions)
  - PopupManager window creation patterns
  - Manifest V3 side_panel configuration
test_patterns:
  - Manual testing via Chrome extension side panel
---

# 插件打开模式改为 Chrome Side Panel 侧边栏

**Created:** 2026-05-08

## Overview

### Problem Statement

当前 SealX 插件使用 popup 窗口模式打开，具体表现为：
1. **用户体验割裂** — 点击扩展图标弹出 600x856 独立窗口，遮挡网页内容，用户需要频繁切换窗口
2. **窗口管理复杂** — `PopupManager` 维护 `openWindows`、`openTabs`、`callerTabId` 等多个 Map/Ref 来追踪窗口状态，逻辑复杂
3. **窗口生命周期不可控** — popup 窗口可能被用户意外关闭，或被系统回收，导致签名状态丢失

### Solution

使用 Chrome Side Panel API 替代当前的 popup 窗口模式：
- 点击扩展图标时，在浏览器右侧打开侧边栏面板
- **前端触发签名（SIGN/BATCH_SIGN）、bind 等事件时，也通过 side panel 打开**（不再弹独立窗口）
- 复用现有的 popup HTML 入口（`src/entries/popup/index.html`）作为 side panel 页面
- 移除 `action.default_popup`，改用 `chrome.sidePanel.setOptions()` + `chrome.sidePanel.open()`
- 简化 `PopupManager`，移除 `chrome.windows.create` 等复杂窗口管理逻辑

### Scope

**In Scope:**
- manifest 添加 `side_panel` 配置和 `sidePanel` 权限
- PopupManager 改用 `chrome.sidePanel.open()`
- 前端触发签名、bind 等事件时也通过 side panel 打开
- 移除 `action.default_popup`
- `closeWindow()` 适配侧边栏关闭方式
- CSS 布局适配侧边栏宽度（Chrome Side Panel 默认约 320-400px）

**Out of Scope:**
- Firefox 兼容（Side Panel 是 Chrome 独有 API）
- 侧边栏 UI 重新设计
- 签名逻辑变更

## Context for Development

### Codebase Patterns
- Chrome Extension Manifest V3，使用 `@crxjs/vite-plugin` 构建
- Manifest 源文件：`manifest/manifest.json`，通过 `vite-config/base.ts` 用 `...manifest` 展开透传给 crx 插件
- `PopupManager` 管理 popup 窗口生命周期（创建、查找、关闭）
- `closeWindow()` 通过 `SealxTopic.CLOSE` 消息通知 background 关闭窗口
- React Router 使用 `createHashRouter`，路由白名单：`initialize, initialized, login, /, task-home, task-detail, reset-pin, set-screen-timer, bind-pubkey, key-manage, key-export, key-import`
- `popup-menu.tsx` 和 `home/index.tsx` 使用 `isActionPopup` 判断是否在新 tab 打开页面
- background `onForward` handler 和 `CONNECT` handler 都调用 `PopupManager.popupWindow()`
- `checkPopup()` 通过 `MessageChannel.POPUP` 发送 `CHECK_ACTIVE` 消息检查 popup 就绪状态
- `App.tsx` 监听 `close-popup` runtime 消息调用 `window.close()`

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `extension/manifest/manifest.json` | Manifest 源文件 — 当前配置 `action.default_popup` |
| `extension/vite-config/base.ts` | Vite 基础配置 — `...manifest` 展开透传，`side_panel` 字段应被保留 |
| `extension/vite-config/chrome.ts` | Chrome 构建配置 — crx 插件，可能需手动注入 `side_panel` |
| `extension/src/entries/background/popup-manager.ts` | PopupManager — 窗口创建/关闭逻辑，需重构为 PanelManager |
| `extension/src/entries/background/index.ts` | Background service worker — `onForward`、`CONNECT` handler 调用 `popupWindow()`，`checkPopup()` 轮询，`CLOSE` handler |
| `extension/src/core/background/index.ts` | `closeWindow()` helper — 需重定义为面板导航 |
| `extension/src/entries/popup/index.html` | Popup HTML 入口 — 将同时作为 side panel 页面 |
| `extension/src/entries/popup/App.tsx` | Popup 根组件 — `popupType` 检测 + `close-popup` 消息监听 |
| `extension/src/entries/popup/Routes.tsx` | React Router — `createHashRouter` + 路由白名单 |
| `extension/src/hooks/usePopupType.ts` | popup 类型检测 — 需新增 `sidepanel` 分支 |
| `extension/src/entries/popup/components/layout/popup-menu.tsx` | 菜单组件 — `isActionPopup` 判断新 tab 打开 |
| `extension/src/entries/popup/components/home/index.tsx` | 首页组件 — `isActionPopup` 判断新 tab 打开 |

### Technical Decisions
1. 使用 `side_panel.default_path` 指向现有 popup HTML 页面，复用 UI
2. 移除 `action.default_popup`，使 `chrome.action.onClicked` 事件可用，用于手动控制侧边栏打开
3. `closeWindow()` 适配：Chrome 无 `chrome.sidePanel.close()` API，改为导航到空白页或重置状态（禁用再启用 sidePanel）
4. 路由传递：通过 URL hash（`#task-home`）或 `chrome.runtime.sendMessage` 传递路由信息给 side panel 页面
5. `chrome.sidePanel.open()` 仅可在 service worker 中的用户手势回调或 `chrome.action.onClicked` 中调用；前端事件触发时需用 `chrome.sidePanel.setOptions()` 设置路径后由 `onClicked` 间接打开，或使用 `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` 自动打开
6. `onForward` handler（background/index.ts:109-148）中 SIGN/BATCH_SIGN/BIND_PK 事件改用 side panel 打开
7. `usePopupType` hook 新增 `sidepanel` 类型检测

### Pre-mortem Risk Mitigations
1. **`chrome.sidePanel.open()` 调用限制**：使用 `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` 让点击图标自动打开。前端事件触发时使用 `chrome.sidePanel.open({ tabId })`（Chrome 116+ 支持 service worker 中通过 tabId 打开）
2. **Side Panel 关闭后状态丢失**：监听 side panel 页面的 `beforeunload` 事件通知 background 清理状态；background 设置心跳超时（10 秒未收到心跳认为已关闭）
3. **CSS 布局适配**：Side panel 宽度约 320-400px，现有 UI 为 600px 设计。需要响应式适配（弹性布局 + min-width）
4. **`checkPopup()` 轮询适配**：改为通过 `chrome.runtime.sendMessage` + side panel 页面 `onMessage` listener 实现就绪检查
5. **多次打开状态管理**：side panel 已打开时通过 `chrome.runtime.sendMessage` 发送路由消息导航，不重复打开；通过心跳机制检测 side panel 是否存活

### Architecture Decision: Option A — `openPanelOnActionClick` + `chrome.sidePanel.open({ tabId })`

**对比方案：**

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| **A (选定)** | `setPanelBehavior({ openPanelOnActionClick: true })` + `sidePanel.open({ tabId })` | 最简单，Chrome 116+ 原生支持 | 依赖较新 Chrome |
| B | 移除 `default_popup` + `onClicked` 手动控制 | 完全控制逻辑 | 与 `@crxjs/vite-plugin` 构建冲突 |
| C | 保留 `default_popup` + 同时配置 `side_panel` | 向后兼容，可回退 | manifest 冗余 |

**选择理由：**
1. 项目只支持 Chrome（Firefox 有独立配置 `vite-config/firefox.ts`，不受影响）
2. `chrome.sidePanel.open({ tabId })` 从 Chrome 116 支持在 service worker 中调用
3. `setPanelBehavior({ openPanelOnActionClick: true })` 让点击图标直接打开 side panel，无需手动管理 `onClicked`
4. 前端事件通过 `onForward` handler 调用 `chrome.sidePanel.open({ tabId })` 打开

### Red Team 防御策略
1. **`open()` 调用上下文**：Chrome 116+ 的 `chrome.sidePanel.open({ tabId })` 可从 service worker 任何上下文调用（不限用户手势）。Fallback：先 `setOptions({ path: '...#route' })` 设置带路由 URL，再由 content script 辅助触发
2. **路由信息传递**：使用 `chrome.runtime.sendMessage({ type: 'navigate', route })` 发送路由消息。side panel 页面通过 `chrome.runtime.onMessage.addListener` 接收并调用 React Router 的 `navigate()`
3. **`@crxjs/vite-plugin` 兼容性**：`side_panel` 是标准 MV3 字段，应被透传。构建后需检查 `dist_chrome/manifest.json` 确认字段存在。如果被过滤，在 `vite-config/chrome.ts` 中手动注入
4. **`usePopupType` 适配**：side panel 中 `chrome.windows.getCurrent()` 返回 `type: 'normal'`，`chrome.tabs.getCurrent()` 返回 `undefined`。判断逻辑：`type === 'normal' && currentTab === undefined` → `sidepanel`
5. **签名生命周期**：不依赖窗口关闭重置状态。新签名请求到达时通过 React Router state 更新主动重置组件状态

### First Principles: 从"窗口管理"到"面板路由管理"
- Side panel 是**持久 UI 面板**，不是临时弹窗。生命周期完全不同：popup 是 打开→操作→关闭；side panel 是常驻→路由切换
- `closeWindow()` 语义改变：不再关闭窗口，改为导航到空白/首页
- `while (!await checkPopup())` 轮询模式不适用：side panel 持久存在，不需要等待"打开完成"。改为等待 side panel 发送"就绪"消息
- `PopupManager` 重构为 `PanelManager`，核心职责：打开 side panel（如未打开）→ 发送路由消息 → 等待就绪确认 → 心跳检测

### AE Round 2 补充
1. **Manifest 必须移除 `action.default_popup`**：保留 `default_popup` 时 `setPanelBehavior({ openPanelOnActionClick: true })` 不生效。改为配置 `side_panel.default_path` 指向 `src/entries/popup/index.html`
2. **路由传递**：先 `chrome.sidePanel.setOptions({ path: 'src/entries/popup/index.html#task-home' })` 设置带 hash 路由的 URL，再 `chrome.sidePanel.open({ tabId })` 打开
3. **`checkPopup()` 防死循环**：添加最大重试 50 次 + 超时 5 秒，避免 side panel JS 未加载时无限轮询
4. **`popupType` 相关组件添加 `sidepanel` 分支**：`popup-menu.tsx`、`home/index.tsx` 等组件根据 popupType 调整 UI，需新增 sidepanel 布局
5. **Firefox 构建保持 popup 模式不变**：`vite-config/firefox.ts` 不修改，Firefox 仍使用 `action.default_popup`

### Security Audit 加固
1. **路由白名单验证**：`chrome.runtime.onMessage` 处理 navigate 消息时，验证 route 在允许列表 `['login', 'task-home', 'bind-pubkey', ...]` 中，拒绝未知路由
2. **`setOptions({ path })` 防路径注入**：path 使用固定前缀 `src/entries/popup/index.html#` + 白名单 route 拼接，不直接拼接用户输入
3. **CSP 覆盖确认**：manifest 中 `content_security_policy` 自动覆盖 side panel 页面（与 popup 同源），防止 XSS
4. **tabId 不可伪造**：`chrome.runtime.sendMessage` 的 `sender.tab.id` 由 Chrome 内部填充，content script 无法伪造，安全

### What If 极端场景预案
1. **Chrome API 变更**：保持 `PopupManager` 代码注释保留不删除，manifest 保留原 popup 配置注释。API 变更时可快速回退
2. **Side panel JS 崩溃**：添加 React ErrorBoundary + 重试按钮。`checkPopup()` 超时后向前端发送错误回执
3. **多标签页并发签名**：Chrome side panel 全局唯一（一个窗口一个）。多 tab 签名请求需排队：side panel 显示任务队列"N 个待签名任务"，非每次覆盖路由
4. **Content script 未注入**：现有 `tabs.onActivated` 已有检查逻辑，无需额外处理
5. **`@crxjs/vite-plugin` 过滤 `side_panel`**：构建后检查 `dist_chrome/manifest.json` 是否含 `side_panel`。如缺失，在 `vite-config/chrome.ts` 中通过构建后脚本手动注入

### 5 Whys: closeWindow() 重定义
- Chrome 无 `chrome.sidePanel.close()`，Side Panel 是用户主动控制的持久面板
- `closeWindow()` 重定义为两种行为：
  - **签名完成后**：导航到首页/成功页，显示签名结果摘要（不关闭面板）
  - **强制关闭**（错误/超时）：`setOptions({ enabled: false })` → 立即 `setOptions({ enabled: true })` 禁用再启用，视觉上"关闭"面板

### 迁移路径推理

**核心变化映射：**
```
popup 模式                          side panel 模式
─────────────────────              ─────────────────────
action.default_popup               side_panel.default_path
chrome.windows.create()            chrome.sidePanel.open()
PopupManager (窗口生命周期)         PanelManager (面板路由管理)
window.close() / closeWindow()     navigate('/') (导航回首页)
URL hash 传路由                     setOptions({ path }) + sendMessage
checkPopup() POPUP channel         checkPanel() runtime.sendMessage
popupType: window/action/tab       popupType: 新增 sidepanel
```

**执行顺序（按依赖关系）：**
1. manifest.json 添加 `side_panel` + `sidePanel` 权限，移除 `action.default_popup`
2. vite-config/chrome.ts 适配（确保 `side_panel` 字段不被过滤）
3. PopupManager → PanelManager 重构（side panel 打开/路由/心跳）
4. background/index.ts `onForward` handler 改用 PanelManager
5. `closeWindow()` 重定义（导航回首页 vs 禁用再启用）
6. `usePopupType` 新增 `sidepanel` 检测
7. popupType 相关组件适配（popup-menu.tsx、home/index.tsx）
8. CSS 响应式适配（320-400px 宽度）

**回退策略：** Firefox 不受影响。Chrome 回退：恢复 `action.default_popup`，注释 `side_panel`，恢复 PopupManager

**Select:** [A] Advanced Elicitation [P] Party Mode [C] Continue to Generate Spec (Step 3 of 4)

---

## 相关文档

- **实现指南**: `tech-spec-side-panel-implementation-guide.md` — 详细实现步骤、代码示例、CSS 响应式方案、测试清单和回退方案

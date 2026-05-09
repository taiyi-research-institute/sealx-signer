---
title: 'Side Panel 登录流程修复 — 自动焦点与生命周期事件'
slug: 'fix-side-panel-login-focus-and-lifecycle'
created: '2026-05-08'
status: 'Implementation Complete'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['TypeScript', 'React 19', 'Chrome Extension MV3', 'Side Panel API']
files_to_modify:
  - 'extension/src/entries/background/index.ts'
  - 'extension/src/entries/popup/components/password/index.tsx'
  - 'extension/src/entries/popup/components/login/index.tsx'
  - 'extension/src/entries/popup/components/initialize/index.tsx'
  - 'extension/src/entries/popup/components/reset-pin/index.tsx'
code_patterns:
  - 'Password 组件内部 focus 模式: setTimeout(() => divRefs.current[index]?.focus(), 100)'
  - 'background/index.ts 中注册 onInstalled/onStartup 事件'
test_patterns: ['手动测试：安装扩展验证 tab 打开 + PIN 输入框自动 focus']
---

# Tech-Spec: Side Panel 登录流程修复 — 自动焦点与生命周期事件

**Created:** 2026-05-08

## Overview

### Problem Statement

从 PopupManager 迁移到 PanelManager 后，出现两个回归 bug：
1. 扩展安装（onInstalled）和启动（onStartup）时不再自动打开登录页。原 `PopupManager.setPopupWindow()` 中包含这些逻辑，迁移时丢失。根因：迁移时用"重写"替代了"逐行迁移"，导致非核心但关键的事件监听逻辑被遗漏。
2. 登录页面和初始化页面的 PIN 输入框没有自动获取焦点，用户需要手动点击才能开始输入。`Password` 组件没有 `autoFocus` prop 支持。

### Solution

1. 在 `background/index.ts` 中合并/补回 `chrome.runtime.onInstalled` 和 `chrome.runtime.onStartup` 监听器。onInstalled 时用 `chrome.tabs.create` 打开新 tab 显示登录/初始化页面；onStartup 时创建 alarm
2. 给 `Password` 组件添加 `autoFocus` prop，mount 时自动 focus 第一个输入格；在 login/initialize/reset-pin 页面中启用

### Scope

**In Scope:**
- `background/index.ts` 合并 onInstalled 逻辑（DB 初始化 + clearAllSession + tabs.create 打开 login tab），新增 onStartup 逻辑（create alarm）
- onInstalled 加 `details.reason === 'install'` 过滤，只在首次安装时打开新 tab，更新时静默
- tabs.create 失败时 fallback 到 `PanelManager.openPanel('login')`
- `Password` 组件添加 `autoFocus` prop
- `login/index.tsx` 启用 autoFocus
- `initialize/index.tsx` 启用 autoFocus
- `reset-pin/index.tsx` 启用 autoFocus

**Out of Scope:**
- CSS 挤压问题（已解决）
- 其他页面 focus 行为
- Side Panel 导航/心跳/队列相关逻辑

## Context for Development

### Codebase Patterns

- 生命周期事件监听器放 `background/index.ts`（非 PanelManager.init()），保持职责分离：PanelManager 只管面板操作，background 入口管全局事件
- `Password` 组件使用 `divRefs` (useRef) 管理每个数字格子的 DOM 引用，通过 `divRefs.current[index]?.focus()` 控制焦点
- 内部已有 focus 模式：`setTimeout(() => divRefs.current[targetIndex]?.focus(), 100)` — autoFocus 遵循相同模式
- `focusedIndex` state 初始值为 0，光标管理 useEffect（line 38）在 `focusedIndex` 变化时触发，但首次 mount 时 focusedIndex 不变（0→0），所以不会触发初始 focus
- Password 已有 `visibilitychange` 处理（line 22-35），页面恢复可见时自动 focus 第一个空输入格 — **不需要额外添加**
- 原备份 `popup-manager.backup.ts` line 63-71：`onStartup → create alarm`，`onInstalled → clearAllSession + popupWindow(3,'login') + create alarm`

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `extension/src/entries/background/index.ts` | background 入口 — 已有 onInstalled 做 DB 初始化（line 22-26），需合并 clearAllSession + tabs.create，新增 onStartup |
| `extension/src/entries/background/panel-manager.ts` | PanelManager — openPanel('login') 作为 fallback |
| `extension/src/entries/background/popup-manager.backup.ts` | 原始参考 — line 63-71 的 onInstalled/onStartup 逻辑 |
| `extension/src/entries/popup/components/password/index.tsx` | Password 组件（307行）— 需在 PasswordProps 加 autoFocus prop |
| `extension/src/entries/popup/components/login/index.tsx` | 登录页 — 在 `<Password>` 上传 `autoFocus` |
| `extension/src/entries/popup/components/initialize/index.tsx` | 初始化页 — 在 `<Password>` 上传 `autoFocus` |
| `extension/src/entries/popup/components/reset-pin/index.tsx` | 重置 PIN 页 — 在 `<Password>` 上传 `autoFocus` |

### Technical Decisions

- onInstalled 中 `clearAllSession()` 仍然需要，防止升级后残留脏状态
- onInstalled 中使用 `chrome.tabs.create({ url: chrome.runtime.getURL('src/entries/popup/index.html#/login') })` 打开新 tab，与原 `popupWindow(3, 'login')` 的 tab 模式行为一致
- onInstalled 加 `details.reason === 'install'` 过滤：只在首次安装时打开新 tab，`reason === 'update'` 时静默（仅做 DB 初始化 + clearAllSession）
- tabs.create 失败时 fallback 到 `PanelManager.openPanel('login')`，确保用户总能看到登录页
- onStartup 中只创建 alarm，不打开面板
- autoFocus 通过 prop 传入而非硬编码，保持组件灵活性
- autoFocus 实现用 `useEffect` + `setTimeout(100ms)` 模式，与 Password 内部已有 focus 模式一致
- 生命周期逻辑放 `background/index.ts` 而非 `PanelManager.init()`，保持职责分离

## Implementation Plan

### Tasks

- [x] Task 1: 合并 background/index.ts 的 onInstalled 监听器
  - File: `extension/src/entries/background/index.ts`
  - Action: 修改现有 `chrome.runtime.onInstalled.addListener`（line 22-26），将回调参数改为 `(details)`，在现有 DB 初始化逻辑前添加 `sessionStore.getState().clearAllSession()`
  - Action: 添加条件判断 `if (details.reason === 'install')`，在条件内使用 `chrome.tabs.create({ url: chrome.runtime.getURL('src/entries/popup/index.html#/login') })` 打开新 tab
  - Action: tabs.create 用 try-catch 包裹，catch 中 fallback 到 `PanelManager.openPanel('login')`
  - Action: 在 onInstalled 内（无论 reason）添加 `chrome.alarms.create('checkSealx', { periodInMinutes: 0.1 })`
  - Notes: 逐行对照 `popup-manager.backup.ts` line 67-71 确保无遗漏

- [x] Task 2: 新增 background/index.ts 的 onStartup 监听器
  - File: `extension/src/entries/background/index.ts`
  - Action: 在 onInstalled 监听器之后新增 `chrome.runtime.onStartup.addListener(() => { chrome.alarms.create('checkSealx', { periodInMinutes: 0.1 }) })`
  - Notes: 对应 backup line 63-65

- [x] Task 3: Password 组件添加 autoFocus prop
  - File: `extension/src/entries/popup/components/password/index.tsx`
  - Action: 在 `PasswordProps` 接口（line 4-10）添加 `autoFocus?: boolean`
  - Action: 在组件参数解构中接收 `autoFocus = false`
  - Action: 在组件内（visibilitychange useEffect 之前）添加新的 useEffect：
    ```typescript
    useEffect(() => {
        if (!autoFocus) return
        const timer = setTimeout(() => {
            const firstEmpty = digits.findIndex(d => !d)
            const targetIndex = firstEmpty !== -1 ? firstEmpty : 0
            divRefs.current[targetIndex]?.focus()
        }, 100)
        return () => clearTimeout(timer)
    }, [autoFocus])
    ```
  - Notes: 遵循组件内部已有的 `setTimeout(100ms)` focus 模式。依赖数组用 `[autoFocus]` 而非 `[autoFocus, digits]`，只在 mount 时触发一次

- [x] Task 4: login/index.tsx 启用 autoFocus
  - File: `extension/src/entries/popup/components/login/index.tsx`
  - Action: 找到 `<Password>` 组件调用，添加 `autoFocus` prop
  - Notes: 具体行号需读文件确认，搜索 `<Password` 定位

- [x] Task 5: initialize/index.tsx 启用 autoFocus
  - File: `extension/src/entries/popup/components/initialize/index.tsx`
  - Action: 找到 `<Password>` 组件调用，添加 `autoFocus` prop
  - Notes: 同 Task 4

- [x] Task 6: reset-pin/index.tsx 启用 autoFocus
  - File: `extension/src/entries/popup/components/reset-pin/index.tsx`
  - Action: 找到 `<Password>` 组件调用，添加 `autoFocus` prop
  - Notes: 同 Task 4

- [x] Task 7: 构建验证
  - Action: `cd extension && npm run build:chrome` 确认构建通过
  - Action: 验证 `dist_chrome/manifest.json` 无变化（此 spec 不涉及 manifest 修改）

### Acceptance Criteria

- [ ] AC 1: Given 扩展首次安装（onInstalled reason='install'），when 安装完成，then 自动打开新 tab 显示 login/initialize 页面
- [ ] AC 2: Given 扩展更新（onInstalled reason='update'），when 更新完成，then 不弹新 tab，静默完成 DB 初始化 + clearAllSession
- [ ] AC 3: Given tabs.create 失败（如浏览器策略限制），when onInstalled 触发，then fallback 到 PanelManager.openPanel('login') 打开 side panel
- [ ] AC 4: Given 浏览器启动，when onStartup 触发，then 创建 checkSealx alarm（periodInMinutes: 0.1）
- [ ] AC 5: Given login 页面已加载且 Password 有 autoFocus，when 组件 mount 完成，then 第一个 PIN 输入格自动获得焦点，用户可直接输入数字
- [ ] AC 6: Given initialize 页面已加载且 Password 有 autoFocus，when 组件 mount 完成，then 第一个 PIN 输入格自动获得焦点
- [ ] AC 7: Given reset-pin 页面已加载且 Password 有 autoFocus，when 组件 mount 完成，then 第一个 PIN 输入格自动获得焦点
- [ ] AC 8: Given 构建执行，when npm run build:chrome，then 构建成功无报错

## Additional Context

### Dependencies

无外部依赖变更。仅依赖已有的 `chrome.tabs.create`、`chrome.alarms.create`、`sessionStore` API。

### Testing Strategy

**手动测试：**
1. 卸载扩展 → 重新加载 → 验证新 tab 自动打开到 login 页
2. 新 tab 中验证 PIN 输入框自动获得焦点，直接按键可输入
3. 通过 side panel 触发签名 → login 页打开 → 验证 focus
4. 初始化页面 → 验证 PIN 输入框 focus
5. 重启浏览器 → 验证 alarm 正常创建
6. 更新扩展版本 → 验证不弹新 tab

### Notes

**迁移教训：** 从旧模块迁移时，应逐行对比原方法中的每个功能点，而非重写后假设覆盖了所有行为。`popup-manager.backup.ts` 保留作为参考。

**Pre-mortem 风险点：**
- onInstalled 中 URL 必须用 `#/login` 格式匹配 React HashRouter
- autoFocus 的 useEffect 依赖数组用 `[autoFocus]` 避免重复触发

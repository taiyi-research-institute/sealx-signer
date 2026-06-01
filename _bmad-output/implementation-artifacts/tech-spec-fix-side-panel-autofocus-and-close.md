---
title: '修复 Side Panel Password autoFocus + 签名完成后面板关闭'
slug: 'fix-side-panel-autofocus-and-close'
created: '2026-05-19'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]

## Review Notes
- Adversarial review completed
- Findings: 2 total, 1 fixed, 1 skipped
- F1 (fixed): `scheduleStableReset` timeout cleanup added
- F2 (skipped): `pointerdown` guard on non-interactive areas — by design
- Resolution approach: auto-fix
tech_stack: ['React 18', 'TypeScript', 'Chrome Extension Manifest V3', 'Side Panel API']
files_to_modify:
  - 'extension/src/entries/popup/components/password/index.tsx'
  - 'extension/src/entries/background/panel-manager.ts'
code_patterns:
  - 'Password 组件 autoFocus prop 驱动多 timer 链式 focus'
  - 'blur 事件 re-focus 防御 Chrome 焦点抢夺（焦点目标检查 + 6 次重试 + userLeftRef 守卫）'
  - 'PanelManager closePanel → forceHide 侧 panel 关闭'
test_patterns: ['手动测试 Side Panel 模式（慢机器/不同 Chrome 版本）', '正常机器 Smoke 测试', '焦点陷阱回归测试']
---

# Tech-Spec: 修复 Side Panel Login 自动聚焦 + 签名完成后面板关闭

**Created:** 2026-05-19

## Overview

### Problem Statement

三个 Side Panel 模式相关的 bug：

**Bug 1（核心）：所有 Password 组件 autoFocus 在 Side Panel 模式下被 Chrome 抢走焦点**

Login、Initialize、PinPopup 等所有使用 `<Password autoFocus>` 的页面都受影响。侧 panel 已加载的情况，失焦后重新点击插件获取焦点 → 焦点立即被 Chrome Side Panel 内部 focus 管理抢走 → 需再次离开并点击才能稳定获得焦点。交替复现规律（失焦→点入→立即灭→再点→恢复正常），确认是 Chrome Side Panel focus 管理的确定性竞争。

**Bug 2（签名完成后面板未关闭）**：

`TaskHome` 中 `items.length === 0` 调用 `closeWindow()` → `SealxTopic.CLOSE` → `PanelManager.closePanel()` → `navigateToRoute('')`。side panel 模式下 navigate 到首页不等于"关闭"，用户看到面板仍然显示首页，违反预期。

### Solution

**Bug 1**：在 `Password` 组件中增加三道防线：(1) 延长 timer 链至 1500ms + 事件 delay 延长以覆盖慢机器；(2) blur re-focus 防火墙（焦点目标检查 + userLeftRef 用户意图守卫 + 6 次重试上限）。修复位置在 Password 组件内部，**一次修复覆盖所有使用 Password 组件的页面**（Login、Initialize、Reset PIN、PinPopup、Key Manage 等）。

**Bug 2**：修改 `PanelManager.closePanel()` → 改为 `forceHide()`（disable → enable toggle），等效于完全关闭面板。无需改动 `TaskHome` 或 `closeWindow` 调用链。

### Scope

**In Scope:**
- `password/index.tsx`：新增 blur-based re-focus 防御（仅 side panel 模式 + autoFocus + !readonly）
- `panel-manager.ts`：`closePanel()` 改为 `forceHide()`
- 覆盖所有使用 Password 组件的页面

**Out of Scope:**
- Password 组件重构
- 各页面的 Password prop 调整（已有 autoFocus）
- Login/Initialize/PinPopup 等页面的逻辑变更
- 样式调整

## Context for Development

### Codebase Patterns

1. **Password 组件 focus 机制** (`password/index.tsx`)：
   - `useLayoutEffect`：mount 时 multi-timer 链 focus (0/50/120/250/500/900ms) + `requestAnimationFrame`
   - `useEffect`：`visibilitychange`、`window focus`、`pageshow` 事件重新 focus
   - 隐藏 `<input>` (opacity:0) 叠在 6 个视觉 `<div>` 上方捕获输入
   - `autoFocus` prop 控制是否启用 focus；`readonly` prop 控制是否禁止 focus

2. **Side Panel 生命周期** (`App.tsx`)：
   - `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` 点击图标自动打开
   - 每 3s 发送 `panel-heartbeat` 给 background
   - 页面加载 500ms 后发送 `panel-ready`
   - 监听 `panel-navigate` 消息更新 hash route
   - `close-popup` 消息 → 导航回首页（不关闭）

3. **PanelManager** (`panel-manager.ts`)：
   - `closePanel()` → `navigateToRoute('')` 导航到首页
   - `forceHide()` → disable + enable side panel，等效关闭
   - `openPanel()` → 验证路由 → 导航 或 setOptions + badge fallback

4. **closeWindow** (`core/background/index.ts`)：
   - 发送 `SealxTopic.CLOSE` 消息给 background
   - background 接收后调用 `PanelManager.closePanel()`

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `extension/src/entries/popup/components/password/index.tsx` | **Bug 1 修复点** — focus 核心实现 |
| `extension/src/entries/background/panel-manager.ts` | **Bug 2 修复点** — closePanel/forceHide |
| `extension/src/entries/background/index.ts` | CLOSE handler 注册 |
| `extension/src/core/background/index.ts` | closeWindow 函数 |
| `extension/src/entries/popup/App.tsx` | Side panel 生命周期、close-popup handler |
| `extension/src/entries/popup/components/task/index.tsx` | TaskHome 签名完成 → closeWindow 调用 |
| `extension/src/entries/popup/components/login/index.tsx` | 登录页（参考，不改） |

### Technical Decisions

1. **Timer 链 + 事件延迟优化（Occam 简化）**：

   根因不在 Chrome "主动抢焦点"，而是 Side Panel 渲染完成时 Chrome 给窗口 focus 的默认行为把焦点移到 body。Timer 链在 Chrome setup 之后执行 → 成功；之前执行完 → 被覆盖。

   优化：
   | 改动点 | Before | After | 原因 |
   |--------|--------|-------|------|
   | Timer 链最长间隔 | 900ms | 1500ms | 覆盖慢机器 panel 渲染 |
   | `visibilitychange` delay | 60ms | 300ms | 避免 Chrome setup 中途 focus |
   | `window focus` delay | 30ms | 200ms | 同上 |

2. **Blur re-focus 安全策略（防火墙）**：

   Timer/事件优化后大部分场景已覆盖。Blur re-focus 作为**最后防线**，简化为两层：

   | 层 | 机制 | 作用 |
   |----|------|------|
   | 1 | **焦点目标检查** | 失焦目标不是同面板内可交互元素 → 抢回 |
   | 2 | **6 次重试上限** | 防止无限焦点争夺，每次成功稳定 500ms 后重置 |

   移除激活窗口限制（timer 链已覆盖 mount 阶段），blur re-focus 在组件**全生命周期**生效。

   用户意图守卫 `userLeftRef`：防止外部点击 → blur → re-focus → blur 无限循环：
   - `pointerdown` 监听：点击在 Password container 外 → `userLeftRef.current = true`
   - blur handler 检查：`userLeftRef === true` → 不抢回（用户主动离开）
   - Password `onFocus` 重置：`userLeftRef.current = false` + `retryCountRef.current = 0`

   Blur 决策树：
   ```
   blur
   ├─ readonly? !autoFocus? popup-mode? hidden? → return
   ├─ userLeftRef? (用户点击外部) → return
   ├─ retryCount >= 6? → return
   ├─ activeElement 是同面板内可交互元素? → return
   └─ retryCount++ → setTimeout(focusInput, 50)
   ```

3. **closePanel → forceHide**：
   - 直接修改 `PanelManager.closePanel()`：调用 `forceHide()` 代替 `navigateToRoute('')`
   - `closeWindow()` → `CLOSE` handler → `closePanel()` 整个调用链无需改动
   - 副作用：Panel 关闭后用户需点击扩展图标重新打开；这是"完成签名"的正确行为

## Implementation Plan

### Tasks

- [ ] **Task 1: Password 组件 — timer 链延长 + blur re-focus 防御**
  - File: `extension/src/entries/popup/components/password/index.tsx`
  - 改动 1 — Timer 链延长：
    ```tsx
    // Before:
    const timers = [0, 50, 120, 250, 500, 900].map(delay => setTimeout(focusInput, delay));
    // After:
    const timers = [0, 50, 120, 250, 500, 900, 1200, 1500].map(delay => setTimeout(focusInput, delay));
    ```
  - 改动 2 — 事件 delay 延长：
    ```tsx
    // visibilitychange: 60ms → 300ms
    const handleVisibility = () => {
        if (!document.hidden) setTimeout(focusInput, 300);
    };
    // window focus: 30ms → 200ms
    const handleWindowFocus = () => setTimeout(focusInput, 200);
    ```
  - 改动 3 — 新增 blur re-focus 防御：
    - `retryCountRef` + `retrySuccessTimerRef` — 6 次上限，500ms 稳定重置
    - `userLeftRef` — `pointerdown` 守卫：点击 container 外 → `true`，blur 不抢回
    - blur handler（检查 popup-mode、autoFocus、readonly、document.hidden、userLeft、retryCount、focusTarget）
    - `onBlur` 增强：`setIsFocused(false)` → `handleBlur(e)`
    - `onFocus` 增强：启动 500ms 稳定计时 → 重置 retryCount + userLeftRef
    - `visibilitychange` / `window focus` handler 增强：重置 retryCount + userLeftRef
    - `pointerdown` listener：`document.addEventListener('pointerdown', ...)` 判断点击在 container 内/外

- [ ] **Task 2: PanelManager.closePanel 改为 forceHide**
  - File: `extension/src/entries/background/panel-manager.ts`
  - 修改：
    ```tsx
    static async closePanel(): Promise<void> {
        await this.forceHide()
    }
    ```
  - `forceHide()` 已存在（line 386-395），无需新增方法
  - 影响范围：`closeWindow()` → `SealxTopic.CLOSE` → `closePanel()` 整个调用链无需修改
  - CLOSE handler（`background/index.ts:220`）无需修改

- [ ] **Task 3: 验证所有 Password 使用场景不受影响**
  - 检查页面列表：Login、Initialize（两阶段）、Reset PIN（两阶段）、PinPopup、Key Manage
  - 确认 popup window 模式：`popup-mode !== 'sidepanel'` → blur handler 不触发 → 原有行为不变
  - 确认 readonly 模式：锁定时 `readonly=true` → blur handler 直接 return → 原有行为不变

### Acceptance Criteria

- [ ] **AC 1 (Login)**：Given side panel 未登录，When 点击页面 Approve 按钮触发签名 → side panel 弹出登录页，Then Password 输入框自动获取焦点（光标闪烁），且在慢机器上稳定
- [ ] **AC 2 (Login 交替)**: Given side panel 登录页已获取焦点，When 点击插件外部区域失去焦点 → 再点击插件内部区域，Then Password 输入框重新获取焦点（不出现立即失焦的交替现象）
- [ ] **AC 3 (Initialize)**: Given side panel Initialize 页面，When 初始 PIN 输入 → 切换到 confirm PIN 阶段，Then confirm Password 自动获取焦点
- [ ] **AC 4 (PinPopup)**: Given side panel 导入/导出密钥，When PinPopup 弹框显示，Then Password 自动获取焦点
- [ ] **AC 5 (关闭面板)**: Given side panel 中有待签名 task，When 所有 task 签名完成后，Then side panel 自动关闭（隐藏）
- [ ] **AC 6 (图标打开)**: Given side panel 关闭状态，When 点击 Chrome 扩展图标 → side panel 打开并重定向到 login 页，Then Password 自动获取焦点
- [ ] **AC 7 (焦点陷阱回归)**: Given Password 已获取焦点，When 用户主动点击面板内其他可交互元素（按钮、链接、其他 input），Then 焦点不被强制拉回 Password
- [ ] **AC 8 (Popup 回归)**: Given popup window 模式（非 side panel），When 执行以上所有场景，Then 原有行为不变
- [ ] **AC 9 (Readonly 回归)**: Given 账户锁定 `attempt === 0`，When side panel 登录页显示，Then Password 处于 readonly 状态，blur re-focus 不触发

## Additional Context

### Dependencies

无外部依赖变更。修改仅涉及 Password 组件内部 focus 逻辑和 PanelManager 关闭逻辑。

### Testing Strategy

手动测试矩阵（重点：慢机器复现 + 正常机器回归 + 焦点陷阱检查）：

| # | 场景 | 页面 | 操作步骤 | 期望 |
|---|------|------|---------|------|
| 1 | 签名触发 Login autoFocus | Login | 慢机器：页面 Approve → side panel 弹出 | Password 自动 focus |
| 2 | 绑定触发 Login autoFocus | Login | 页面 Bind PK → side panel 弹出 | Password 自动 focus |
| 3 | 交替点击焦点 | Login | 点插件外 → 点回 → 点外 → 点回（循环 4 次） | 每次点回都获取焦点，无立即灭现象 |
| 4 | 图标打开 | Login | 点击 Chrome 扩展图标 | 首先路由到 /login → autoFocus |
| 5 | Initialize 两阶段 | Initialize | 输入初始 PIN → 切换到 confirm | confirm Password 自动 focus |
| 6 | Reset PIN confirm | Reset PIN | 验证旧 PIN → 切换到 confirm | confirm Password 自动 focus |
| 7 | PinPopup（导入） | Key Import | 选文件 → 点 Import Now | PinPopup Password 自动 focus |
| 8 | PinPopup（导出） | Key Export | 点 Export Now | PinPopup Password 自动 focus |
| 9 | 焦点陷阱检查 | Any Password 页面 | Password 有焦点 → 点面板内其他按钮/链接 | 焦点不抢回，停留在用户点击的元素 |
| 10 | Readonly 场景 | Login | 账户锁定 `attempt===0` | readonly，blur re-focus 不触发 |
| 11 | 签名完成关闭 | TaskHome | 完成最后一个 task 签名 | Side panel 自动关闭 |
| 12 | Popup window 回归 | All | popup 模式下测试 1-11 | 行为不受影响 |
| 13 | 正常机器基础 | All | 正常机器 Smoke 测试 | 功能回归正常 |
| 14 | 慢机器全页面 | All Password 页面 | 慢机器上逐一测试 | 每个页面的 Password 都能 autoFocus |

### Notes

- Blur re-focus 是防御性修复。Chrome 未来可能会修复 side panel 的 focus 行为，届时可移除此机制。
- `forceHide` 通过 disable→enable toggle 实现，但在调用链中会短暂闪烁（< 1 frame），是当前 Chrome API 限制下的最优解。
- 已有 spec `tech-spec-fix-password-autofocus-all-pages.md`（2026-05-19，status: ready-for-dev）修复了 PinPopup/ResetPIN/Export 页面的 autoFocus prop 缺失。两个 spec 互补：本 spec 修复 Password 组件内部 focus 机制（覆盖所有使用场景），前一个 spec 修复 autoFocus prop 缺失。

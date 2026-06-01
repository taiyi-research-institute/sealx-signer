---
title: 'Restore Password Caret Styling and Auto-Focus'
slug: 'restore-password-caret-and-autofocus'
created: '2026-05-18'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['TypeScript', 'React', 'CSS3', 'Chrome Extension API']
files_to_modify: ['extension/src/entries/popup/components/password/index.tsx', 'extension/src/entries/popup/components/password/styles.css']
code_patterns: ['activeIndex for caret placement', 'autoFocus useLayoutEffect timer chain', 'onFocus/onBlur state toggle', 'capture input pattern (opacity:0 hidden input)']
test_patterns: []
---

# Tech-Spec: Restore Password Caret Styling and Auto-Focus

**Created:** 2026-05-18

## Overview

### Problem Statement

Commit `4cef36a` 重构了 Password 组件，从 6 个 `<input>` 改为 1 个隐藏 capture input + 6 个 `<div>` 视觉显示。两个问题：

1. **Caret 不可见**：capture input 有 `caret-color: transparent` + `opacity: 0`，原生光标被完全隐藏。虽然 `styles.css` 中有 `body[popup-mode='sidepanel'] .password-caret` 覆盖规则，但**没有 `.password-caret` 基础定义**，且 JSX 中从未渲染该元素。
2. **Auto-focus 无反馈**：`focusInput()` 逻辑正确（多层 timer + visibilitychange 监听），但 capture input 是透明的，用户看不到任何焦点指示（无闪烁光标、无边框高亮）。

### Solution

1. **创建** `.password-caret` 基础 CSS（尺寸 + 颜色 + 闪烁动画）和 `@keyframes password-caret-blink`
2. 在活跃的密码格子 `<div>` 中条件渲染 `<span className="password-caret" />` 自定义光标元素
3. 保留现有的 6 个 `<div>` 边框样式不变，不修改布局
4. 移除 `window.focus()` 确保 `autoFocus` 机制稳定：进入页面时 password 自动获取焦点 + 光标可见

### Scope

**In Scope:**
- `password/styles.css` — 创建 `.password-caret` 基础 CSS + `@keyframes password-caret-blink`
- `password/index.tsx` — 新增 `isFocused` state + 条件渲染 `.password-caret` + 移除 `window.focus()`

**Out of Scope:**
- 边框、布局、密码框尺寸改动
- 其他组件的 focus 行为
- 键盘输入逻辑改动

## Context for Development

### Deep Investigation Results (Step 2)

#### `.password-caret` CSS Audit — CRITICAL FINDING

**Base `.password-caret` styles DO NOT EXIST.** Grep across entire codebase:

- `styles.css` line 98-99: Only `body[popup-mode='sidepanel'] .password-caret` override (3.16×30.38px) — references a base class that was never defined
- `key-manage/password.css` line 27: `.key-manage-password .password:focus .password-caret` — same pattern, no base
- `@keyframes password-caret-blink`: **ZERO results** — animation not defined anywhere
- `password-caret` in TSX: **ZERO results** — never rendered by any component

**Conclusion:** Pre-refactor, caret was native browser caret in `<input>` elements. `.password-caret` CSS rules were added by a previous "fix side panel" spec that **assumed the base styles existed** — they never did. Task 3 is a **CREATE** task, not verify.

#### Shadow DOM Assessment — NOT a concern

Password component is used exclusively in popup pages (login, initialize, reset-pin), which are standalone extension pages with their own `<head>`. Vite injects `styles.css` directly into the popup page's document. Shadow DOM does not apply here.

#### `activeIndex` Logic — Correct

```
activeIndex = chars.findIndex(c => !c)  // first empty slot
           || Math.min(displayPassword.length, 5)  // or last slot if full
```
This directly tells us which `.password` div to place the caret in.

#### autoFocus Mechanism

`focusInput()` chain: `window.focus()` → `input.focus({ preventScroll: true })` → `setSelectionRange()`
Triggered by: `useLayoutEffect` with timers `[0, 50, 120, 250, 500, 900]ms` + `requestAnimationFrame`
Also by: `visibilitychange`, `window.focus`, `pageshow` events

`window.focus()` in Chrome Extension side panel context may silently fail — confirmed it's safe to remove and only keep `input.focus()`.

### Codebase Patterns

- Password 组件架构：1 hidden capture input (`opacity: 0, caret-color: transparent`) + 6 `<div>` 视觉显示
- `activeIndex` 计算逻辑：`chars.findIndex(c => !c)` — 直接对应光标待插入位置
- `autoFocus` prop 通过多层 timer 延迟调用 `focusInput()`，也有 visibility/focus/pageshow 事件回退
- `password-container` 有 `cursor: text` + `onMouseDown`/`onClick` → `focusInput()` — 点击容器自动聚焦

### Files to Reference

| File | Line | Anchor Point |
| ---- | ---- | ------------ |
| `extension/src/entries/popup/components/password/index.tsx` | 26 | `activeIndex` — 光标定位逻辑 |
| `extension/src/entries/popup/components/password/index.tsx` | 38-45 | `focusInput()` — 聚焦 + `window.focus()` 需移除 |
| `extension/src/entries/popup/components/password/index.tsx` | 47-55 | `useLayoutEffect` + 多层 timer |
| `extension/src/entries/popup/components/password/index.tsx` | 168-188 | capture input 渲染 |
| `extension/src/entries/popup/components/password/index.tsx` | 189-199 | 6 个 `<div>` 渲染 — caret 需插入此处 |
| `extension/src/entries/popup/components/password/styles.css` | 29-49 | `.password` 基础样式（边框、尺寸） |
| `extension/src/entries/popup/components/password/styles.css` | 98-101 | `.password-caret` sidepanel 覆盖规则 |
| `extension/src/entries/popup/components/login/index.tsx` | 117 | Password 使用 — `autoFocus` |
| `extension/src/entries/popup/components/initialize/index.tsx` | 228 | Password 使用 — `autoFocus` |
| `extension/src/entries/popup/components/reset-pin/index.tsx` | 152 | Password 使用 — `autoFocus` |

### Technical Decisions

- 保留 capture input 架构（不退回 6 个 `<input>`）
- `.password-caret` 基础样式需**从头创建**（`width: 4.74px; height: 45.57px; background: var(--sx-brand);`）
- `@keyframes password-caret-blink` 需**从头创建**（`0%,100%{opacity:1} 50%{opacity:0}` step-end）
- 光标定位用 `activeIndex`（已有逻辑），条件渲染 `<span className="password-caret" />` 到 `{i === activeIndex}` 的 div 内
- Focus 检测用 `onFocus`/`onBlur` 事件 + `useState<boolean>` 触发重渲染（简单场景 state 滞后风险可控）
- Sidepanel 尺寸覆盖规则（lines 98-101）已有，直接生效
- Shadow DOM 不是问题 — popup 页面独立渲染，不在 content script Shadow DOM 内

## Implementation Plan

### Tasks

- [ ] **Task 1: 创建 `.password-caret` 基础 CSS + 闪烁动画**
  - File: `extension/src/entries/popup/components/password/styles.css`
  - Action:
    1. 新增 `.password-caret` 基础样式：
       ```css
       .password-caret {
           width: 4.74px;
           height: 45.57px;
           background-color: var(--sx-brand);
           border-radius: 2px;
           animation: password-caret-blink 1s step-end infinite;
       }
       ```
    2. 新增 `@keyframes password-caret-blink`：
       ```css
       @keyframes password-caret-blink {
           0%, 100% { opacity: 1; }
           50% { opacity: 0; }
       }
       ```
    3. 已有 sidepanel 覆盖规则（lines 98-101）自动生效——不需要改动
  - Notes: 参考 key-manage 已验证的 sidepanel caret 尺寸（3.16×30.38px）

- [ ] **Task 2: 渲染 `.password-caret` 元素到当前活跃格子**
  - File: `extension/src/entries/popup/components/password/index.tsx`
  - Action:
    1. 新增 `isFocused` state：`const [isFocused, setIsFocused] = useState(false)`
    2. 在 capture input 上绑定 `onFocus={() => setIsFocused(true)}` 和 `onBlur={() => setIsFocused(false)}`
    3. 在 `activeIndex` 对应的 `.password` div 中条件渲染：`{isFocused && i === activeIndex && displayPassword.length < 6 && <span className="password-caret" />}`
    4. caret 元素放在 `password-mask-dot` 同级（div 已有 `display: flex; align-items: center; justify-content: center`，自动居中）
  - Notes: 简单场景下 state 滞后风险可控（timer 在 ms 级别，onFocus 在微任务队列）

- [ ] **Task 3: 移除 `window.focus()` 调用**
  - File: `extension/src/entries/popup/components/password/index.tsx` line ~40
  - Action:
    1. 删除 `focusInput()` 中的 `window.focus()` 调用，仅保留 `input.focus({ preventScroll: true })` 和 `setSelectionRange()`
    2. 验证 autoFocus timer 在 side panel 和 popup 两种模式下均成功触发 `onFocus` → `isFocused=true` → caret 渲染
  - Notes: `window.focus()` 在 Chrome Extension 上下文中可能无效，去掉无副作用

### Risks & Mitigations (from Pre-mortem)

| 风险 | 缓解 |
|------|------|
| `.password-caret` CSS 不存在（base + keyframes） | Task 1 从头创建，非验证任务 |
| side panel `window.focus()` 失败 | Task 3 去掉 `window.focus()`，只用 `input.focus()` |
| 输满 6 位后光标残留 | AC3 覆盖——`i === activeIndex`，满时 activeIndex=5 但 AC3 要求无光标——需确认满时 `isFocused && chars[5]` 情况下的行为 |
| Sidepanel caret 尺寸比例失调 | 已有覆盖规则（3.16×30.38px）直接生效，无需额外处理 |

### Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC1 | Password 组件挂载，autoFocus=true | 页面渲染完成 | Capture input 获得焦点，当前待输入格显示闪烁光标 |
| AC2 | 已输入 2 个字符，input 保持 focus | 页面渲染 | 光标闪烁在第 3 个格子里 |
| AC3 | 输入 6 个字符（满），input 保持 focus | 页面渲染 | 无光标显示（`displayPassword.length >= 6` 时隐藏 caret） |
| AC4 | input 失去焦点（点击其他地方） | blur 事件触发 | 光标消失 |
| AC5 | Side Panel 模式，password autoFocus | 页面渲染 | 光标按 sidepanel 缩放尺寸显示（3.16×30.38px） |
| AC6 | Popup 模式，password autoFocus | 页面渲染 | 光标按默认尺寸显示（4.74×45.57px） |
| AC7 | 已输入 3 位，input 已 blur | 用户重新点击 password 容器 | 光标在第 4 格恢复闪烁 |

## Additional Context

### Dependencies

- `body[popup-mode='sidepanel']` 属性由 `usePopupType` hook 保证
- `styles.css` 中已有 `body[popup-mode='sidepanel'] .password-caret` 覆盖规则（3.16×30.38px），无需改动
- 无外部依赖 — 纯 CSS + React state 改动

### Testing Strategy

- 打开 Side Panel，检查 login 页面 password 自动获得焦点并显示闪烁光标
- 输入字符，验证光标移动到下一个格子
- 输入满 6 位，验证光标消失
- 点击页面其他区域，验证光标消失
- 重新点击 password 区域，验证光标恢复

### Notes

- `.password-caret` 基础样式和 `@keyframes password-caret-blink` **不存在**，需从头创建
- Sidepanel 覆盖规则（3.16×30.38px）在 `styles.css` lines 98-101 已存在，创建 base 后自动生效
- `window.focus()` 移除后 autoFocus 在 Chrome Extension side panel 环境下更可靠
- 输满 6 位时用 `displayPassword.length < 6` 守卫隐藏光标

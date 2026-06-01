---
title: 'Fix Side Panel Button Size and Password Layout Compression'
slug: 'fix-side-panel-button-and-password'
created: '2026-05-11'
status: 'in-progress'
stepsCompleted: [1, 2, 3]
tech_stack: ['TypeScript', 'React', 'Tailwind CSS v4', 'Chrome Extension API', 'CSS3']
files_to_modify: ['extension/src/components/button/index.tsx', 'extension/src/components/button/styles.css', 'extension/src/entries/popup/components/password/styles.css']
code_patterns: ['body[popup-mode=sidepanel] CSS selector', 'key-manage password flex:1 pattern', 'rem vs px scaling', 'CSS !important overrides']
test_patterns: []
---

# Tech-Spec: Fix Side Panel Button Size and Password Layout Compression

**Created:** 2026-05-11

## Overview

### Problem Statement

Side Panel 模式下（~350px 宽度）存在两个 UI 问题：
1. **按钮过高**：Button 组件默认 `pt-[1.125rem] pb-[1.375rem]` + `text-[1.5rem]`，即使经过 sidepanel 81.67% 缩放仍高达 ~70px，视觉上纵向过于膨胀
2. **密码框挤压**：Password 组件每个框固定 `width: 70px`，6 框共需 420px；某些电脑/环境下 Side Panel 默认打开宽度小于此值，导致密码框溢出挤压变形。且改为 `flex:1` 弹性后，`height:76px`、光标 `4.74×45.57px`、`font-size:32px`、`line-height` 等固定像素值在窄框下会比例失调，需一并缩放

### Solution

1. Button 组件通过 CSS 检测 `body[popup-mode='sidepanel']` 状态，在 sidepanel 模式下应用紧凑尺寸（缩小 padding + font-size）
2. Password 组件参照 key-manage 已有的弹性方案，在 sidepanel 模式下：
   - `width: auto; flex: 1; max-width: 70px` — 弹性均分但不超过原始宽度
   - 同步缩放 `height`、`font-size`、`line-height`、光标尺寸，保持比例协调

### Scope

**In Scope:**
- `components/button/index.tsx` — 添加 sidepanel 感知的紧凑样式
- `components/password/styles.css` — sidepanel 模式弹性布局
- login / initialize / reset-pin 页面的 Password 使用场景

**Out of Scope:**
- Popup / action / tab 模式按钮尺寸（保持不变）
- 其他页面布局调整
- Chrome Side Panel 宽度控制（API 不支持）

## Deep Investigation Results (Step 2)

### Button Component Analysis

**Current state** (`src/components/button/index.tsx`):
- All styling via Tailwind arbitrary-value classes, **no sidepanel-awareness**
- `baseStyles`: `pt-[1.125rem] pb-[1.375rem] text-[1.5rem] leading-[1.75]` — uses `rem` (auto-scales to 81.67% in sidepanel), but even scaled button is ~70px tall
- Vertical padding total: 18px + 22px = 40px (in rem, → ~32.7px scaled) + text line-height ~42px (→ ~34.3px scaled) = ~67px effective height
- Primary variant: `bg-[#000] text-[#fff] border-[#000]`, Secondary: `bg-transparent text-[#000] border-[rgba(0,0,0,0.06)]`
- **No stable CSS class** to target from external stylesheet — Tailwind arbitrary classes like `rounded-[34px]` are not reliable CSS selectors

**Implementation approach for Button:**
- **Need a stable class name** on the button element (e.g., `sealx-button`) to target via `body[popup-mode='sidepanel'] .sealx-button` selector
- Compact dimensions: reduce `pt-[1.125rem]` → `pt-[0.5rem]`, `pb-[1.375rem]` → `pb-[0.625rem]`, `text-[1.5rem]` → `text-[1rem]`
- Best approach: add a co-located `styles.css` file + import, or add JS-based conditional class switching
- **Decision**: Add `.sealx-button` class to the button element, create `src/components/button/styles.css` with sidepanel overrides

### Password Component Analysis

**Root cause of compression:**
- `.password { width: 70px; height: 76px }` — **hardcoded px**, does NOT scale with sidepanel `font-size: 81.67%`
- 6 boxes × 70px = 420px minimum width; side panel can be as narrow as ~300px
- Login uses `<Password className='w-full password-input-wrapper'>` inside `<div className='mx-auto px-[1.5rem] w-full flex'>`
- Initialize uses same pattern, with dual Password components (password + confirm)

**Current fixed dimensions that need proportional scaling in sidepanel:**
| Property | Default (px) | Sidepanel target | Scaling ratio |
|----------|-------------|------------------|---------------|
| `.password` width | 70px | auto; flex:1; max-width:70px | elastic |
| `.password` height | 76px | ~55px | ~72% |
| `.password` font-size | 32px | ~24px | ~75% |
| `.password` line-height | 83px | ~60px | ~72% |
| `.password::after` line-height | 95.5px | ~68px | ~71% |
| `.password-caret` width | 4.74px | 3.16px | ~67% |
| `.password-caret` height | 45.57px | 30.38px | ~67% |

**Reference pattern** (`key-manage/password.css` lines 1-9):
```css
.key-manage .password { flex: 1; height: 72px !important; }
.key-manage-password .password:focus .password-caret { width: 3.16px !important; height: 30.38px !important; }
```
Same caret dimensions already proven in key-manage context. Use these exact values.

**Password container context:**
- `password-container` uses `flex justify-between` — with children `flex: 1`, space auto-distributes
- Parent wrapper has `px-[1.5rem]` (24px * 81.67% = ~19.6px padding each side)
- **No layout changes needed** to the container — only `.password` box sizing

### Side Panel CSS Detection Mechanism

- `body[popup-mode='sidepanel']` attribute set by `usePopupType` hook in `App.tsx`
- `html:has(body[popup-mode='sidepanel'])` applies `font-size: calc(100% * 0.8167)` — only affects `rem`/`em` units, NOT `px` values
- Existing `body[popup-mode='sidepanel'] #root` rule in `App.css` sets `width: 100%; height: 100vh;`

## Context for Development

### Codebase Patterns

- Side Panel 检测：`body` 元素上有 `popup-mode='sidepanel'` 属性（由 `usePopupType` hook 设置），CSS 可通过 `body[popup-mode='sidepanel']` 选择
- Side Panel 缩放：`html:has(body[popup-mode='sidepanel'])` 设置 `font-size: 81.67%`，rem 单位自动缩放
- key-manage 已有 Password 弹性方案：`flex: 1` 替代固定宽度（`password.css` line 5）
- Button 组件仅两个 variant：primary / secondary

### Files to Reference

| File | Line | Anchor Point |
| ---- | ---- | ------------ |
| `extension/src/components/button/index.tsx` | 26 | `baseStyles` — `pt-[1.125rem] pb-[1.375rem] text-[1.5rem]` |
| `extension/src/components/button/index.tsx` | 38-55 | Primary/secondary variant styles |
| `extension/src/entries/popup/components/password/styles.css` | 14 | `.password { width: 70px }` — 根因 |
| `extension/src/entries/popup/components/password/index.tsx` | 303 | `password-container flex justify-between` |
| `extension/src/entries/popup/App.css` | 45-51 | `body[popup-mode='sidepanel'] #root` |
| `extension/src/entries/popup/components/key-manage/password.css` | 5 | `.key-manage .password { flex: 1 }` — 参考方案 |

### Technical Decisions

- **Side Panel 检测方式**：用 CSS `body[popup-mode='sidepanel']` 选择器，无需 JS 运行时判断
- **Button 紧凑尺寸**：padding 减至 `py-[0.375rem]`，font 减至 `text-[1rem]`，接近 key-manage export/import 按钮尺寸
- **Password 弹性**：sidepanel 下 `width: auto; flex: 1`，继承 key-manage 的验证方案
- **不改变 popup 模式**：所有改动仅在 `body[popup-mode='sidepanel']` 选择器下生效

## Implementation Plan

### Tasks

- [ ] **Task 1: Button 组件 sidepanel 紧凑模式**
  - File: `extension/src/components/button/index.tsx`
  - Action:
    1. 在组件内或通过全局 CSS 为 sidepanel 模式添加覆盖样式
    2. 减小 baseStyles 中的 padding 和 font-size（仅 sidepanel 生效）
    3. 保持 variant 颜色/交互不变
  - Notes: 使用 Tailwind 的 `important` 或 CSS 选择器优先级覆盖

- [ ] **Task 2: Password 组件 sidepanel 弹性布局**
  - File: `extension/src/entries/popup/components/password/styles.css`
  - Action:
    1. 添加 `body[popup-mode='sidepanel'] .password` 规则
    2. 设置 `width: auto; flex: 1; max-width: 70px` — 弹性均分，超过 70px 不继续放大
    3. 等比例缩小 `height`（76px → ~55px）、`font-size`（32px → ~24px）
    4. 调整 `line-height` 和 `::after` line-height 使文字居中
    5. 缩小光标 `.password-caret` 尺寸（参照 key-manage 3.16×30.38px）
  - Notes: 参照 key-manage/password.css 的已有弹性方案

### Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC1 | Side Panel 模式，任意页面使用 Button | 页面渲染 | 按钮高度显著减小，padding 紧凑，视觉协调 |
| AC2 | Popup/action/tab 模式，任意页面使用 Button | 页面渲染 | 按钮尺寸不变（与修改前一致） |
| AC3 | Side Panel 宽度 350px，login 页面 | 输入密码 | 6 个密码框均分可用宽度，无挤压无溢出 |
| AC4 | Side Panel 宽度 500px，login 页面 | 输入密码 | 密码框正常显示，空间充裕 |
| AC5 | Popup 模式，login 页面 | 输入密码 | 密码框保持 70px 固定宽度（行为不变） |
| AC6 | Side Panel 模式，initialize 页面双密码 | 输入 PIN + 确认 PIN | 两组密码框均弹性适配，无重叠 |

## Additional Context

### Dependencies

- 无外部依赖
- 依赖 `body[popup-mode='sidepanel']` 属性正确设置（由 `usePopupType` hook 保证）

### Testing Strategy

- 手动打开 Side Panel，检查 login/initialize 页面密码框布局
- 拖拽调整 Side Panel 宽度到最小，验证密码框不挤压
- 切换 popup 模式，确认按钮/密码框尺寸不变
- 检查 bind-pubkey、task-home 等页面的按钮尺寸

### Notes

- Chrome Side Panel 宽度由浏览器控制，CSS 只能适配不能撑开
- 若后续需要更精细的按钮尺寸分级，可引入 size prop（如 `size="compact"` / `size="normal"`）

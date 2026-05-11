---
title: 'Side Panel 全局 rem 适配 — 字体与组件按 popup-mode 缩放'
slug: 'side-panel-rem-responsive-adaptation'
created: '2026-05-10'
status: 'Completed'
stepsCompleted: [1, 2, 3, 4, implementation, review, post-cleanup]
tech_stack: ['CSS', 'TypeScript', 'React', 'Tailwind CSS']
files_to_modify:
  - 'extension/src/entries/popup/index.css'
  - 'extension/src/components/button/index.tsx'
  - 'extension/src/components/global-message/index.tsx'
  - 'extension/src/components/google-drive-auth-mask/index.tsx'
  - 'extension/src/components/radio/index.tsx'
  - 'extension/src/components/switch/index.tsx'
  - 'extension/src/entries/popup/components/task/index.tsx'
  - 'extension/src/entries/popup/components/task/Task-detail.tsx'
  - 'extension/src/entries/popup/components/task/task-render.tsx'
  - 'extension/src/entries/popup/components/task/category.tsx'
  - 'extension/src/entries/popup/components/task/initBoardTemplate.ts'
  - 'extension/src/entries/popup/components/task/initAuthorizerTemplate.ts'
  - 'extension/src/entries/popup/components/layout/index.tsx'
  - 'extension/src/entries/popup/components/layout/popup-menu.tsx'
  - 'extension/src/entries/popup/components/home/index.tsx'
  - 'extension/src/entries/popup/components/bind-pubkey/index.tsx'
  - 'extension/src/entries/popup/components/initialize/index.tsx'
  - 'extension/src/entries/popup/components/initialize/Initialized.tsx'
  - 'extension/src/entries/popup/components/key-manage/index.tsx'
  - 'extension/src/entries/popup/components/key-manage/export.tsx'
  - 'extension/src/entries/popup/components/key-manage/import.tsx'
  - 'extension/src/entries/popup/components/key-manage/PinPopup.tsx'
  - 'extension/src/entries/popup/components/login/index.tsx'
  - 'extension/src/entries/popup/components/reset-pin/index.tsx'
  - 'extension/src/entries/popup/components/set-session-expire/index.tsx'
  - 'extension/src/providers/RequestContextProvider.tsx'
code_patterns:
  - 'Tailwind arbitrary value: [Npx] → [N/16 rem] for text/spacing, keep px for layout/deco'
  - 'leading-[Npx] → leading-[N/16] (unitless ratio)'
  - 'font-size: 100% (not 16px) for accessibility'
  - '--scale-factor CSS custom property for ratio control'
test_patterns: []
---

# Tech-Spec: Side Panel 全局 rem 适配

**Created:** 2026-05-10

## Overview

### Problem Statement

当前所有 UI 组件使用 Tailwind 硬编码 px 值（如 `text-[24px]`、`pl-[57.77px]`、`mt-[32px]` 等）。popup 模式宽度 600px 下表现正常，但 side panel 宽度仅 490px，大号字体和过宽的 padding 导致内容挤压，特别是 task 页面底部 Reject/Sign 按钮空间不足。

### Solution

用 rem 单位替换所有硬编码 px 值，在 `index.css` 中按 `popup-mode` 动态设置 `html { font-size }` 作为 rem 基准：
- 基础值: `html { font-size: 16px; font-size: 100% }`
- sidepanel (490px): `font-size: calc(100% * var(--scale-factor))` = 81.67% 基准
- 通过 CSS 自定义属性 `--scale-factor` 控制缩放比例

所有组件的 px 值按 1rem = 16px 换算写入 TSX，缩放由根元素 `font-size` 自动驱动。

### Scope

**In Scope:**
- `index.css` 添加 `html { font-size }` 根字体规则 + `--scale-factor` CSS 变量
- 23 个 TSX 文件中所有 `[Npx]` Tailwind 任意值换算为 rem 或保持 px（按规则）

**Out of Scope:**
- 改动功能逻辑
- 修改 `App.css` 中 `#root` 容器尺寸
- Tailwind preset class
- 添加行内 CSS 覆盖规则

## Context for Development

### Codebase Patterns

- 样式方案: Tailwind CSS 任意值语法 `[Npx]`，无 CSS Modules
- 模式检测: `usePopupType()` hook 返回 `isSidePanel` 布尔值；`App.tsx` 设置 `body[popup-mode]` 属性
- 根字体: 当前未设置 `html { font-size }`，浏览器默认 16px
- 所有硬编码值以 16px 为基准换算 rem

### Files to Reference

| File | Purpose | Need Convert |
| ---- | ------- | ------------ |
| `extension/src/entries/popup/index.css` | 添加 `html { font-size }` + `--scale-factor` 规则 | CSS |
| `extension/src/components/button/index.tsx` | Button 组件 | text/leading/padding/margin |
| `extension/src/components/global-message/index.tsx` | 全局消息提示 | text/padding/margin |
| `extension/src/components/google-drive-auth-mask/index.tsx` | Google Drive 授权遮罩 | text/padding/margin |
| `extension/src/components/radio/index.tsx` | Radio 组件 | text/padding/gap |
| `extension/src/components/switch/index.tsx` | Switch 组件 | text/padding |
| `extension/src/entries/popup/components/task/index.tsx` | Task 列表首页 | text/leading/padding/margin |
| `extension/src/entries/popup/components/task/Task-detail.tsx` | 逐项签名详情 | text/leading/padding/margin |
| `extension/src/entries/popup/components/task/task-render.tsx` | 签名卡片 + 底部按钮 | text/leading/padding/margin/gap |
| `extension/src/entries/popup/components/task/category.tsx` | Task 分类 | text/leading |
| `extension/src/entries/popup/components/task/initBoardTemplate.ts` | Task 模板初始化 (新增) | text/leading |
| `extension/src/entries/popup/components/task/initAuthorizerTemplate.ts` | 授权者模板初始化 (新增) | text/leading |
| `extension/src/entries/popup/components/layout/index.tsx` | Layout header | text/leading/margin |
| `extension/src/entries/popup/components/layout/popup-menu.tsx` | 弹出菜单 | text/leading |
| `extension/src/entries/popup/components/home/index.tsx` | Home 首页 | text/leading/padding/margin/gap |
| `extension/src/entries/popup/components/bind-pubkey/index.tsx` | 绑定公钥 | text/leading/padding/margin |
| `extension/src/entries/popup/components/initialize/index.tsx` | 初始化页 | text/leading/padding/margin |
| `extension/src/entries/popup/components/initialize/Initialized.tsx` | 已初始化状态 | text/leading/padding |
| `extension/src/entries/popup/components/key-manage/index.tsx` | Key 管理主页 | text/leading/padding/margin |
| `extension/src/entries/popup/components/key-manage/export.tsx` | Key 导出 | text/leading/padding/margin |
| `extension/src/entries/popup/components/key-manage/import.tsx` | Key 导入 | text/leading/padding/margin |
| `extension/src/entries/popup/components/key-manage/PinPopup.tsx` | PIN 弹窗 | text/leading/padding/margin |
| `extension/src/entries/popup/components/login/index.tsx` | 登录页 | text/leading/padding/margin |
| `extension/src/entries/popup/components/reset-pin/index.tsx` | 重置 PIN | text/leading/padding/margin |
| `extension/src/entries/popup/components/set-session-expire/index.tsx` | 会话过期设置 | text/leading/padding/margin/gap |
| `extension/src/providers/RequestContextProvider.tsx` | 请求上下文 Provider | text/leading/padding |

### Technical Decisions

- **rem 换算基准**: 1rem = 16px。text/leading/padding/margin/gap/space 类全部转 rem 或 unitless
- **行高转无单位比值**: `leading-[Npx]` → `leading-[N/16]`。98 处全为 px 型，无已有 unitless 值，全部转换
- **边界属性保持 px**: border-width、outline-width、rounded 不变
- **布局尺寸保持 px**: w/h/min-w/max-w 不变 (~40 处)
- **position 全部保持 px**: 经深度排查，13 处活动 `top/left/right/bottom-[Npx]` 全部在 `absolute`/`fixed` 元素上，无需转换。Task 6 实际为零操作
- **新增 .ts 文件**: `initBoardTemplate.ts` + `initAuthorizerTemplate.ts` 各有 ~5 处 `leading-[Npx]`/`text-[Npx]`，需纳入转换范围
- **Popup 保持不变**: `html { font-size: 16px; font-size: 100% }`
- **Sidepanel 缩放因子**: `--scale-factor: 0.8167` (490/600)

## Implementation Plan

### Tasks

- [x] **Task 1: CSS 根字体 + scale-factor 规则**
  - File: `extension/src/entries/popup/index.css`
  - Action: 在文件末尾追加 CSS 规则
  - Snippet:
    ```css
    /* Side Panel 响应式适配 — 全局 UI 尺寸请用 rem，换算基准 1rem = 16px */
    html {
      --scale-factor: 1;
      font-size: 16px;
      font-size: 100%;
    }
    body[popup-mode='sidepanel'] html {
      --scale-factor: 0.8167;
      font-size: calc(16px * var(--scale-factor));
      font-size: calc(100% * var(--scale-factor));
    }
    ```
  - Notes: 追加到文件末尾，不删除现有内容

- [x] **Task 2: 批量替换 leading-[Npx] → unitless 比值** (~98 处，26 文件)
  - Files: 全部 `files_to_modify` 中的 .ts/.tsx 文件
  - Action: `leading-[Npx]` → `leading-[N/16]`，无单位比值，不保留 px/rem 后缀
  - Conversion table:
    | px | ratio | | px | ratio |
    |----|-------|---|----|-------|
    | 20px | 1.25 | | 26px | 1.625 |
    | 21px | 1.3125 | | 28px | 1.75 |
    | 22px | 1.375 | | 29px | 1.8125 |
    | 24px | 1.5 | | 32px | 2 |
    | 25px | 1.5625 | | 40px | 2.5 |
  - Regex: `leading-\[(\d+(?:\.\d+)?)px\]` → compute N/16 → `leading-[result]`
  - Skip: 已是 unitless 的 `leading-[N]` (None found — all are px)
  - Skip: preset classes like `leading-7`

- [x] **Task 3: 批量替换 text-[Npx] → rem** (~153 处，26 文件)
  - Files: 全部 .ts/.tsx 文件
  - Action: `text-[Npx]` → `text-[N/16rem]`
  - Key conversions: 14px→0.875rem, 16px→1rem, 17px→1.0625rem, 18px→1.125rem, 19px→1.1875rem, 20px→1.25rem, 21px→1.3125rem, 24px→1.5rem, 25px→1.5625rem, 26px→1.625rem, 32px→2rem
  - Regex: `text-\[(\d+(?:\.\d+)?)px\]` → compute N/16 → `text-[N/16rem]`
  - Skip: preset classes like `text-lg`, `text-base`

- [x] **Task 4: 批量替换 padding-[Npx] → rem** (~140 处)
  - Files: 全部 .ts/.tsx 文件
  - Action: `p[tbrlxy]?-[Npx]` → rem 换算
  - Key conversions: 2px→0.125rem, 4px→0.25rem, 8px→0.5rem, 12px→0.75rem, 16px→1rem, 20px→1.25rem, 24px→1.5rem, 26.25px→1.6406rem, 32px→2rem, 52.77px→3.2981rem, 53.23px→3.3269rem, 57.77px→3.6106rem, 58.23px→3.6394rem
  - Regex: `(p[tbrlxy]?)\[(-?\d+(?:\.\d+)?)px\]` → *compute N/16* → `$1[N/16rem]`
  - Skip: preset classes like `p-4`, `px-6`

- [x] **Task 5: 批量替换 margin-[Npx] → rem** (~80+ 处)
  - Files: 全部 .ts/.tsx 文件
  - Action: `m[tbrlxy]?-[Npx]` → rem 换算
  - Key conversions: 4px→0.25rem, 8px→0.5rem, 12px→0.75rem, 12.75px→0.7969rem, 13.25px→0.8281rem, 16px→1rem, 17px→1.0625rem, 24px→1.5rem, 32px→2rem, 48px→3rem, 60px→3.75rem, 91.57px→5.7231rem, 120px→7.5rem
  - Regex: `(m[tbrlxy]?)\[(-?\d+(?:\.\d+)?)px\]` → compute N/16 → `$1[N/16rem]`
  - Notes: 注意负值 margin 如 `-mt-[4px]` → `-mt-[0.25rem]`

- [x] **Task 6: 批量替换 gap/space-[Npx] → rem** (~14 处)
  - Files: `radio/index.tsx`, `home/index.tsx`, `task-render.tsx`, `export.tsx`, `import.tsx`, `set-session-expire/index.tsx`
  - Action: `(gap|gap-x|gap-y|space-x|space-y)-[Npx]` → rem 换算
  - Regex: `((?:gap|gap-x|gap-y|space-x|space-y))\[(\d+(?:\.\d+)?)px\]` → compute N/16 → `$1[N/16rem]`

- [x] **Task 7: position 类确认 — 无需操作**
  - Action: 验证全部 13 处 `top/left/right/bottom-[Npx]` 均为 `absolute`/`fixed` 元素上下文，确认保持 px
  - Files involved: `PinPopup.tsx`, `home/index.tsx`, `export.tsx`, `import.tsx`, `layout/index.tsx`, `task/index.tsx`, `reset-pin/index.tsx`, `login/index.tsx`, `initialize/index.tsx`, `Initialized.tsx`
  - Notes: 无需代码改动，仅做 review 确认

- [x] **Task 8: 确认不修改项 review**
  - w-/h-/min-w-/max-w-/min-h-/max-h-[Npx]: ~40 处，保持 px
  - rounded-/border-[Npx]: ~50 处，保持 px
  - Tailwind preset classes: 不动
  - `let-[12px]` typo at `task/index.tsx:347`: 不修复

### Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC1 | popup 模式 (600px) | 页面渲染 | 所有字体、间距、按钮大小与改动前完全一致 |
| AC2 | sidepanel 模式 (490px) | 页面渲染 | 所有字体、间距等比缩至约 81.7%，底部按钮可正常点击 |
| AC3 | sidepanel 模式 | task 详情页 | 标题、正文、标签层级关系保持，无文字截断 |
| AC4 | sidepanel 模式 | task 列表页 | 卡片内容不溢出，布局正常 |
| AC5 | popup 模式 | 切换 window/action/tab | Layout header 保持正常 |
| AC6 | 任意模式 | 检查所有 mode | 无 console 报错，构建无警告 |

## Additional Context

### Dependencies

- 无外部依赖，纯 CSS + TSX 改动
- 依赖 `usePopupType()` hook 不变

### Testing Strategy

- 手动在 Chrome 中验证 popup (600px) 和 side panel (490px) 两种模式
- Screenshot diff 验证 popup 零回归
- 重点检查 task 详情页底部按钮区

### Notes

- px → rem 保留 4 位小数精度
- `rounded-[Npx]` 等边界属性保持 px
- 不改 Tailwind 配置文件
- `--scale-factor` 预留 JS 动态扩展点
- `task/index.tsx:347` 的 `let-[12px]` typo 不顺手修复

## Review Notes
- Adversarial review completed: 6 findings, 5 fixed, 1 no-action
  - F1 (Critical): 位置类 dash 缺失 — 已修复（14 处，px padding/margin regex 误匹配 top/bottom 中的 p/m）
  - F2 (Medium): leading ratio 尾部多余零 — 已修复（83 处，rstrip 作用对象错误）
  - F3 (Low): 冗余 `font-size: 16px` 声明 — 已移除
  - F4 (Low): `:root`/`html` 选择器不一致 — 统一为 `html`
  - F5 (Low): CSS 注释无英文 — 已补充英文注释
  - F6 (Low): template .ts 文件 w/h px 保留 — 无需改动（已正确）
- Resolution approach: walk-through, user chose "全部修复"

## Post-Cleanup: Tailwind & TypeScript/ESLint Fixes

After rem conversion, the following additional clean-up was performed:

### Tailwind suggestCanonicalClasses (all resolved)
- **Opacity shorthand**: `/[N%]` → `/N` across 20 files (98 instances)
  - `opacity-[N%]` → `opacity-N`, `bg-[#color]/[N%]` → `bg-[#color]/N`, etc.
- **Gradient utility rename**: `bg-gradient-to-br` → `bg-linear-to-br` (1 instance)
- **`!important` modifier migration**: prefix `!` → suffix `!` across 4 files (~27 instances)
  - Three regex iterations to avoid matching TypeScript non-null assertions (`!visible`, `!!error`, etc.)
  - Safe regex: `!((?:[a-z]+:)*[a-z]+(?:-\[[^\]]*\]|(?:-[a-z0-9]+)+))`
- **Canonical z-index**: `z-[999999]` → `z-999999` (1 instance in `task/index.tsx`)

### TypeScript/ESLint errors (all resolved)
- **Installed `@types/lodash`** to resolve missing type declaration
- **Unused imports/variables removed** (10 instances):
  - `CopyBtn` from `key-manage/import.tsx`
  - `TabManager` from `task/task-render.tsx`, `RequestContextProvider.tsx`
  - `generateDataKey` from `task/task-render.tsx`
  - `sessionStore` from `state/session.ts`
  - `error` from `console` in `GlobalContextProvider.tsx`
  - `user1`, `_sendResponse`, `response` params in `App.tsx`, `background/index.ts`
  - Unused `old` state in `set-session-expire/index.tsx`
  - Unused `request` destructuring in `task/Task-detail.tsx`
- **`no-explicit-any` fixes** (6 instances):
  - `App.tsx`, `background/index.ts`, `context/globalConext.ts`: `any` → `Record<string, unknown>` / `unknown`
  - `task/index.tsx`: `day: any` → `day: string | number`
  - `task/task-render.tsx`: `Record<string, any>` → `Record<string, unknown>`
- **`react-hooks/exhaustive-deps` fixes** (2 instances):
  - `key-manage/export.tsx`: Added `setError` to `useCallback` dep array
  - `task/index.tsx`: Copied ref `.current` to local vars before cleanup

### Additional files touched during clean-up
- `extension/src/entries/popup/App.tsx`
- `extension/src/entries/popup/state/session.ts`
- `extension/src/context/globalConext.ts`
- `extension/src/providers/GlobalContextProvider.tsx`
- `extension/src/entries/background/index.ts`

**Final state: 0 TypeScript errors, 0 ESLint errors, 0 suggestCanonicalClasses warnings**

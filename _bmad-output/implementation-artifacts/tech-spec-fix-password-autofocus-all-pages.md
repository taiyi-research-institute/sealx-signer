---
title: '修复 Password 组件自动聚焦'
slug: 'fix-password-autofocus-all-pages'
created: '2026-05-19'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['React 18', 'TypeScript', 'Chrome Extension Manifest V3', 'Side Panel API']
files_to_modify:
  - 'extension/src/entries/popup/components/key-manage/PinPopup.tsx'
  - 'extension/src/entries/popup/components/reset-pin/index.tsx'
  - 'extension/src/entries/popup/components/key-manage/export.tsx'
code_patterns:
  - 'Password 组件 autoFocus prop 驱动多 timer 链式 focus'
  - '原生 <input> 使用 React autoFocus 属性'
  - 'PinPopup 弹框条件渲染，mount 时 autoFocus 自动触发'
test_patterns: ['手动测试 Chrome Extension popup/side panel 两种模式']
---

# Tech-Spec: 修复 Password 组件自动聚焦

**Created:** 2026-05-19

## Overview

### Problem Statement

登录页、Reset PIN 页、导入导出密钥页的 password 组件无法自动获取 focus。PinPopup 弹框模式也不自动 focus。用户需要手动点击输入框才能开始输入，影响使用体验。

### Solution

为所有缺少 `autoFocus` 的 Password/input 组件添加自动聚焦属性。PinPopup 条件渲染 mount 时触发 autoFocus；Reset PIN confirm 阶段切换 mount 时触发 autoFocus；export 页 recovery password input 添加 autoFocus。

### Scope

**In Scope:**
- PinPopup.tsx 添加 `autoFocus` 到 Password 组件
- Reset PIN 页 confirm Password 添加 `autoFocus`
- Export 页 recovery password input 添加 `autoFocus`

**Out of Scope:**
- Password 组件内部逻辑重构
- 样式调整
- 新增组件
- Login/Initialize 页面（已有完善 autoFocus，无需修改）
- Import 页面 recovery password（该页面有文件选择流程，recovery password 不是首要输入项，暂不加 autoFocus）

## Context for Development

### Codebase Patterns

1. **共享 Password 组件** (`password/index.tsx`) 使用 "capture input" 模式：一个隐藏 `<input>` (opacity:0) 叠在 6 个视觉 `<div>` 上方。`autoFocus` prop 触发多 timer 链式 focus（0/50/120/250/500/900ms）+ `requestAnimationFrame` + visibility/window focus/pageshow 事件重新 focus。
2. **PinPopup 组件** 是绝对定位覆盖层弹框，条件渲染（`{showPinModal && <PinPopup ... />}`），使用共享 `<Password>` 组件但**未传 `autoFocus`**。条件渲染意味着每次 mount 时 useLayoutEffect 都会重新执行。
3. **import/export 页面** 使用原生 `<input type="password">`（不是共享 Password 组件），用于 recovery password 输入，均无 autofocus。
4. **Reset PIN 页面** 有两阶段 Password：验证旧 PIN（有 autoFocus）→ 输入新 PIN confirm（无 autoFocus）。通过 `showConfirmPassword` 状态切换，条件渲染两个不同的 Password 实例。
5. **Login/Initialize 页面** 已有 `autoFocus`，Password 组件的 focus 机制完善。

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `extension/src/entries/popup/components/password/index.tsx` | 共享 Password 组件，autoFocus 实现核心 |
| `extension/src/entries/popup/components/key-manage/PinPopup.tsx` | PIN 弹框，**缺少 autoFocus**（第120-125行） |
| `extension/src/entries/popup/components/key-manage/export.tsx` | 导出密钥页，recovery password 原生 input 无 autofocus（第319-336行） |
| `extension/src/entries/popup/components/reset-pin/index.tsx` | Reset PIN 页，confirm Password 无 autoFocus（第144-151行） |
| `extension/src/entries/popup/components/login/index.tsx` | 登录页，已有 autoFocus（参考） |

### Technical Decisions

1. **PinPopup autoFocus**: 直接给 `<Password>` 添加 `autoFocus` prop。PinPopup 是条件渲染，每次 mount 时 Password 的 useLayoutEffect 会触发多 timer 链式 focus，确保弹框打开后自动获取焦点。
2. **Reset PIN confirm 阶段**: 给 confirm `<Password>` 添加 `autoFocus`。通过 `showConfirmPassword` 切换时，confirm Password mount，autoFocus 自动触发。旧 PIN 阶段和 confirm 阶段是互斥条件渲染，不会冲突。
3. **Export recovery password**: 使用 React 的 `autoFocus` 属性。页面加载后自动 focus 到第一个 recovery password 输入框。注意：确认密码输入框不加 autoFocus，避免干扰用户流程。

## Implementation Plan

### Tasks

- [ ] Task 1: PinPopup 添加 autoFocus
  - File: `extension/src/entries/popup/components/key-manage/PinPopup.tsx`
  - Action: 在第120-125行的 `<Password>` 组件上添加 `autoFocus` prop
  - 变更:
    ```tsx
    // Before:
    <Password
        password={pin}
        onChange={setPin}
        readonly={isProcessing}
        className="w-full gap-x-[0.75rem]"
    />

    // After:
    <Password
        password={pin}
        onChange={setPin}
        readonly={isProcessing}
        className="w-full gap-x-[0.75rem]"
        autoFocus
    />
    ```

- [ ] Task 2: Reset PIN confirm Password 添加 autoFocus
  - File: `extension/src/entries/popup/components/reset-pin/index.tsx`
  - Action: 在第144-151行的 confirm `<Password>` 组件上添加 `autoFocus` prop
  - 变更:
    ```tsx
    // Before:
    <Password
        key="password-confirm"
        password={confirmPassword}
        className='w-full password-confirm-input-wrapper'
        errorIndex={errorIndex}
        onChange={handleConfirmPassword}
    />

    // After:
    <Password
        key="password-confirm"
        password={confirmPassword}
        className='w-full password-confirm-input-wrapper'
        errorIndex={errorIndex}
        onChange={handleConfirmPassword}
        autoFocus
    />
    ```

- [ ] Task 3: Export 页 recovery password input 添加 autoFocus
  - File: `extension/src/entries/popup/components/key-manage/export.tsx`
  - Action: 在第319-336行的第一个 recovery password `<input>` 上添加 `autoFocus` 属性
  - 变更:
    ```tsx
    // Before:
    <input
        type={closeEye ? 'password' : 'text'}
        value={tpPin}
        onChange={(e) => { ... }}
        onBlur={handleTpPinBlur}
        placeholder='Enter recovery password'
        className={...}
        aria-label='Recovery password'
    />

    // After:
    <input
        autoFocus
        type={closeEye ? 'password' : 'text'}
        value={tpPin}
        onChange={(e) => { ... }}
        onBlur={handleTpPinBlur}
        placeholder='Enter recovery password'
        className={...}
        aria-label='Recovery password'
    />
    ```

### Acceptance Criteria

- [ ] AC 1: Given 用户在导入密钥页点击 "Import Now"，When PinPopup 弹框显示，Then PIN 输入框自动获取焦点，光标闪烁可见
- [ ] AC 2: Given 用户在导出密钥页点击 "Export Now"，When PinPopup 弹框显示，Then PIN 输入框自动获取焦点，光标闪烁可见
- [ ] AC 3: Given 用户在 Reset PIN 页输入旧 PIN 通过验证，When 页面切换到 confirm 阶段，Then confirm Password 自动获取焦点，光标闪烁可见
- [ ] AC 4: Given 用户打开导出密钥页面，When 页面加载完成，Then recovery password 输入框自动获取焦点
- [ ] AC 5: Given 用户在 side panel 模式下操作，When 执行以上任意场景，Then autoFocus 行为与 popup 模式一致

## Additional Context

### Dependencies

无外部依赖变更。所有修改均使用现有 Password 组件的 `autoFocus` prop 和 React 原生 `autoFocus` 属性。

### Testing Strategy

手动测试矩阵（popup 模式 + side panel 模式各测一遍）：

| # | 场景 | 操作步骤 | 期望 |
|---|------|---------|------|
| 1 | 导入 PinPopup | 选文件 → 输入 recovery password → 点 Import Now | 弹框弹出后 PIN 输入框自动 focus |
| 2 | 导出 PinPopup | 填写所有字段 → 点 Export Now | 弹框弹出后 PIN 输入框自动 focus |
| 3 | Reset PIN confirm | 输入正确旧 PIN → 自动切换 | confirm Password 自动 focus |
| 4 | Export 页面加载 | 直接打开导出页 | recovery password 输入框自动 focus |
| 5 | 重复 1-4 | 在 side panel 模式下 | 行为一致 |

### Notes

- import.tsx 的 recovery password 未加 autoFocus 是因为该页面优先操作是文件选择，用户先选文件再输入密码，autoFocus 到密码框反而不符合操作流程。
- Login 和 Initialize 页面已有完善的 autoFocus 机制（多 timer 链 + 事件监听），经验证在 popup 和 side panel 模式下均可正常工作，不需要修改。

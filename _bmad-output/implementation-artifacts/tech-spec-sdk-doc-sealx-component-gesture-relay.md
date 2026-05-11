---
title: 'SDK 文档更新 — sealx-component 手势桥接与对接指南'
slug: 'sdk-doc-sealx-component-gesture-relay'
created: '2026-05-10'
status: 'completed'
stepsCompleted: [1, 2, 3, 4, 5, 6]
tech_stack: ['Markdown', 'TypeScript']
files_to_modify:
  - 'packages/sealx-sdk/readme.md'
  - 'packages/sealx-sdk/CHANGELOG.md'
code_patterns:
  - 'Keep a Changelog 格式'
  - 'What → Why → How 文档结构'
test_patterns: ['GitHub Markdown 渲染检查']
---

# Tech-Spec: SDK 文档更新 — sealx-component 手势桥接与对接指南

**Created:** 2026-05-10

## Overview

### Problem Statement

SDK 的 `readme.md` 缺少以下内容的文档，导致外部开发者无法正确对接：

1. `sealx-component` HTML 属性（用于标记需要触发 Side Panel 的按钮元素）
2. `setupSealxActions()` 导出函数（用于手动扫描动态添加的元素）
3. 手势桥接机制的对接流程说明

### Solution

在 `readme.md` 的 Usage 部分添加对接示例与说明，在 API Reference 部分补充 `setupSealxActions()` 条目。同步更新 `CHANGELOG.md` 记录新增 API。

### Scope

**In Scope:**
- `readme.md` Usage 新增 sealx-component 属性对接示例
- `readme.md` API Reference 新增 `setupSealxActions()` 条目
- `CHANGELOG.md` 新增版本条目

**Out of Scope:**
- 修改 SDK 源代码
- 独立 docs/ 目录
- 版本号 bump

## Context for Development

### Codebase Patterns

- SDK 中常量定义：`SEALX_SOURCE_ATTR = 'sealx-component'`，`SEALX_ACTION_ATTR = 'data-sealx-action'`，`SEALX_ACTION_VALUE = 'open'`
- `setupSealxActions()` 在 `DOMContentLoaded` 自动调用 + `MutationObserver` 持续监听
- Content script 通过事件委托监听 `[data-sealx-action="open"]` 元素点击
- **readme.md** 结构：Title → Installation → Usage → Browser Extension Integration → API Reference → License；API Ref 四组：Init / Signing / Utility / Types
- **CHANGELOG.md** 格式：`## [version] - date` → `### Category` 子标题 → 列表项；分类含 Optimized / Technical Improvements / Breaking Changes / Migration Guide

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `packages/sealx-sdk/readme.md` | 主文档 — Usage（line 34 后）插 "### Side Panel Gesture Relay"；API Ref → Utility Functions 加 `setupSealxActions()` |
| `packages/sealx-sdk/CHANGELOG.md` | 变更日志 — 新增 `## [1.0.27]` 条目，可参考现有 `## [1.0.1]` 格式 |
| `packages/sealx-sdk/src/index.ts` | SDK 源码 — 参考常量名和 API 签名 |

### Technical Decisions

- sealx-component 属性说明放在 Usage 部分，与现有的 initSealx/bindSealx/signBySealx 示例放在一起
- API Reference 的 Utility Functions 下新增 `setupSealxActions()` 条目
- CHANGELOG 按现有格式新增条目
- **文档语言规则**: 用直白中文解释技术概念。不直接引用 Chrome API 术语（如 transient activation），而是用"真实用户点击""浏览器手势验证"等接地气表述。确保刚学 Web 开发的初级程序员也能理解
- **文档结构规则**: sealx-component 段按 What → Why → How 三层组织：What — 一句话说清这是什么；Why — 一句话说清为什么要用；How — 完整代码块，可直接复制粘贴

## Implementation Plan

### Tasks

1. [x] 添加 sealx-component 背景段落 — 解释"为什么需要 sealx-component"：Chrome Side Panel 的 `sidePanel.open()` 需要用户手势（transient activation），在 HTML 按钮上加 `sealx-component` 属性可以让 SDK 自动桥接点击事件。插入位置：Usage 现有 JS 示例**之后**，作为独立小节 "Side Panel Gesture Relay"
2. [x] 添加代码示例 — 完整 HTML + JS 代码块，展示 `<button sealx-component onclick="signBySealx(task)">Sign</button>` 的完整对接用法。强调 `setupSealxActions()` 无需手动调用（DOMContentLoaded + MutationObserver 自动完成）。代码块需包含注释：属性名必须精确为 `sealx-component`，动态元素也支持（MutationObserver 自动监听）
3. [x] 更新 `readme.md` API Reference — Utility Functions 新增 `setupSealxActions()`，标注为零配置自动行为
4. [x] 更新 `CHANGELOG.md` — 新增版本条目

### Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| AC1 | 开发者阅读 readme Usage | 看到 "Side Panel Gesture Relay" 小节 | 能理解 sealx-component 属性的动机和原理 |
| AC2 | 同上 | 看到 HTML + JS 代码示例 | 可直接复制粘贴到自己的页面完成对接 |
| AC3 | 开发者查 API Reference | 找到 `setupSealxActions()` 条目 | 了解其零配置自动执行的行为和手动调用场景 |
| AC4 | 开发者看 CHANGELOG | 找到本次版本条目 | 了解新增了 gesture relay API |
| AC5 | 文档 push 后在 GitHub 查看 | Markdown 渲染结果 | 无语法错误，代码块高亮正确

## Additional Context

### Dependencies

- 无外部依赖，纯文档更新

### Testing Strategy

- 手动检查 Markdown 渲染（GitHub 或本地预览）
- 确认 CHANGELOG 格式与现有条目一致

### Notes

- 当前 SDK 版本 1.0.27，CHANGELOG 条目不需要单独 bump 版本号
- readme.md 已有完整的 Installation / Usage / API Reference 结构，本次更新在现有结构中增量添加

### Known Pitfalls (预演避免)

| 场景 | 风险 | 预防措施 |
|------|------|---------|
| 属性名拼错 | 开发者写 `<button sealx>` 而非 `<button sealx-component>` | 代码示例精确展示 `sealx-component` |
| 动态元素 | React/Vue 动态渲染的按钮不工作 | 文档注明 MutationObserver 自动处理动态元素 |
| 属性值误解 | 开发者写 `sealx-component="true"` | 示例展示无属性值的正确布尔属性写法 |
| CHANGELOG 格式 | 条目格式与现有不一致 | Task 4 约束：参考现有 CHANGELOG 条目格式

## Review Notes

- Adversarial review completed: 10 findings total, 10 fixed, 0 skipped
- Resolution approach: walk-through (逐条处理)
- Changes applied:
  - F1: 统一 HTML onclick 与 TS 示例中的函数引用
  - F2: 移除 gesture relay 小节中冗余的初始化代码
  - F3: CHANGELOG 添加版本跳号说明
  - F4: `[1.0.1]` 条目补充 `### Added` 保持格式一致
  - F5: `setupSealxActions()` 描述补充手动调用场景
  - F6: "Side Panel Gesture Relay" 全文改为英文
  - F7: 强化 boolean 属性警告（`"false"` 也会生效）
  - F8: 合并 CHANGELOG 重复条目
  - F9: 添加事件绑定方式不限的说明
  - F10: `setupSealxActions()` API Reference 描述统一格式

---
title: '修复 task-home 首次渲染闪现 empty 样式'
slug: 'fix-task-home-flash-empty-state'
created: '2026-05-26'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['React 18', 'TypeScript', 'sealx-core']
files_to_modify:
  - 'extension/src/entries/popup/components/task/index.tsx'
code_patterns: ['useState lazy initializer', 'sync state initialization from props/context']
test_patterns: ['manual verification: sign → login → task-home renders tasks directly, no empty flash']
---

# Tech-Spec: 修复 task-home 首次渲染闪现 empty 样式

**Created:** 2026-05-26

## Overview

### Problem Statement

用户签名流程中，登录后跳转到 `/task-home` 时，页面首次渲染先显示 `NoPendingTasks`（empty 样式），然后才渲染实际的 task 列表。原因是 `TaskHome` 组件的 `list`/`total` 状态初始化为空值（`[]`/`0`），依赖 `useEffect` 异步填充，导致首次渲染时数据尚未就绪。

```typescript
// 当前代码 — task/index.tsx:86-89
const [total, setTotal] = useState<number>(0)
const [list, setList] = useState<Array<SealxSignTask>>([])

// 数据来源 — useEffect line 151-167
useEffect(() => {
    if (request.topic === SIGN || request.topic === BATCH_SIGN) {
        // ...
        setList(items)  // ← 在首次 render 之后才执行
        setTotal(items.length)
    }
}, [request])
```

React 渲染顺序：首次 render（state 为空 → `NoPendingTasks`）→ `useEffect` 执行 → `setList`/`setTotal` → 二次 render（正确显示任务列表）。闪现不可避免。

但实际上 `request` 在组件挂载时**已经就绪**——`RequestContextProvider` 在路由到 `/task-home` 之前已经设置了 SIGN/BATCH_SIGN 请求。问题不是数据延迟到达，而是**组件没有从已就绪的数据源同步初始化状态**。

### Root Cause

`useState` 初始值硬编码为 `[]` 和 `0`，而非从 `request` 上下文推导。`request` 在 mount 时已包含完整的 task 数据（SIGN/BATCH_SIGN topic + payload），但组件不信任它，等到 `useEffect` 才读取。

### Solution

将 `useState` 的初始值改为从 `request` 同步推导（lazy initializer），使首次渲染即拿到正确的 task 列表。`useEffect` 保留用于处理 `request` 的后续变化。

### Scope

**In Scope:**
- `extension/src/entries/popup/components/task/index.tsx`: `list`/`total` state 的初始化逻辑

**Out of Scope:**
- Task 数据处理逻辑的架构重构
- 其他页面的类似问题

## Context for Development

### Codebase Patterns

- **Request 上下文**: `useRequestContext()` 提供 `request` 对象，包含 `topic`、`payload`、`header`。Provider 在路由到 `/task-home` 之前已设置 request。
- **Task 数据**: `request.payload` 在 SIGN/BATCH_SIGN 时为 `SealxSignTask | SealxSignTask[]`。
- **Task 过滤**: 已过期的 task（`validUntilTime <= Date.now()`）需要过滤掉。
- **list 状态后被修改**: SIGN_RESPONSE handler 和 `clearTaskAndCloseIfDone` 通过 `setList` 移除已完成/拒绝的 task。

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `extension/src/entries/popup/components/task/index.tsx:86-89` | `useState` 初始化 — 核心修改点 |
| `extension/src/entries/popup/components/task/index.tsx:151-167` | `useEffect` — 从 request 填充 list（保留以处理后续更新） |
| `extension/src/entries/popup/components/task/index.tsx:379-395` | 渲染逻辑 — `total === 0 ? NoPendingTasks : task list` |

### Technical Decisions

1. **Lazy initializer 复用过滤逻辑:** 抽取 `extractTasks` 函数，在 `useState` lazy initializer 和 `useEffect` 中复用，避免代码重复。
2. **保留 `useEffect`:** request 在组件生命周期内可能变化（如后续 SIGN/BATCH_SIGN 到达），`useEffect` 仍负责处理这些更新。

## Implementation Plan

### Tasks

#### Task 1: list state 从 request 同步初始化 + 消除 total state

**File:** `extension/src/entries/popup/components/task/index.tsx`
**Line:** 86-89, 151-167, 379-395, and all `setTotal` call sites

```typescript
// Extract task extraction as a reusable function (before the component)
const extractTasks = (payload: unknown): SealxSignTask[] => {
    if (!payload) return [];
    const items = (payload instanceof Array ? payload : [payload]) as SealxSignTask[];
    return items.filter(task => Number(task.validUntilTime) > Date.now());
};

// In TaskHome component:
const { request } = useRequestContext();
const initialList = extractTasks(
    (request.topic === SealxTopic.SIGN || request.topic === SealxTopic.BATCH_SIGN)
        ? request.payload
        : null
);
const [list, setList] = useState<Array<SealxSignTask>>(initialList);
// total state removed — use list.length directly
```

**移除 `total` state 及所有 `setTotal` 调用：**

- 删除 `const [total, setTotal] = useState<number>(0)` (line 86)
- 删除 `setTotal(items.length)` (line 156)
- 删除 `setTotal(items.length)` (line 212)

**更新渲染条件：**

```typescript
// Before:
{total === 0 ? ( <NoPendingTasks /> ) : ( ... )}

// After:
{list.length === 0 ? ( <NoPendingTasks /> ) : ( ... )}
```

**保留 `useEffect` 处理后续 request 更新：**

```typescript
useEffect(() => {
    if (request.topic === SealxTopic.BATCH_SIGN || request.topic === SealxTopic.SIGN) {
        const items = extractTasks(request.payload);
        setList(items);
        replyRef.current = request.reply ?? null;
        // ... rest of existing logic (tabId mapping etc.)
    }
}, [request]);
```

### Acceptance Criteria

**AC1: 无 empty 闪现**
- GIVEN 用户通过签名按钮触发 Panel，登录后跳转到 `/task-home`
- WHEN TaskHome 组件首次渲染
- THEN 直接显示任务列表，不出现 `NoPendingTasks` 的 empty 样式

**AC2: 正常过期过滤**
- GIVEN request payload 包含 3 个 task，其中 1 个已过期
- WHEN TaskHome 组件首次渲染
- THEN `list.length` 为 2，只显示未过期的 2 个 task

**AC3: request 后续更新仍正常**
- GIVEN TaskHome 已渲染，随后新 SIGN request 到达
- WHEN `useEffect` 触发
- THEN list 正常更新

**AC4: 签名完成后 task 移除正常**
- GIVEN 有 2 个 task，用户完成 1 个签名
- WHEN SIGN_RESPONSE 到达
- THEN list 减少为 1 个 task，`list.length` 更新为 1

## Additional Context

### Dependencies

- 无外部依赖
- 不涉及 SDK、Background、Provider 改动

### Testing Strategy

1. **手动测试（必须）:**
   - 发送签名请求 → Panel 打开 → 登录 → 观察 `/task-home` 是否直接显示 task 列表（无闪现）
   - 发送多个 task → 确认数量正确、过期 task 不显示
2. **回归测试:**
   - 签名完成后确认 task 正确移除
   - 只有一个 task 时签名完成 → 确认 Panel 关闭

### Notes

- **为什么用普通函数调用而非 lazy initializer:** `useState(() => list.length)` 中 `list` 是 state 变量，初始化时值为 `undefined`，无法安全引用。改用 `useState(getInitialTasks())` 在 render 阶段计算初始值，仅首次 render 执行。
- **为什么消除 `total` state:** `total` 仅用于 `total === 0` 判断，与 `list.length === 0` 等价。减少一个 state 降低不一致风险。删除所有 3 处 `setTotal` 调用。
- **`useEffect` 仍需保留:** `request` 在组件生命周期内可能变化（后续 SIGN/BATCH_SIGN 到达），`useEffect` 负责处理这些更新。

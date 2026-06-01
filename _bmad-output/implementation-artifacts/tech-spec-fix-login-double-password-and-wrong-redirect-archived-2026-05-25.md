---
title: '修复登录后密码重复输入和页面跳转错误'
slug: 'fix-login-double-password-and-wrong-redirect'
created: '2026-05-25'
status: 'in-progress'
stepsCompleted: [1, 2]
tech_stack: ['React 18', 'TypeScript', 'Zustand (persist)', 'Chrome Extension MV3', 'React Router v6 (HashRouter)', 'sealx-message']
files_to_modify:
  - 'extension/src/providers/RequestContextProvider.tsx'
  - 'extension/src/entries/popup/components/login/index.tsx'
code_patterns: ['request priority guard', 'useRef for stable topic capture', 'messager race condition']
test_patterns: ['no existing tests — manual verification required']
---

# Tech-Spec: 修复登录后密码重复输入和页面跳转错误

**Created:** 2026-05-25

## Overview

### Problem Statement

业务页面点击签名/绑定按钮 → Side Panel 打开 → 用户输入密码登录后出现两个 Bug：

1. **密码重复输入（高概率）：** 输完一次 6 位 PIN 后，密码框被清空，需要再次输入才能登录
2. **登录后跳转错误：** 登录成功后跳转到主页 `/` 而非目标业务页（签名 → `/task-home`，绑定 → `/bind-pubkey`）

两个 Bug 同根：**CONNECT 消息覆盖了 SIGN/BIND_PK 请求**。

### Root Cause Analysis

**消息发送链路（业务页 SDK）：**
```
signBySealx() / bindSealx() 调用:
  ├─ 1. connectSealx() → CONNECT → MessageChannel.BACKGROUND
  └─ 2. messager.send() → SIGN/BIND_PK → MessageChannel.POPUP
```

**Background 处理差异：**

| 消息 | Background 处理方式 |
|------|-------------------|
| CONNECT | `messager.on()` → 存 persist store **+** 等 panel ready 后 `messager.send()` **直接发给 Panel** |
| SIGN/BIND_PK | `messager.onForward()` → **仅**存 persist store，**不直接发给 Panel** |

**Panel 端竞态窗口：**
```
Panel 加载:
  ├─ initializeApplication() → 从 persist store 读到 SIGN ✓
  │    └─ setRequest(SIGN) → routeByRequest → 跳转 /login
  │
  └─ CONNECT 随后通过 messager 到达（第二条路径）↓
       └─ handleRequest(CONNECT) → 覆盖 request 为 CONNECT ✗
```

CONNECT 有两条到达路径（persist store + messager 直接发送），SIGN/BIND_PK 只有一条（persist store）。CONNECT 几乎总是最后到达，覆盖掉 SIGN/BIND_PK。

**导致的 Bug 链路：**

`Login.handlePasswordChange` 在用户输完 6 位 PIN 后读取 `request.topic`，此时已被覆盖为 `CONNECT`：

1. `getPostLoginRoute(CONNECT)` 返回 `null`
2. 走 CONNECT 分支：`setPassword('')` 清空密码框 + 2 秒 fallback timer → 用户看到空密码框 → 以为登录失败 → 再次输入
3. 2 秒后 `navigate('/')` 跳主页，或 SIGN 请求"迟到"后 `routeByRequest` 才跳到正确页面

### Solution

两步修复：

1. **`handleRequest` 加反向优先级保护** — CONNECT 是最低优先级消息，任何已有 topic 都不应被 CONNECT 覆盖。用黑名单策略：`if (request.topic && req.topic === CONNECT) return`
2. **`Login` CONNECT 分支简化** — 移除 `setPassword('')` 和 2 秒 fallback timer，登录成功后直接 `navigate('/')`

### Scope

**In Scope:**
- `RequestContextProvider.tsx` 的 `handleRequest` 函数：添加请求优先级逻辑
- `Login` 组件：捕获初始 topic 用于 post-login 路由

**Out of Scope:**
- Background 消息处理架构重构
- messager 系统改动
- 其他页面/组件的路由逻辑

## Context for Development

### Codebase Patterns

- **Request 状态管理**: `RequestContextProvider` 的 `request` state + `useRequestStore` (Zustand persist)
- **消息接收**: `messager.on(SealxTopic.ALL, handleRequest)` 统一入口
- **路由守护**: `RootLayout.checkRoute()` 检查 session/address/lockTime 状态决定跳转
- **Post-login 路由**: `Login.getPostLoginRoute(topic)` 根据 topic 返回目标路由

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `extension/src/providers/RequestContextProvider.tsx:323-372` | `handleRequest` — 统一消息接收和处理 |
| `extension/src/entries/popup/components/login/index.tsx:21-25` | `getPostLoginRoute` — topic → route 映射 |
| `extension/src/entries/popup/components/login/index.tsx:89-140` | `handlePasswordChange` — 登录成功后的路由逻辑 |
| `extension/src/entries/background/index.ts:95-150` | Background CONNECT handler |
| `extension/src/entries/background/index.ts:152-167` | Background onForward (SIGN/BIND_PK → persist store) |
| `packages/sealx-sdk/src/index.ts:327-380` | SDK `connectSealx()` — CONNECT 发送方 |
| `packages/sealx-sdk/src/index.ts:417-476` | SDK `bindSealx()` — BIND_PK 发送方 |
| `packages/sealx-sdk/src/index.ts:545-617` | SDK `signBySealx()` — SIGN 发送方 |

### Technical Decisions

1. **优先级策略 — 反向黑名单:** 不用白名单枚举高优先级 topic，而是用反向逻辑：`if (request.topic && req.topic === SealxTopic.CONNECT) return`。CONNECT 是通用会话检查请求，语义上不应覆盖任何已有的业务请求。反向策略自动涵盖未来新增的 topic，更鲁棒。
2. **CONNECT 分支简化:** 移除 `setPassword('')` 和 2 秒 fallback timer。CONNECT-only 场景（无业务请求）登录后直接 `navigate('/')` 跳主页。不再需要等待 SIGN/BIND_PK — 如果它们后续到达，已登录状态下 `routeByRequest` 会直接导航到业务页。
3. **不改 Background:** 改动集中在 Panel 端，风险最小，不涉及 messager 协议层。

## Implementation Plan

### Tasks

#### Task 1: handleRequest 加反向优先级保护

**File:** `extension/src/providers/RequestContextProvider.tsx`
**Line:** 361-365

在 `handleRequest` 函数中，`requestId` 去重检查之后、`setRequest(req)` 之前，添加 CONNECT 覆盖保护：

```typescript
// Skip duplicate request IDs
if (req.header?.requestId === request.header?.requestId) {
    return;
}
// CONNECT is the lowest-priority topic — never overwrite an existing request
if (request.topic && req.topic === SealxTopic.CONNECT) {
    return;
}
// Set request state and trigger routing
setRequest(req);
```

**逻辑:** 任何已有 topic 都不应被 CONNECT 覆盖。CONNECT 是通用会话检查，SIGN/BIND_PK/SIGN_RESPONSE 是具体业务操作。

#### Task 2: Login CONNECT 分支简化

**File:** `extension/src/entries/popup/components/login/index.tsx`
**Line:** 108-118

将 CONNECT 分支从"清空密码 + 2 秒等待"改为"直接跳转主页"：

```typescript
// Before:
} else if (loginRequestTopic === SealxTopic.CONNECT) {
    setPassword('')
    if (connectFallbackTimerRef.current) {
        clearTimeout(connectFallbackTimerRef.current)
    }
    connectFallbackTimerRef.current = setTimeout(() => {
        connectFallbackTimerRef.current = null
        if (latestTopicRef.current === SealxTopic.CONNECT) {
            navigate('/', { replace: true })
        }
    }, CONNECT_FALLBACK_DELAY_MS)
}

// After:
} else if (loginRequestTopic === SealxTopic.CONNECT) {
    navigate('/', { replace: true })
}
```

**同时清理不再需要的变量:**
- 移除 `latestTopicRef`（line 37）及相关的 useEffect（lines 41-51）— 不再需要跟踪 topic 变化来清除 fallback timer
- 移除 `connectFallbackTimerRef`（line 38）及清理 useEffect（lines 53-60）

### Acceptance Criteria

**AC1: 签名流程**
- GIVEN 用户未登录，在业务页点击"签名"按钮
- WHEN Side Panel 打开，用户输入正确 PIN
- THEN 登录成功后直接跳转到 `/task-home`（签名任务页），密码框不被清空

**AC2: 绑定流程**
- GIVEN 用户未登录，在业务页点击"绑定"按钮
- WHEN Side Panel 打开，用户输入正确 PIN
- THEN 登录成功后直接跳转到 `/bind-pubkey`（绑定页），密码框不被清空

**AC3: 普通登录（无业务请求）**
- GIVEN 用户未登录，点击扩展图标打开 Side Panel
- WHEN 用户输入正确 PIN
- THEN 登录成功后跳转到主页 `/`

**AC4: 重复输入不复现**
- GIVEN 签名/绑定流程
- WHEN 连续测试 20 次
- THEN 不出现"输完密码后密码框清空需要再次输入"的情况

**AC5: CONNECT 不覆盖 SIGN**
- GIVEN SIGN 请求已设置到 Panel
- WHEN CONNECT 消息随后到达
- THEN `request.topic` 保持为 SIGN，不被覆盖为 CONNECT

## Additional Context

### Dependencies

- 无外部依赖
- 不涉及 messager 协议变更
- 不涉及 Background 代码变更

### Testing Strategy

1. **手动测试（必须）:** 在业务页分别测试签名和绑定流程各 10+ 次，确认不复现
2. **手动测试:** 测试扩展图标直接打开 → 登录 → 确认正常跳转主页
3. **手动测试:** 已登录状态下点击签名/绑定按钮 → 确认直接进入业务页（不经过登录）
4. **代码审查:** 确认优先级判断逻辑正确，不会导致 CONNECT-only 场景（扩展图标打开）无法登录

### Notes

- 这是 Panel 端最小修复方案。长期来看，Background 端 CONNECT handler 同时写 persist store 和发 messager 的双路径设计是竞态根源，但改动风险更大，不在本次范围。
- 当前 `latestTopicRef` 和 `connectFallbackTimerRef` 的 CONNECT 2 秒 fallback 机制在 Task 2 中简化：登录成功后直接 navigate，不再需要 fallback timer。

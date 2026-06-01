---
title: '修复 SW 重启后 SDK session 不同步导致 post-login 路由丢失'
slug: 'fix-sw-restart-sdk-session-desync'
created: '2026-05-25'
status: 'implementation-complete'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['TypeScript', 'Chrome Extension MV3', 'sealx-message', 'Zustand (persist)', 'React 18', 'sealx-core']
files_to_modify:
  - 'packages/sealx-sdk/src/index.ts'
  - 'extension/src/providers/RequestContextProvider.tsx'
  - 'extension/src/entries/popup/components/login/index.tsx'
  - 'extension/src/entries/popup/components/login/styles.css'
  - 'extension/src/core/state/login-animating.ts'
code_patterns: ['always-connect pattern', 'connectSealx as session validator', 'initializeApplication polling retry', 'logging-in placeholder animation', 'routeByRequest animation guard', 'shared module-level ref for cross-component coordination']
test_patterns: ['manual verification: SW restart → sign/bind → login success animation → correct page']
---

# Tech-Spec: 修复 SW 重启后 SDK session 不同步导致 post-login 路由丢失

**Created:** 2026-05-25

## Overview

### Problem Statement

Service Worker 重启后，Background/Panel 的 session 被正确清空（`sessionStore.setSession(null)`），但业务页 SDK 的 `sealxSigner.session` 是独立内存对象，不受 SW 重启影响。用户点击签名/绑定按钮时，SDK 的 session 有效性检查错误通过（旧 session 未过期），跳过 `connectSealx()`，直接 `messager.send(SIGN/BIND_PK, CHANNEL_POPUP)`。消息到达 Background 后仅通过 `onForward` 写入 persist store，Panel 加载时 `initializeApplication()` 因 persist store 异步同步延迟读不到请求，导致 `request.topic` 为 `undefined`。用户登录后 `getPostLoginRoute(undefined)` 返回 `null`，进入 CONNECT fallback → `navigate('/')`，最终跳转到主页而非目标业务页（`/task-home` 或 `/bind-pubkey`）。

### Root Cause

`connectSealx()` 自己就是问题的根源。它内部有一段"优化"短路逻辑（line 362-367）：如果本地 `sealxSigner.session` 看起来有效，就**什么都不做直接返回**。

```typescript
// 问题代码 — connectSealx line 362-367:
if (
    !sealxSigner.session ||
    sealxSigner.session.expire < Date.now() ||
    !sealxSigner.account || !sealxSigner.session.sessionId
    || sealxSigner.session.userId !== sealxSigner.account.userId
) {
    // Only sends CONNECT when LOCAL session looks invalid
    const res = await messager.send(...);
}
// Otherwise: no-op — relies on stale local cache!
```

而 Background CONNECT handler（background/index.ts:95-169）**已经完美处理了两种情况**：

| Background session 状态 | CONNECT handler 行为 |
|------------------------|---------------------|
| 有效 | 直接返回 `{ session, account }`，不走 Panel，无用户感知 |
| 无效 | 存 request + 开 Panel + 等用户 login → reply 返回新 session |

**`connectSealx()` 本身就是最好的 session 校验器。** 不需要额外检查——只需要去掉让它"短路"的那段代码。

### Solution

三步修复 + 一个体验优化：

1. **`connectSealx()` — 去掉本地 session 短路：** 移除 line 362-367 的条件判断，总是发 CONNECT 消息。Background 负责判断 session 是否有效。
2. **`signBySealx()` / `bindSealx()` — 简化调用：** 去掉条件判断，直接 `await connectSealx()`。
3. **Panel 端 — 增强 request recovery：** `initializeApplication()` 增大重试窗口（300ms → 3000ms 递增间隔）。
4. **Login — 登录中过渡动画：** login 成功后展示 1.5-2s「登录中」动画，期间 `routeByRequest` 跳过自动跳转。动画结束后根据 `latestTopicRef`（此时 SIGN/BIND_PK 已到达）决定目标路由，消除 `/` 闪现。

### Scope

**In Scope:**
- `packages/sealx-sdk/src/index.ts`: `connectSealx()`, `signBySealx()`, `bindSealx()` — 去掉本地 session 短路
- `extension/src/providers/RequestContextProvider.tsx`: `initializeApplication()` — 增强重试窗口; `routeByRequest()` — 增加 login 动画期间导航拦截
- `extension/src/entries/popup/components/login/index.tsx`: `handlePasswordChange()` — 登录中过渡动画 + 延迟路由
- `extension/src/entries/popup/components/login/styles.css` — 动画样式

**Out of Scope:**
- messager 协议层改动
- Background CONNECT 处理链路重构
- session store 持久化机制改动
- SDK `isSessionAvailable()` API 语义变更

## Context for Development

### Codebase Patterns

- **Session 管理**: `sessionStore` (Zustand persist → chrome.storage.local) 是 Background 和 Panel 的 session 真相源。SDK 端的 `sealxSigner.session` 是独立内存拷贝，由 `connectSealx()` 通过 `sealxSigner.initializeSession()` 更新。
- **Connect 流程**: `connectSealx()` → `messager.send(CONNECT, CHANNEL_BACKGROUND)` → Background CONNECT handler → 校验 session → 有效直接返回 session/account，无效存 request 并开 Panel 等待 login reply → 返回新 session。
- **消息发送链路**: SDK → `messager.send(topic, CHANNEL_POPUP)` → Background `onForward(POPUP)` → persist request store → Panel 从 store 恢复。SDK → `messager.send(topic, CHANNEL_BACKGROUND)` → Background 直接处理。
- **Request 恢复**: Panel `initializeApplication()` → 轮询 `useRequestStore.getState().request` → 恢复 request → `routeByRequest()` 决定导航。
- **Post-login 路由**: `Login.handlePasswordChange()` → 捕获 `request.topic` → `getPostLoginRoute(topic)` 返回目标路由。

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `packages/sealx-sdk/src/index.ts:327-398` | `connectSealx()` — **核心修改点**，去掉本地 session 短路 |
| `packages/sealx-sdk/src/index.ts:563-635` | `signBySealx()` — 简化 connect 条件判断 |
| `packages/sealx-sdk/src/index.ts:435-494` | `bindSealx()` — 简化 connect 条件判断 |
| `extension/src/entries/background/index.ts:95-170` | Background CONNECT handler — session 有效/无效的处理逻辑（不修改） |
| `extension/src/entries/background/index.ts:172-193` | Background `onForward` — SIGN/BIND_PK → persist store |
| `extension/src/providers/RequestContextProvider.tsx:416-547` | `initializeApplication()` — 增强重试窗口 |
| `extension/src/providers/RequestContextProvider.tsx:271-291` | `routeByRequest()` — 增加 login 动画期间导航拦截 |
| `extension/src/providers/RequestContextProvider.tsx:340-411` | `handleRequest()` — CONNECT 保护已合入（不修改） |
| `extension/src/entries/popup/components/login/index.tsx:19-23` | `getPostLoginRoute()` — topic→route 映射 |
| `extension/src/entries/popup/components/login/index.tsx:146-264` | `handlePasswordChange()` — 增加登录中动画 + 延迟路由 |
| `extension/src/entries/popup/components/login/styles.css` | 动画样式 |

### Technical Decisions

1. **Always Connect — 去掉本地短路：** `connectSealx()` 不再信任 `sealxSigner.session` 的本地状态。每次都发 CONNECT 到 Background，由 Background 的真相源判断是否需要重新登录。Session 有效时 Background 直接返回，增加一次 messager 往返（~20-50ms），对用户体验无影响。
2. **不新增任何 topic 或 handler：** 不需要 `CHECK_SESSION_EXPIRED`、不需要 try/catch、不需要防重入锁。Background CONNECT handler 已有完整的状态机覆盖所有分支，直接复用。
3. **Panel 端重试窗口：** 递增间隔（0, 100ms, 200ms, ..., 900ms），总窗口 ~3000ms。防御性增强。
4. **登录中过渡动画 — 2s：** login 成功后不立即跳转，而是展示 2s「登录中」动画。此期间 SIGN/BIND_PK 从 SDK 到达 Panel，`latestTopicRef` 被更新，routeByRequest 被动画 guard 拦截。2s 后动画结束，根据 `latestTopicRef.current` 决定目标路由。2s 是经验值——足够 SIGN 到达（<100ms）且给用户明确的视觉反馈。
5. **动画 guard 用独立文件 + ref：** `loginAnimatingRef` 定义在 `extension/src/core/state/login-animating.ts`，避免 Login ↔ RequestContextProvider 循环依赖。`routeByRequest` 读取它，Login 设置它。额外加 5s 超时保护——如果 ref 被异常卡在 true 超 5s，`routeByRequest` 强制忽略 guard，防止永久阻塞导航。
6. **动画样式用 CSS @keyframes：** 项目使用 CSS Modules（`login/styles.css`），不用 Tailwind。定义 `@keyframes` 脉冲 + 渐入效果。

## Implementation Plan

### Tasks

#### Task 1: connectSealx() 去掉本地 session 短路

**File:** `packages/sealx-sdk/src/index.ts`
**Line:** 362-367

核心改动 —— 移除阻止发送 CONNECT 的条件判断：

```typescript
// Before (lines 362-367):
if (
    !sealxSigner.session ||
    sealxSigner.session.expire < Date.now() ||
    !sealxSigner.account || !sealxSigner.session.sessionId
    || sealxSigner.session.userId !== sealxSigner.account.userId
) {
    try {
        const res = await messager.send(
            { userId, title },
            SealxTopic.CONNECT,
            CHANNEL_BACKGROUND
        );
        // ... response handling
    } catch (error) {
        // ...
    }
}
```

```typescript
// After:
try {
    const res = await messager.send(
        { userId, title },
        SealxTopic.CONNECT,
        CHANNEL_BACKGROUND
    );
    if (!res?.payload?.session || !res?.payload?.account) {
        console.warn('[TRACE-CONNECT:SDK] connectSealx response INVALID', { payload: res?.payload })
        throw new SessionException('Invalid connection response');
    }
    console.warn('[TRACE-CONNECT:SDK] connectSealx response received', {
        sessionUserId: res.payload.session?.userId,
        sessionHost: res.payload.session?.host,
        sessionExpire: res.payload.session?.expire,
        accountUserId: res.payload.account?.userId,
        accountHost: res.payload.account?.host,
    });
    sealxSigner.connected = true;
    await sealxSigner.initializeSession(res.payload.session);
    await sealxSigner.initializeAccount(res.payload.account);
} catch (error) {
    console.error('Connection failed:', error);
    throw new SessionException('Failed to connect to SealX extension');
}
```

**注意：** 移除短路条件的同时，保留 `isSealxActive()` 和 `account.userId`（line 344-349）的前置校验——这些是 Guard，不是短路。

#### Task 2: signBySealx() / bindSealx() 简化 connect 调用

**File:** `packages/sealx-sdk/src/index.ts`
**Line:** 585-588 (signBySealx), 457-465 (bindSealx)

```typescript
// signBySealx — Before:
if (!sealxSigner.session || sealxSigner.session.expire < Date.now()
    || sealxSigner.session.userId != userId || !sealxSigner.session.sessionId) {
    await connectSealx();
}
if (sealxSigner.session) messager.session = sealxSigner.session

// signBySealx — After:
await connectSealx();
messager.session = sealxSigner.session!;
```

```typescript
// bindSealx — Before:
if (
    !sealxSigner.session ||
    !sealxSigner.account ||
    sealxSigner.session.expire < Date.now()
    || sealxSigner.session.userId != userId
    || !sealxSigner.session.sessionId
) {
    await connectSealx();
}
if (sealxSigner.session) messager.session = sealxSigner.session

// bindSealx — After:
await connectSealx();
messager.session = sealxSigner.session!;
```

#### Task 3: Panel initializeApplication 增强重试窗口

**File:** `extension/src/providers/RequestContextProvider.tsx`
**Line:** 473

```typescript
// Before:
for (let attempt = 0; attempt < 3 && !storeRequest; attempt++) {
    if (attempt > 0) {
        await new Promise(r => setTimeout(r, 100));
    }
    storeRequest = useRequestStore.getState().request;
}

// After:
for (let attempt = 0; attempt < 10 && !storeRequest; attempt++) {
    if (attempt > 0) {
        // Graduated backoff: 100ms, 200ms, ..., 900ms
        // Total window: up to ~3000ms
        await new Promise(r => setTimeout(r, attempt * 100));
    }
    storeRequest = useRequestStore.getState().request;
}
```

#### Task 4: Login — 登录中过渡动画 + 延迟路由

**Files:**
- `extension/src/core/state/login-animating.ts` — **新建**，共享 ref
- `extension/src/entries/popup/components/login/index.tsx` — 动画状态 + 延迟路由
- `extension/src/entries/popup/components/login/styles.css` — 动画样式

**新建 `login-animating.ts`：**

```typescript
// Shared ref — avoids circular dependency between Login and Provider
export const loginAnimatingRef = { current: false };
// 5s safety timeout: if stuck, routeByRequest ignores the guard
export const LOGIN_ANIMATING_TIMEOUT_MS = 5_000;
```

**Login 组件** — 在 `handlePasswordChange` 中替换 post-login navigate 逻辑：

```typescript
// Add state:
const [loggingIn, setLoggingIn] = useState(false);
const LOGGING_IN_DURATION_MS = 2_000;

// In handlePasswordChange, after login succeeds:
if (res) {
    loginDoneRef.current = true;
    setSession(res);
    reply.current?.({ session: res, account: {...} });
    // Show logging-in animation instead of immediately navigating
    loginAnimatingRef.current = true;
    setLoggingIn(true);
    // Navigation is deferred to the animation-end effect
}
```

新增 `useEffect` 处理动画结束后的路由：

```typescript
useEffect(() => {
    if (!loggingIn) return;
    const timer = setTimeout(() => {
        loginAnimatingRef.current = false;
        setLoggingIn(false);
        const finalTopic = latestTopicRef.current;
        const targetRoute = getPostLoginRoute(finalTopic);
        if (targetRoute) {
            navigate(targetRoute, { replace: true });
        } else {
            navigate('/', { replace: true });
        }
    }, LOGGING_IN_DURATION_MS);
    return () => clearTimeout(timer);
}, [loggingIn, navigate]);
```

**清理 `connectFallbackTimerRef`：** 动画机制取代了 CONNECT fallback timer。移除 `connectFallbackTimerRef`、`CONNECT_FALLBACK_DELAY_MS`、相关 useEffect（lines 37-38, 62-70, 110-117, 220-231）。

**动画 UI：** `loggingIn` 为 true 时隐藏密码输入区，展示居中 Logo + "Verifying..." 文本 + 脉冲进度条。样式写在 `login/styles.css`：

```css
.login-anim-overlay { ... }     /* 覆盖密码区 */
.login-anim-pulse { ... }       /* 脉冲动画 */
@keyframes sealx-pulse { ... }  /* 透明度脉冲 */
```

**动画时长 2s：** SIGN 到达 <100ms，2s 提供足够的视觉确认且不过长。

#### Task 5: routeByRequest — 动画期间导航拦截 + 超时保护

**File:** `extension/src/providers/RequestContextProvider.tsx`
**Line:** 271

在 `routeByRequest` 函数开头增加 guard：

```typescript
import { loginAnimatingRef, LOGIN_ANIMATING_TIMEOUT_MS } from '@src/core/state/login-animating';

const routeByRequest = useCallback(
    (req: SealxRequest) => {
        // Don't navigate during the logging-in animation — Login handles it
        if (loginAnimatingRef.current) {
            // Safety: if stuck > 5s, force reset to prevent permanent navigation block
            if (Date.now() - loginAnimatingRefSetAt > LOGIN_ANIMATING_TIMEOUT_MS) {
                loginAnimatingRef.current = false;
            } else {
                return;
            }
        }

        const currentSession = useSessionStore.getState().session;
        // ... rest of existing logic
    },
    [pathname, getTargetRoute, navigate]
);
```

**同步更新 `login-animating.ts`：**

```typescript
export const loginAnimatingRef = { current: false };
export let loginAnimatingRefSetAt = 0;
export const LOGIN_ANIMATING_TIMEOUT_MS = 5_000;
```

Login 组件在设置时同步更新时间戳：

```typescript
loginAnimatingRef.current = true;
loginAnimatingRefSetAt = Date.now();
```

### Acceptance Criteria

**AC1: SW 重启后签名流程**
- GIVEN SW 重启清空 session，业务页 SDK 持有旧 session
- WHEN 用户点击签名按钮
- THEN `connectSealx()` 总是发 CONNECT → Background 发现 session 无效 → Panel 打开 → 用户登录成功 → 跳转 `/task-home`

**AC2: SW 重启后绑定流程**
- GIVEN SW 重启清空 session，业务页 SDK 持有旧 session
- WHEN 用户点击绑定按钮
- THEN `connectSealx()` 总是发 CONNECT → Background 发现 session 无效 → Panel 打开 → 用户登录成功 → 跳转 `/bind-pubkey`

**AC3: 正常 session 无额外 Panel 弹出**
- GIVEN 正常有效 session（SW 未重启）
- WHEN 用户点击签名/绑定按钮
- THEN `connectSealx()` 发 CONNECT → Background 发现 session 有效 → 直接返回 session，**不走 Panel，无感知**

**AC4: Panel request recovery 容错**
- GIVEN SW 重启 + 用户通过业务按钮触发 panel
- WHEN Panel 加载时 persist store 的 request 尚未同步完成
- THEN Panel 在递增重试窗口内成功恢复 request

**AC5: 已登录状态直接进业务页**
- GIVEN 已有有效 session（已登录）
- WHEN 用户点击签名并 Panel 已打开
- THEN CONNECT 消息直接返回 session，Panel 的 `handleRequest` 收到 SIGN → session 有效 → `routeByRequest` 直接导航到 `/task-home`，不跳 Login

**AC6: 登录中动画 → 正确业务页（无闪现）**
- GIVEN SW 重启后 session 无效，用户通过业务按钮打开 Panel
- WHEN 用户输入正确 PIN
- THEN 显示 2s「登录中」动画 → 动画期间 SIGN/BIND_PK 到达 → 动画结束 → 直接跳转到 `/task-home`（签名）或 `/bind-pubkey`（绑定），中间不闪现 `/`

**AC7: 纯登录（扩展图标打开）→ 动画 → 主页**
- GIVEN 无业务请求，用户通过扩展图标打开 Panel
- WHEN 用户输入正确 PIN
- THEN 显示 2s「登录中」动画 → 动画结束 → latestTopicRef 无 SIGN/BIND_PK → navigate('/')

## Additional Context

### Dependencies

- Background CONNECT handler 已完美实现（background/index.ts:95-169），无需修改
- `handleRequest` 的 CONNECT 不覆盖已有 SIGN/BIND_PK 保护已合入（`request.topic && req.topic === CONNECT → return`），本次修复不引入回归
- 不涉及新增 API 或 messager 协议变更

### Testing Strategy

1. **核心场景（必须）:**
   - `chrome://extensions` → 刷新插件 → 业务页点签名 → Panel 开 → 输入 PIN → 看到 2s「登录中」动画 → 确认跳转 `/task-home`
   - 同上，点绑定 → 输入 PIN → 动画 → 确认跳转 `/bind-pubkey`
2. **回归场景:**
   - 不刷新插件，正常签名/绑定 → 确认流程正常，无额外 Panel 弹出
   - 未登录 + 扩展图标开 Panel → 输入 PIN → 动画 → 跳主页 `/`
   - 已登录 + 业务页点签名 → 确认直接进 `/task-home`，不经过登录
   - 已登录 + 扩展图标开 Panel → 确认直接进主页 `/`，不经过登录
3. **动画边界:**
   - 输入 PIN 后快速切换 Tab → 确认动画正常结束不报错
   - 动画期间 SIGN 延迟到达（模拟慢速）→ 动画结束后仍正确跳转

### Notes

- **Always Connect 的核心理念：** `connectSealx()` 的语义是「向 Background 请求建立/确认连接」。Background 是 session 的唯一真相源。SDK 不应该在本地"猜测" session 是否有效——它应该总是 connect，让 Background 判断。
- **性能：** 正常 session 下，一次 CONNECT 往返 ~20-50ms。Background 的 `checkSessionExpire` 是纯内存操作。
- **动画 + 路由时序：**
  ```
  login 成功 → setLoggingIn(true), loginAnimatingRef=true, reply
  ↓ (<100ms) SDK 收到 reply → 发 SIGN → Panel handleRequest(SIGN)
    → routeByRequest 被 loginAnimatingRef 拦截 ✓
    → latestTopicRef 从 CONNECT → SIGN
  ↓ (2s) 动画结束 → loginAnimatingRef=false
    → getPostLoginRoute(latestTopicRef=SIGN) → '/task-home' → navigate ✓
  ```
- **清理冗余代码：** Task 4 移除 `setPassword('')`、`connectFallbackTimerRef` 及相关 useEffect——动画 + `loginAnimatingRef` 取代了旧的 CONNECT fallback 机制。
- **`loginAnimatingRef` 用 ref 而非 state：** `routeByRequest` 是 useCallback，用模块级 ref 避免 dependency 变化触发重建。Login 设置 `loginAnimatingRef.current`，Provider 在 `routeByRequest` 中读取——两者无需通过 React 状态同步。

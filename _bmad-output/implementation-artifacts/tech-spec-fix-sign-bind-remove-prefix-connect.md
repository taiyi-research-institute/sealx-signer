---
title: 'fix: SIGN/BIND 去掉 SDK 前置 connectSealx，session 过期时由 Panel 编排登录恢复流程'
slug: 'fix-sign-bind-remove-prefix-connect'
created: '2026-06-04'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['TypeScript', 'Chrome Extension MV3', 'sealx-message', 'Zustand persist', 'React 18', 'sealx-core']
files_to_modify:
  - 'packages/sealx-sdk/src/index.ts'
  - 'extension/src/entries/background/index.ts'
  - 'extension/src/entries/popup/components/login/index.tsx'
  - 'extension/src/entries/popup/components/task/index.tsx'
  - 'extension/src/entries/popup/components/bind-pubkey/index.tsx'
code_patterns:
  - 'always-connect pattern (已落地)'
  - 'session 签名不出 Background 沙盒'
  - 'POPUP 通道用于 SDK→Panel 消息转发'
  - 'BACKGROUND 通道用于 Panel 内部调用 BG 签名'
  - 'onForward(POPUP) 存 persist store + 转发到 Panel'
test_patterns:
  - 'session 过期后签名 → Panel 弹登录 → 签名成功返回'
  - 'session 过期后绑定 → Panel 弹登录 → 绑定成功返回'
  - 'session 有效签名 → 直接进 task-home 签名'
  - 'Panel 关闭监听 (PANEL_CLOSE → INPAGE) 处理 SDK 超时'
---

# Tech-Spec: fix: SIGN/BIND 去掉 SDK 前置 connectSealx，session 过期时由 Panel 编排登录恢复流程

**Created:** 2026-06-04

## Overview

### Problem Statement

Session 过期后用户点击签名/绑定按钮时，SDK `signBySealx()`/`bindSealx()` 先调 `connectSealx()` 再发 SIGN/BIND_PK。前置 connect 的 session 恢复与实际业务请求分离，导致用户在签名页打开后 session 过期时，前端本地 session 与插件真实 session 容易不一致；期望流程应是 SIGN/BIND_PK 业务请求直接进入 Panel，由 Panel 编排登录恢复，最终由业务组件回复签名/绑定结果。

**5 Whys 根因:** Session 校验分散在 SDK / BG CONNECT / BG SIGN / checkSessionExpire 四个组件中，各自使用不同缓冲区和判断逻辑，SIGN handler 过期直接报错而不触发恢复。

### Solution

**核心思路:** SDK 不再预判 session 状态（去掉 `connectSealx()` 前置），直接发 SIGN/BIND_PK 到 POPUP → 走 `onForward` 到 Panel。Panel `handleRequest` 按 session 状态分发：

- **session 有效:** 直接路由 `/task-home`（签名）或 `/bind-pubkey`（绑定）
- **session 过期:** 路由 `/login` → 输 PIN → 登录成功 → **不 reply**（仅 CONNECT/LOGIN topic 才 reply）→ 跳转到业务页 → 用户确认 → Panel 调用 `sign()` (BACKGROUND 通道) → BG 在沙盒内完成密码学签名 → 返回结果给 Panel → Panel reply 业务签名数据，并通过 response metadata (`response.session`) 带新 session 给 SDK → SDK 自动刷新本地状态

**关键约束:** 签名操作不出 Background 沙盒。私钥在 BG 内存中，Panel 只负责 UI 编排，实际密码学操作由 BG SIGN handler 在 `CHANNEL_BACKGROUND` 完成。

### Scope

**In Scope:**

- `packages/sealx-sdk/src/index.ts`: `signBySealx()` / `bindSealx()` 去掉 `connectSealx()` 前置；`response.session` 检查同步
- `extension/src/entries/background/index.ts`: SIGN/BIND_PK handler 保持 `MessageChannel.POPUP`（它是 sender filter，Panel 内部调用必须保留）
- `extension/src/entries/popup/components/login/index.tsx`: reply 加 topic 条件（仅 CONNECT/LOGIN 回复）
- `extension/src/entries/popup/components/task/index.tsx`: reply 前设置 `messager.session`，payload 保持业务数据
- `extension/src/entries/popup/components/bind-pubkey/index.tsx`: reply 前设置 `messager.session`，payload 保持业务数据

**Out of Scope:**

- messager 协议层改动
- Background CONNECT handler 重构
- session store 持久化机制
- `PanelManager` / panel close 监听（已有机制覆盖 SDK 超时场景）
- BATCH_SIGN 处理（与 SIGN 同理，按相同模式处理）

## Context for Development

### Codebase Patterns

- **签名不出沙盒:** Panel `task-render.tsx` → `onApproval()` → `sign()` (`core/background/index.ts:162`) → `sendMessage({...}, SIGN, BACKGROUND)` → BG SIGN handler 执行 `signTypedData()`。此为唯一签名路径，保持不变。
- **消息通道:**
  - `CHANNEL_POPUP`: SDK → `onForward(BG)` → persist store + 转发到 Panel。Panel 内部处理 UI 流程。
  - `CHANNEL_BACKGROUND`: Panel → BG 直接调用（如 `sign()`、`login()`、`bindKey()`）。不经过 onForward。
  - `MessageChannel.INPAGE`: BG → Content Script → 业务页 SDK（如 `SIGN_RESPONSE`、`PANEL_CLOSE`）。
- **CONNECT 回复链:** Login 的 `reply.current?.()` → Panel messager → BG CONNECT handler 的 `res.payload`。这条链路仅用于 CONNECT/LOGIN topic。
- **Session 同步:** BG `sessionStore` (Zustand persist → chrome.storage.local) 是唯一真相源。Panel `useSessionStore` 通过 persist 同步。SDK 端 `sealxSigner.session` 是独立内存拷贝，需显式更新。

### Files to Reference

| File | Purpose |
|------|---------|
| `packages/sealx-sdk/src/index.ts:547-616` | `signBySealx()` — 去掉 `connectSealx()` + 加 response.session 检查 |
| `packages/sealx-sdk/src/index.ts:423-478` | `bindSealx()` — 同上 |
| `extension/src/entries/background/index.ts:502-545` | BG SIGN handler — 保持 `MessageChannel.POPUP` sender filter，Panel 内部签名调用使用 |
| `extension/src/entries/background/index.ts:259-264` | BG BIND_PK handler — 保持 `MessageChannel.POPUP` sender filter |
| `extension/src/entries/background/index.ts:95-170` | BG CONNECT handler — 不变，保留现有时序 |
| `extension/src/entries/background/index.ts:172-193` | BG `onForward(POPUP)` — 不变，SIGN/BIND_PK 照常转发到 Panel |
| `extension/src/entries/popup/components/login/index.tsx:191-212` | Login `handlePasswordChange` — reply 加 topic 条件 |
| `extension/src/entries/popup/components/task/index.tsx:92-155` | TaskHome — reply 前设置 `messager.session`，payload 保持业务数据 |
| `extension/src/entries/popup/components/bind-pubkey/index.tsx:43-59` | BindPubKey — reply 前设置 `messager.session`，payload 保持业务数据 |
| `extension/src/entries/popup/components/task/task-render.tsx:444-470` | `onApproval()` — 签名入口，不变 |
| `extension/src/core/background/index.ts:162-163` | `sign()` — 不变，Panel 内部调用 → BG BACKGROUND |
| `extension/src/core/state/session/index.ts:42-55` | `setHost`/`setUserId` — 不变，但避免竞态的注意事项 |

### Technical Decisions

1. **保留 SIGN/BIND_PK handler 的 `MessageChannel.POPUP` 通道注册：** 对抗审查确认 `messager.on(topic, handler, channel)` 的 `channel` 是 sender filter，不是 receiver。Panel 内部 `sign()`/`bindKey()` 发送到 BG 时 sender 是 POPUP，因此 BG SIGN/BIND_PK handler 必须保留 `MessageChannel.POPUP`。SDK 从业务页发起时 sender 是 INPAGE，不会命中这些 handler，会走 `onForward` 转到 Panel。
2. **Login 不回复 SIGN/BIND：** `request.topic === SIGN/BIND_PK` 时 login 成功不调 `reply.current?.()`。reply 留给最终的业务组件（task-home / bind-pubkey），携带签名结果 + 新 session。
3. **Session 随签名结果返回：** Panel reply payload 只放业务数据；reply 前设置插件侧 `messager.session`，`messager.reply()` 将 session 同步到 response metadata 与 header。SDK 检查 `response.session`，有则 `sealxSigner.initializeSession(session)`，并返回 `response.payload` 作为业务数据。
4. **无需 SDK 重试：** SDK 只发一次 SIGN，等待 reply。Panel 内部编排登录→签名→reply，SDK 无需感知中间状态。
5. **Panel 关闭已有监听：** `PanelManager.notifyPanelClosing()` → `messager.send(PANEL_CLOSE, INPAGE)` → SDK `onPanelClose` 监听，覆盖超时/关闭场景。不需要额外超时机制。
6. **Panel 关闭 = 放弃本次会话：** 用户主动关闭 Panel 等同于放弃签名，不需恢复上一次的 request。非 button 打开的 Panel 清空 request 是正确行为。

### Elicitation Findings (Round 1 & 2)

**Round 1 — 5 方法论分析:**

| 方法 | 关键发现 |
|------|---------|
| First Principles | SIGN 不应被 session 状态阻塞；签名请求应自动触发恢复而非报错 |
| Pre-mortem | 最危险的 3 场景：BG SIGN handler 竞态、sessionMap key 不匹配、挂起 Promise 泄露 |
| Tree of Thoughts | 3 条路径评分：Path B (BG 挂起) 15 分 > Path A (SDK 重试) 9 分 > Path C (Panel 签名) 10 分 |
| Failure Mode | 4 组件 8 种失效模式——其中 BG session 竞态和 SIGN handler 通道冲突是核心 |
| 5 Whys | 根因：Session 校验分散在 4 处，规则各不一致，过期直接报错不恢复 |

**Round 2 — 5 方法论分析:**

| 方法 | 关键发现 |
|------|---------|
| Security Audit | `SealxSession` 含 `pk`(公钥) 和 `address`，不含私钥。reply header 传 session 无安全隐患 ✅ |
| Mentor/Apprentice | **盲点发现：task-render `onApproval()` `sign()` 返回 `SESSION_EXPIRED` 时需重新路由 `/login`** |
| Self-Consistency | 3 条独立路径推演相同场景，状态转移一致无矛盾 ✅ |
| SCAMPER | 当前方案已是最简可行解；`connectSealx()` 前置可安全消除；BIND_PK 与 SIGN 改动模式完全一致 |
| Chaos Monkey | 10 项破坏测试，无阻塞问题。#5(sign() session 过期)需纳入实现；#4(Panel 关闭丢 SIGN)是预期行为 |

**综合方案确认:**
- SDK 去掉 `connectSealx()` 前置，直接发 SIGN/BIND_PK → POPUP
- BG SIGN/BIND_PK handler 保持 `MessageChannel.POPUP`（sender=Panel/Popup），不处理 SDK(INPAGE) 发来的业务请求
- Panel login 仅 CONNECT/LOGIN topic reply
- Panel 业务组件 reply 业务数据，插件返回时更新 response header/session metadata
- SDK 检查 `response.session` 同步本地状态
- **新增边界处理:** task-render `sign()` 返回 `SESSION_EXPIRED` → navigate `/login`

## Implementation Plan

### Tasks

- [x] **Task 1: SDK `signBySealx()` — 去掉 `connectSealx()` 前置，加 session 同步**
  - File: `packages/sealx-sdk/src/index.ts`
  - Line: 569 — 删除 `await connectSealx();`
  - Line: 597-606 — response 处理后加 session 检查：
    ```typescript
    const res = await messager.send(task, SealxTopic.SIGN, CHANNEL_POPUP);
    // Session 同步：检查 response metadata 中的 session
    if (res?.payload?.session) {
        sealxSigner.connected = true;
        await sealxSigner.initializeSession(res.payload.session);
        messager.session = sealxSigner.session!;
    }
    if (!res?.payload) {
        throw new SignException(res?.error ?? '');
    }
    // 返回签名的业务数据
    return res.payload as T;
    ```
    注意：`messager.send()` 返回 `SealxResponse`，`res.payload` = Panel reply 的内容。Panel 将发 `{ result: ..., session: ... }`。

- [x] **Task 2: SDK `bindSealx()` — 去掉 `connectSealx()` 前置，加 session 同步**
  - File: `packages/sealx-sdk/src/index.ts`
  - Line: 450 — 删除 `await connectSealx();`
  - Line: 454-467 — response 处理后加 session 检查：
    ```typescript
    const res = await messager.send(
        sealxSigner.account.userId,
        SealxTopic.BIND_PK,
        CHANNEL_POPUP
    );
    // Session 同步
    if (res?.payload?.session) {
        sealxSigner.connected = true;
        await sealxSigner.initializeSession(res.payload.session);
        messager.session = sealxSigner.session!;
    }
    if (!res?.payload) {
        throw new Error('Failed to bind public key: No response payload received');
    }
    sealxSigner.account.newPk = '';
    sealxSigner.account.pk = res.payload.result;
    closeSealx();
    return res.payload.result as string;
    ```
    注意：`res.payload.result` 是 bind 的 pk 字符串。

- [x] **Task 3: SDK `signBySealx()` BATCH_SIGN 分支 — 同样去掉 `connectSealx()` 前置**
  - File: `packages/sealx-sdk/src/index.ts`
  - Line: 584 — `messager.sendStream(task, SealxTopic.BATCH_SIGN, CHANNEL_POPUP)` — 确认没有 `connectSealx()` 调用。
  - 在 stream consumer 中加 session 检查（从每个 response.session 获取）

- [x] **Task 4: SDK 清理旧的 trace 日志 + 保留 connectSealx 函数定义**
  - File: `packages/sealx-sdk/src/index.ts`
  - `connectSealx()` 函数保留（`isSessionAvailable()` 和其他调用方可能使用），但 `signBySealx()`/`bindSealx()` 不再调用它。
  - 可选：移除 `signBySealx()`/`bindSealx()` 中冗余的 `messager.session = sealxSigner.session!`，因为在 session 同步后已设置。

- [x] **Task 5: BG SIGN handler — 保留 POPUP sender filter（对抗审查修正）**
  - File: `extension/src/entries/background/index.ts`
  - 结论：不修改。`MessageChannel.POPUP` 是 sender filter，Panel 内部 `sign()` 调 BG 时 sender=POPUP，必须保留。
  - SDK 从业务页发送 SIGN 时 sender=INPAGE，不会命中该 handler，会由 `onForward(POPUP)` 存 request 并转发 Panel。
  - 签名逻辑完全不变 — 密钥操作仍不出沙盒

- [x] **Task 6: BG BIND_PK handler — 保留 POPUP sender filter（对抗审查修正）**
  - File: `extension/src/entries/background/index.ts`
  - 结论：不修改。Panel 内部 `bindKey()` 调 BG 时 sender=POPUP，必须保留 `MessageChannel.POPUP`。
  - SDK 从业务页发送 BIND_PK 时 sender=INPAGE，不会命中该 handler，会由 `onForward(POPUP)` 转发 Panel。

- [x] **Task 7: Panel Login — reply 加 topic 条件，仅 CONNECT/LOGIN 回复**
  - File: `extension/src/entries/popup/components/login/index.tsx`
  - Line: 194 — 将 `reply.current?.({ session: res, account: {...} } as never)` 包裹 topic 条件：
    ```typescript
    // 仅 CONNECT/LOGIN topic 才 reply session 给 Background
    if (request.topic === SealxTopic.CONNECT || request.topic === SealxTopic.LOGIN) {
        reply.current?.({ session: res, account: {
            userId: res.userId,
            host: res.host,
            pk: res.pk
        }} as never);
    }
    ```
  - SIGN/BIND_PK topic 时 login 成功不 reply — reply 留给最终业务组件

- [x] **Task 8: Panel TaskHome — reply 前设置 `messager.session`，payload 保持业务数据**
  - File: `extension/src/entries/popup/components/task/index.tsx`
  - Line: 124 — `reply?.(state)` 改为带上 session：
    ```typescript
    const currentSession = useSessionStore.getState().session;
    reply?.({ result: state, session: currentSession });
    ```
  - Line: 125 `messager.send(state.result, SealxTopic.SIGN_RESPONSE, MessageChannel.INPAGE)` — 保持不变

- [x] **Task 9: Panel BindPubKey — reply 前设置 `messager.session`，payload 保持业务数据**
  - File: `extension/src/entries/popup/components/bind-pubkey/index.tsx`
  - Line: 50 — `reply.current?.(address as never)` 改为：
    ```typescript
    const currentSession = useSessionStore.getState().session;
    reply.current?.({ result: address, session: currentSession } as never);
    ```
  - 需要从 `useSessionStore` 获取 session

- [x] **Task 10: TaskRender — `sign()` 返回 SESSION_EXPIRED 时重新路由 /login**
  - File: `extension/src/entries/popup/components/task/task-render.tsx`
  - Line: 461,481 — `sign()` 调用后检查返回：
    ```typescript
    const res = await sign(userId, host, signContent);
    if (!res?.signature) {
        const error = res as unknown as { error?: string; errorCode?: string };
        if (error?.errorCode === 'SESSION_EXPIRED') {
            // Session 在签名时过期，回到 login 重新认证
            navigate('/login', { replace: true });
            return;
        }
        throw new Error(getSigningFailureMessage(res));
    }
    ```
  - 注意：`task-render.tsx` 中 `navigate` 来自哪里？查一下 — 可能需要通过 props 传递或使用 `useSealXNavigate()`

### Acceptance Criteria

- [ ] **AC1: Session 过期后签名 — Panel 弹出登录 → 签名成功**
  - Given: 业务页已打开，session 已过期
  - When: 用户点击签名按钮
  - Then: Panel 弹出 → 显示登录页面 → 用户输 PIN → 跳转 `/task-home` → 用户确认签名 → SDK 收到签名结果 + 新 session → SDK `sealxSigner.session` 已更新

- [ ] **AC2: Session 过期后绑定 — Panel 弹出登录 → 绑定成功**
  - Given: 业务页已打开，session 已过期
  - When: 用户点击绑定按钮
  - Then: Panel 弹出 → 显示登录页面 → 用户输 PIN → 跳转 `/bind-pubkey` → 用户确认 → SDK 收到 pk 结果 + 新 session → SDK `sealxSigner.session` 已更新

- [ ] **AC3: Session 有效签名 — 直接进业务页**
  - Given: 业务页已打开，session 有效
  - When: 用户点击签名按钮
  - Then: Panel 弹出 → 直接进 `/task-home`（不经过 login）→ 签名流程正常 → SDK 收到结果

- [ ] **AC4: Session 有效绑定 — 直接进业务页**
  - Given: 业务页已打开，session 有效
  - When: 用户点击绑定按钮
  - Then: Panel 弹出 → 直接进 `/bind-pubkey`（不经过 login）→ 绑定流程正常 → SDK 收到结果

- [ ] **AC5: 纯 CONNECT（扩展图标）— 不受影响**
  - Given: 无业务请求
  - When: 用户点击扩展图标→ 登录
  - Then: 登录成功 → 1s 动画 → 跳转主页 `/`，不影响 CONNECT 链路

- [ ] **AC6: Panel 关闭 — SDK 不卡住**
  - Given: SIGN 已发，Panel 弹出
  - When: 用户关闭 Panel（未签名）
  - Then: SDK 收到 `PANEL_CLOSE` → `messager.reply` reject/resolve(null) → SDK 不永久挂起

- [ ] **AC7: Session 在签名确认时过期 — 重新登录**
  - Given: login 成功后进入 `/task-home`，但用户犹豫导致 session 再次过期
  - When: 用户点击确认签名
  - Then: `sign()` 返回 `SESSION_EXPIRED` → task-render 捕获 → navigate `/login` → 输 PIN → 回到 `/task-home` → 重新签名

- [ ] **AC8: Session 同步到 SDK**
  - Given: login 成功或签名成功
  - When: Panel reply `{ result, session }` 到 SDK
  - Then: SDK 检查 `res.session` 非空 → `sealxSigner.initializeSession(session)` + `messager.session = session`


## Additional Context

### Dependencies

- BG CONNECT handler (line 95-170) 已完美实现，无需修改
- `PanelManager.waitForReady()` 和 `notifyPanelClosing()` 链已建立
- `handleRequest` 的 SIGN/BIND_PK → `/task-home`/`/bind-pubkey` route 映射已存在
- `getPostLoginRoute()` 的 SIGN/BIND_PK → `/task-home`/`/bind-pubkey` 映射已存在

### Testing Strategy

1. **核心场景 (必须):**
   - 打开业务页 → 等 session 过期 → 点签名 → Panel 弹出登录 → 输 PIN → 自动跳 `/task-home` → 确认签名 → 确认 SDK 拿到签名数据
   - 同上，点绑定 → 输 PIN → 自动跳 `/bind-pubkey` → 确认绑定 → 确认 SDK 拿到绑定结果
2. **回归场景:**
   - session 有效时签名/绑定 → 直接进业务页，不经过登录
   - 纯 CONNECT（扩展图标打开）→ 登录 → 正确跳主页
   - Panel 关闭 → SDK 收到 `PANEL_CLOSE` → 不卡住
3. **Session 同步:**
   - 确认 SDK `response.session` 非空时调用了 `initializeSession`
   - 确认 SDK `messager.session` 更新为最新值

### Notes

- **核心约束:** "签名不出 Background 沙盒"是硬约束。`sign()` → `sendMessage(SIGN, BACKGROUND)` → BG `signTypedData()` 链路完全不变。
- **通道职责分离:**
  ```
  POPUP 通道:     SDK → BG onForward → Panel (UI 编排：login / task-home 确认)
  BACKGROUND 通道: Panel → BG (密钥操作：sign / bind / login)
  INPAGE 通道:    BG → Content Script → SDK (事件通知：SIGN_RESPONSE / PANEL_CLOSE)
  ```
- **请求恢复:** Panel 关闭 = 放弃本次会话。非 button 打开时 `clearRequest()` 清空上次 request。这与现有行为一致，无需修改。
- **向后兼容:** 老版 SDK 仍会先 `connectSealx()` 再 SIGN。BG SIGN handler 保持 `MessageChannel.POPUP` sender filter，因此不会处理 SDK(INPAGE) 发来的业务 SIGN；业务 SIGN 仍走 `onForward` → Panel。
- **`connectSealx()` 保留:** 不删除函数定义，`isSessionAvailable()` 和可能的其他调用方仍使用它。仅 `signBySealx()`/`bindSealx()` 不再调它。
- **安全问题已审计:** `SealxResponse.session` 仅含 `pk`(公钥) + `address`，不含私钥。Panel reply 将 session 随结果返回给 SDK 无安全风险。
- **Elicitation 盲点已覆盖:** task-render `sign()` 返回 `SESSION_EXPIRED` → navigate `/login` → 重新登录后导航回 `/task-home` → 用户重新确认签名。

## Review Notes

- Adversarial review completed.
- Findings: 3 total, 3 fixed, 0 skipped.
- Resolution approach: auto-fix during review.
- F1 (High, real): `MessageChannel.POPUP` was incorrectly treated as receiver channel. It is a sender filter; BG SIGN/BIND_PK handlers must keep `MessageChannel.POPUP` so Panel internal calls are handled and SDK(INPAGE) requests are not intercepted. Fix: reverted BG handler channel changes and updated spec.
- F2 (Medium, real): TaskHome reply used nested `state` causing payload shape `{ result: { result: ... } }`. Fix: reply `{ result: state.result, session }`; SDK returns `payload.result`.
- F3 (Medium, real): `SESSION_EXPIRED` handling was added only for batch array branch, not single sign branch. Fix: added single branch handling and reset signing state before navigating `/login`.

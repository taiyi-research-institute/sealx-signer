# SealX SDK Session 与 Hooks 内部文档

> **目标读者**：维护 SealX 项目的内部开发者。
> **阅读前提**：已读完 [`./architecture.md`](./architecture.md) 和 [`./message-protocol.md`](./message-protocol.md)。
> **本文档聚焦**：`addBeforeSendHook` / `addAfterSendHook` 的 WHY、cache TTL 全景、session 过期时间线。这些是 SDK 与 extension 交互的核心机制，对外文档**完全不暴露**。

---

## 1. Hooks 机制：WHY 与 HOW

### 1.1 `addBeforeSendHook` — 自动注入 `userId`

**源码位置**：`sealx-sdk/src/index.ts:96-101`

```typescript
messager.addBeforeSendHook((request: SealxRequest) => {
    if (!request.header.userId && sealxSigner.account?.userId) {
        request.header.userId = String(sealxSigner.account.userId);
    }
    return request;
});
```

**WHY 存在**：
- SDK 的所有公共 API（`initSealx` / `bindSealx` / `signBySealx` / `sendSignResponse` / ...）都有可选的 `userId` 参数。
- 大多数调用方不传 `userId`，因为 session 初始化后就已经有了 `sealxSigner.account.userId`。
- 如果没有这个 hook，每个 API 都需要在 `messager.send(...)` 调用前手动把 userId 塞进 request.header。
- **单一注入点**：把 userId 注入集中在一个 hook，所有 API 自动受益，避免每个 API 重复逻辑。

**改动影响**：
- 修改这个 hook 会影响所有使用 `messager.send(...)` 的 API。
- 如果 hook 不注入 userId，extension 侧收到消息时会因为没有 userId 而拒绝处理（多数 topic 都依赖 header.userId）。
- **不要移除或重排**：这个 hook 必须在 `addAfterSendHook` 之前注册（按注册顺序串行执行，hook 顺序决定了请求先注入 userId 再发送）。

---

### 1.2 `addAfterSendHook` — `syncSignerSessionFromResponse`

**源码位置**：`sealx-sdk/src/index.ts:75-90`

```typescript
const syncSignerSessionFromResponse = async (response?: {
    session?: typeof sealxSigner.session;
}) => {
    if (!response?.session) return;
    sealxSigner.connected = true;
    await sealxSigner.initializeSession(response.session);
    messager.session = sealxSigner.session!;
};

messager.addAfterSendHook(syncSignerSessionFromResponse);
```

**WHY 存在**：
- 每个 extension 响应都可能携带最新的 session（extension 会主动刷新 session 并在 response 中回传）。
- 如果 SDK 不及时同步 response 中的 session，可能出现"SDK 用过期 session 发下一个请求，被 extension 拒绝"的 stale 状态。
- 通过这个 hook，**每次收到带 session 的 response 都自动同步到 `sealxSigner`**，SDK 永远用最新 session。

**与 `MessagerBase.syncSessionFromResponse` 的区别**：
- `MessagerBase` 内置了一个 `syncSessionFromResponse`，只更新 `messager.session`（`packages/sealx-message/src/messager/messager.ts`）。
- SDK 的这个 hook 做了更多：
  1. 设置 `sealxSigner.connected = true`
  2. 调用 `sealxSigner.initializeSession(response.session)`（内部会持久化到 storage、启动 autoClearTimer）
  3. 再把 session 同步回 `messager.session`
- **SDK hook 是 base hook 的增强**：base 只更新 messager 内部状态，SDK 还更新全局单例状态和持久化。

**改动影响**：
- 修改这个 hook 会影响所有收到 response 后的状态同步逻辑。
- **不要在 hook 内直接 throw**：hook 抛异常会中断当前请求的返回链路，导致上层 API 收到未预期的错误。所有异常应该被 try-catch 包裹。
- **hook 是 async 的**：`initializeSession` 是 async 函数，hook 必须 await 它，否则后续请求可能用旧 session。

---

### 1.3 Hook 注册顺序

**源码位置**：`sealx-sdk/src/index.ts:84-101`（注意 after 在 before 之前注册，但 before 先执行）

```typescript
// 1. 注册 after hook（line 84-90）
messager.addAfterSendHook(syncSignerSessionFromResponse);

// 2. 注册 before hook（line 92-101）
messager.addBeforeSendHook((request) => { ... });
```

**执行顺序**：
- 发出请求前：before hook 执行 → 注入 userId → 发送
- 收到响应后：after hook 执行 → 同步 session
- 顺序保证：`MessagerBase` 用数组顺序执行，按注册顺序串行（`packages/sealx-message/src/messager/messager.ts`）

**为什么 after hook 先注册**：
- 这是代码结构上的便利：先处理"响应后做什么"（逻辑上更靠近 response），再处理"请求前做什么"。
- 实际执行顺序是由 hook 类型决定的：所有 beforeSend 在发送前执行，所有 afterSend 在接收后执行。
- **注册顺序不影响执行时机**：beforeSend 永远在发送前，afterSend 永远在接收后。

---

## 2. Cache TTL 全景

SealX 有多层缓存和重试机制，分布在三个包中：

| 缓存/重试 | 数值 | 源码位置 | 用途 |
|---|---|---|---|
| `isSealxActive()` 状态缓存 | **5 秒** TTL | `sealx-sdk/src/index.ts:216` | 减少冗余的 `CHECK_INITIALIZED` 查询 |
| `checkSealx()` 重试 | **3 次 × 100ms** | `sealx-sdk/src/index.ts:904` | 提高 active 检测可靠性（避免偶发通信失败） |
| `checkSealxActive()` 轮询 | **2 秒** 间隔 | `sealx-sdk/src/index.ts:964` | 主动监控扩展激活状态变化 |
| `sealxSigner.autoCheck()` 轮询 | **30 秒** 间隔 | `sealx-core/src/sealx/sealx-signer.ts` | 扩展上下文专用（SDK 侧不用） |
| `RequestCache` 持久化 | 无 TTL（页面刷新清空） | `sealx-message/src/request-cache/index.ts` | 挂起请求跨页面恢复 |
| Session autoClearTimer | `session.expire` 时刻 | `sealx-core/src/sealx/sealx-signer.ts` | session 过期自动清理 |

### 2.1 `isSealxActive()` 5s TTL 详解

**源码位置**：`sealx-sdk/src/index.ts:212-259`

```typescript
let sealxStatusCache: { isActive: boolean; timestamp: number } | null = null;
const CACHE_TTL = 5000; // 5 seconds cache TTL

export const isSealxActive = async (): Promise<boolean> => {
    const now = Date.now();
    if (sealxStatusCache && now - sealxStatusCache.timestamp < CACHE_TTL) {
        return sealxStatusCache.isActive;
    }
    const isActive = (await checkSealx()) !== null;
    // ... update cache
};
```

**行为**：
- 5 秒内的连续调用直接返回缓存值，不发网络请求。
- 5 秒后过期，会重新调用 `checkSealx()`（带 3×100ms 重试）。
- 缓存只在 SDK 进程内存中，**不跨页面**。

**对调用方的影响**：
- 如果你在短时间内连续调 `isSealxActive()`（例如在 useEffect 里多个地方调），会命中缓存，不会重复发消息。
- 如果你想强制刷新，必须清除缓存（目前 API 不暴露清除接口，只能通过 `checkSealx()` 直接调）。

### 2.2 `checkSealx()` 3×100ms 重试

**源码位置**：`sealx-sdk/src/index.ts:903-929`

```typescript
export const checkSealx = async (): Promise<string | null> => {
    const maxRetries = 3;
    const retryDelay = 100;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const res = await messager.send('', SealxTopic.CHECK_INITIALIZED, MessageChannel.BACKGROUND);
            if (res?.payload) {
                return res.payload;
            }
        } catch { /* retry transient failures */ }
        if (attempt < maxRetries - 1) {
            await wait(retryDelay);
        }
    }
    return null;
};
```

**行为**：
- 最多 3 次尝试，每次间隔 100ms（总计最长约 200ms + 通信时间）。
- 任何一次拿到非空 payload 就返回。
- 3 次都失败才返回 null。

**为什么需要重试**：
- 扩展在 service worker 激活、页面刚加载、或 extension 刚安装时，`chrome.runtime.sendMessage` 可能暂时失败。
- 重试让 `checkSealx()` 在这些瞬态故障时仍能正确检测。

---

## 3. Session 过期时间线（数字示例）

假设用户在 `T=1000000`（毫秒 Unix 时间戳）调了 `initSealx()`，extension 返回 session：

```
session = {
    sessionId: 'abc123',
    expire: 1003600000,  // 1小时后过期 = 1000000 + 3600000
    ...
}
```

**时间线**：

| 时刻 | 事件 | 源码位置 |
|---|---|---|
| `T=1000000` | `initSealx()` 调 `sealxSigner.initializeSession(session)` | `sealx-sdk/src/index.ts:439` |
| `T=1000000` | `initializeSession` 启动 `autoClearTimer`（`setTimeout` 在 expire 时刻触发） | `sealx-core/src/sealx/sealx-signer.ts` |
| `T=1000005` | 下一次 `isSealxActive()` 命中缓存，直接返回 true | `sealx-sdk/src/index.ts:241` |
| `T=1000006` | 缓存过期，再次 `checkSealx()` | `sealx-sdk/src/index.ts:245` |
| `T=1001000` | 用户调 `signBySealx(task)`，正常签名 | `sealx-sdk/src/index.ts:605` |
| `T=103600000` | `autoClearTimer` 触发，`sealxSigner.session = null`、`sealxSigner.connected = false` | `sealx-core/src/sealx/sealx-signer.ts` |
| `T=103600100` | 用户调 `isSessionAvailable()` → false（session 已被清空） | `sealx-sdk/src/index.ts:695-697` |
| `T=103600200` | 用户调 `signBySealx()` → 抛 `SealxUninitializedException`（account.userId 还在，但 session 没了） | `sealx-sdk/src/index.ts:621-625` |
| `T=103600200` | 应用应该调 `connectSealx()` 重新建立 session | `sealx-sdk/src/index.ts:383` |

**过期检查的三个独立路径**：

1. **`autoClearTimer`（proactive）**：在 expire 时刻主动清理 session。
2. **`isSessionAvailable()`（reactive）**：每次调用检查 `expire >= Date.now()`。
3. **`isSealxActive()`（cached check）**：5 秒缓存期内可能不知道 session 已过期，需要直接读 `sealxSigner.session.expire` 才能精确判断。

**应用侧推荐做法**：
- 不要用 `isSealxActive()` 检查 session 是否有效——它只查扩展是否安装/激活，不查 session 过期。
- 用 `isSessionAvailable()` 精确判断 session 是否有效。
- 在 `signBySealx` 调用失败时（`SignException` 或 `SealxUninitializedException`），兜底调 `connectSealx()` 重试一次。

---

## 4. Session 同步触发点一览

| 触发点 | 触发时机 | 同步目标 | 源码位置 |
|---|---|---|---|
| `syncSignerSessionFromResponse`（after hook） | 每次收到带 session 的 response | `sealxSigner.session` + `messager.session` + 持久化 | `sealx-sdk/src/index.ts:75-90` |
| `initSealx()` 内部 `sealxSigner.initialize()` | 模块加载后首次调用 | `sealxSigner.session` + `account` + `installed`（从 storage 读） | `sealx-sdk/src/index.ts:314` |
| `initSealx()` 末尾显式赋值 `messager.session = ...` | session 已存在且未过期 | `messager.session` | `sealx-sdk/src/index.ts:330` |
| `connectSealx()` 内部 | 收到 CONNECT response | `sealxSigner.session` + `account` + `messager.session` | `sealx-sdk/src/index.ts:439-448` |
| `sendSignResponse()` 末尾 | 发 SIGN_RESPONSE ack 后 | 触发 500ms 延迟发 CLOSE | `sealx-sdk/src/index.ts:774-780` |

**为什么 `messager.session` 和 `sealxSigner.session` 都要同步**：
- `messager.session` 是 `MessagerBase` 内部状态，用于每条消息的 `SealxHeader.sessionId`。
- `sealxSigner.session` 是 SDK 层全局状态，供 `isSessionAvailable()` 等 API 用。
- **两者必须保持一致**，否则会出现"messager 用过期 sessionId 发消息，extension 拒绝"的情况。

---

## 5. 关键约束与陷阱

### 5.1 不要在 hook 内 throw 未捕获异常

`MessagerBase.applyBeforeSendHooks` 和 `applyAfterSendHooks` 会串行执行所有 hook，任一 hook 抛异常会中断整个链路。SDK 在 `syncSignerSessionFromResponse` 中没有 try-catch（依赖 response 结构稳定），但如果你加新 hook，**必须**自己 try-catch 防止影响主流程。

### 5.2 `messager.session = ...` 赋值时机

SDK 在 3 个地方手动赋值 `messager.session`：
1. `initSealx()` 末尾（L330）
2. `connectSealx()` 末尾（L447）
3. `bindSealx()` 开头（L508）
4. `signBySealx()` 开头（L627）

**为什么不自动赋值**：
- `addAfterSendHook` 只在 response 带 session 时才同步。
- 有些 API（如 `bindSealx` / `signBySealx`）需要在发送请求前确保 `messager.session` 是最新的，否则 header 的 sessionId 会错。
- **显式赋值 = 防御性编程**：确保即使 `syncSignerSessionFromResponse` 没触发，也能用最新 session。

### 5.3 Session 持久化与 autoClearTimer 的竞态

- `initializeSession` 在 `sealx-core` 中会启动 `autoClearTimer`（`setTimeout` 在 expire 时刻）。
- 如果 `initializeSession` 被频繁调用（例如每 10 秒 response 都带新 session），timer 会被重置。
- **不会竞态**：每次调用 `initializeSession` 都会先清旧 timer 再设新 timer（实现细节在 `sealx-core/src/sealx/sealx-signer.ts`）。

### 5.4 `sealxSigner.autoCheck()` 是扩展专用的

**源码位置**：`sealx-core/src/sealx/sealx-signer.ts` `autoCheck` 方法

```typescript
async autoCheck(checker: AutoCheckSealxCallback): Promise<void> {
    // Starts a 30-second interval
}
```

- 这是扩展内部（content script / background）用的 30 秒轮询。
- **SDK 作为 web 页面不使用 `autoCheck()`**。SDK 用的是 `checkSealxActive()`（2 秒间隔）。
- 不要把 SDK 侧的 `checkSealxActive()` 与扩展侧的 `autoCheck()` 混淆。

### 5.5 `RequestCache` 的生命周期

- **写入时机**：请求发起前（`MessagerBase.send` 内部）
- **读取时机**：新页面加载后，content script 检查 cache 中是否有挂起的请求
- **清理时机**：请求完成或失败后调用 `consume()`
- **跨页面场景**：用户在 popup 中确认签名，popup 跳转/关闭后页面刷新，content script 重新从 cache 读到请求并继续处理
- **不跨浏览器**：cache 只在当前浏览器 profile 的 localStorage 中

---

## 6. 关联文档

- **架构概览**：[`./architecture.md`](./architecture.md)
- **消息协议详细**：[`./message-protocol.md`](./message-protocol.md)
- **对外对接指南**：[`packages/sealx-sdk/docs/integration-guide.md`](../../../packages/sealx-sdk/docs/integration-guide.md)
- **对外 API Reference**：[`packages/sealx-sdk/docs/api-reference.md`](../../../packages/sealx-sdk/docs/api-reference.md)

# Epic: 签名会话安全优化

Status: in-progress

## Goal

将 SealX Signer 的签名会话从“持久化可还原私钥材料”调整为“PIN 创建受限授权 + 内存 signer”，在保留短时间免重复输入 PIN 的体验下，降低扩展存储泄露导致私钥被还原的风险。

## Boundary

- 本 epic 不改变长期 vault 的 PIN 加密模型。
- 本 epic 不移除显式导出密钥文件功能。
- WebAuthn、Native App、Hardware Wallet 只作为后续扩展点，不在第一轮实现。
- 金额 policy 只覆盖已知 EIP-712 模板；未知模板必须保守处理。

## Risk

- 签名核心链路变更可能影响已有 dApp 连接和自动重连体验。
- Chrome extension service worker 重启后，内存 signer 会丢失，用户需要重新输入 PIN。
- session store 仍可持久化授权元数据，但不得持久化可还原私钥材料。
- 金额 policy 若解析错误，可能导致授权额度绕过或误拒绝。

## Story Map

1. Story SSS-1: 移除运行时 session 私钥持久化
2. Story SSS-2: 定义内存 keyring 生命周期
3. Story SSS-3: 实现基础 bounded capability
4. Story SSS-4: 实现 EIP-712 金额 policy adapter
5. Story SSS-5: 抽象认证方式与 signing provider

---

# Story SSS-1: 移除运行时 session 私钥持久化

Status: implemented-pending-full-verification

## Story

As a 用户,
I want 输入 PIN 后只在当前运行时解锁签名能力,
so that session 数据泄露时不能通过持久化材料还原私钥。

## Acceptance Criteria

1. [AC1] `generateSession()` 不再生成 session 专用 `pkHex`。
2. [AC2] `generateSession()` 不再写入 `base-info.pks`。
3. [AC3] `SIGN` 不再从 `base-info.pks` 或 `session.pk` 还原私钥。
4. [AC4] 显式导出密钥文件功能仍可使用 `pkHex()`，但该路径不得被运行时 `SIGN` 使用。
5. [AC5] 静态扫描不得出现运行时 `info.pks` 写入、`pkHash`、`session.pk` 回填。

## Tasks / Subtasks

- [x] Task 1: 移除 `generateSession()` 中的 `base-info.pks` 写入链路 (AC: 1,2)
- [x] Task 2: 将 `SIGN` 改为从内存 keyring 获取私钥 (AC: 3)
- [x] Task 3: 保留导出功能的 `pkHex()`，并确认它不参与运行时签名 (AC: 4)
- [x] Task 4: 执行静态扫描验证残留风险 (AC: 5)
- [ ] Task 5: 在依赖可用环境执行 lint/build 与扩展手工 smoke test

## Dev Notes

### 当前实现映射

- `extension/src/entries/background/state/index.ts`
  - `generateSession()` 已不再保存 `pkHex` 到 `base-info.pks`。
  - 新增 `memoryKeyrings` 与 `setSessionPrivateKey()` / `getSessionPrivateKey()`。
- `extension/src/entries/background/index.ts`
  - `SIGN` 已改为读取 `getSessionPrivateKey()`。
  - `SIGN` 不再调用 `decodeSessionPrivateKey(session)`。
- `extension/src/entries/background/models/index.ts`
  - `SealxBaseInfo.pks` 改为可选旧字段。

### Verification

- `git diff --check`: passed
- 静态扫描 `info.pks|base-info.pks|session.pk\\s*=|pkHash`: no active runtime hits
- `npm run lint`: blocked, `eslint: command not found`
- `npm run build`: blocked, `vite: command not found`

---

# Story SSS-2: 定义内存 keyring 生命周期

Status: implemented-pending-full-verification

## Story

As a 用户,
I want PIN 解锁后的签名能力只在当前 background 运行时短期存在,
so that 浏览器或扩展重启后不能继续免 PIN 签名。

## Acceptance Criteria

1. [AC1] LOGIN 成功后，私钥只写入 background 内存 keyring。
2. [AC2] CONNECT 判断 session 可用时，必须同时要求内存 keyring 存在。
3. [AC3] SIGN 前必须校验 session 未过期、host 匹配、userId 匹配。
4. [AC4] memory keyring miss 时，必须清理对应 session 并要求重新登录。
5. [AC5] reset PIN、import key、initialize、extension install 时必须清理全部内存 keyring。
6. [AC6] session expire 时必须清理对应内存 keyring。
7. [AC7] logout 或用户主动锁定时必须清理对应内存 keyring。

## Tasks / Subtasks

- [x] Task 1: LOGIN 创建内存 keyring (AC: 1)
- [x] Task 2: CONNECT 增加 keyring 存在校验 (AC: 2)
- [x] Task 3: SIGN 增加 expire / host / userId 校验 (AC: 3)
- [x] Task 4: keyring miss 时清理 sessionMap 与当前 session (AC: 4)
- [x] Task 5: reset PIN / import key / initialize / install 清理 keyring (AC: 5)
- [x] Task 6: session expire 清理对应 keyring (AC: 6)
- [x] Task 7: 将 popup 侧 `logout()` 和主动锁定动作接入 background 清理接口 (AC: 7)
- [ ] Task 8: 为 service worker 重启后重新登录体验做手工 smoke test

## Dev Notes

### 当前实现映射

- `extension/src/entries/background/state/index.ts`
  - `clearSessionPrivateKey()` / `clearAllSessionPrivateKeys()` 已实现。
- `extension/src/entries/background/index.ts`
  - 新增 `clearSessionFor()`。
  - CONNECT 不再只信任持久化 session，必须存在内存 keyring。
  - SIGN keyring miss 时清理 session 并返回 `null`。
- `extension/src/core/background/index.ts`
  - 新增 `clearSessionPrivateKey()`，供 popup/provider 通知 background 清理内存 keyring。
- `extension/src/providers/RequestContextProvider.tsx`
  - session 失效或过期时同步通知 background 清理内存 keyring。
- `extension/src/entries/popup/components/login/index.tsx`
  - 登录 PIN 错误触发锁定时同步清理当前 host/userId 的内存 keyring。
- `extension/src/entries/popup/components/reset-pin/index.tsx`
  - reset PIN 旧 PIN 错误触发锁定时同步清理内存 keyring。
- `extension/src/entries/popup/components/key-manage/import.tsx`
  - import key 成功并清 session 时同步清理内存 keyring。

### Remaining Gap

依赖缺失导致 lint/build 尚未执行成功；仍需要在依赖可用环境下做扩展 smoke test，尤其是 service worker 重启后必须重新输入 PIN。

---

# Story SSS-3: 实现基础 bounded capability

Status: implemented-pending-full-verification

## Story

As a 用户,
I want 输入一次 PIN 后只授权有限时间和有限签名次数,
so that dApp 不能无限使用 session 进行签名。

## Acceptance Criteria

1. [AC1] session 中包含 `capabilityId` 或等价授权引用。
2. [AC2] capability 支持 `expiresAt`、`maxSignCount`、`usedSignCount`。
3. [AC3] 每次 SIGN 前检查 capability 有效期和剩余次数。
4. [AC4] SIGN 成功后扣减 `usedSignCount`。
5. [AC5] capability 更新具备串行化保护，不能被并发请求绕过。
6. [AC6] capability 用尽或过期后，后续 SIGN 必须失败并要求重新授权。

## Tasks / Subtasks

- [x] Task 1: 定义 capability 类型和 store (AC: 1,2)
- [x] Task 2: LOGIN 创建基础 capability (AC: 1,2)
- [x] Task 3: SIGN 前检查 capability (AC: 3,6)
- [x] Task 4: SIGN 成功后扣减次数 (AC: 4)
- [x] Task 5: 增加 capability 级串行锁 (AC: 5)
- [ ] Task 6: 补充单元或集成测试

## Dev Notes

### 当前实现映射

- `packages/sealx-core/src/sealx/sealx-interface.ts`
  - `SealxSession` 新增可选 `capabilityId`，只作为授权元数据，不包含私钥材料。
- `extension/src/entries/background/state/index.ts`
  - 新增 `SigningCapability`、内存 `signingCapabilities`、`consumeSigningCapability()`。
  - LOGIN / `generateSession()` 创建 capability，并将 `capabilityId` 附加到 session。
  - 当前默认 `maxSignCount = 10`。
- `extension/src/entries/background/index.ts`
  - SIGN 前检查 `session.capabilityId`。
  - SIGN 前调用 `consumeSigningCapability()` 校验并扣减次数。
  - capability 缺失、过期、不匹配或次数用尽时清理 session 并拒绝签名。

### Remaining Gap

- 当前没有 UI 配置最大签名次数，默认值为 10。
- 当前在 capability 锁内执行“检查 policy -> 调用 provider -> 签名成功后提交使用次数”，避免并发绕过，同时避免底层签名失败消耗次数。
- 依赖缺失导致 lint/build 和自动化测试尚未执行成功。

---

# Story SSS-4: 实现 EIP-712 金额 policy adapter

Status: implemented-pending-full-verification

## Story

As a 用户,
I want 对已知 EIP-712 签名模板设置单笔金额和累计金额上限,
so that 授权窗口内的签名风险可控。

## Acceptance Criteria

1. [AC1] 定义 `PolicyAdapter` 接口。
2. [AC2] 已知转账模板可识别 asset、amount、chainId、verifyingContract。
3. [AC3] 支持 `maxSingleAmount` 和 `maxTotalAmount`。
4. [AC4] SIGN 成功后扣减 `usedTotalAmount`。
5. [AC5] 未识别金额模板不得自动消耗金额 capability。
6. [AC6] 金额计算使用整数最小单位，不使用浮点数。

## Tasks / Subtasks

- [x] Task 1: 定义 adapter 接口与注册表 (AC: 1)
- [x] Task 2: 实现已知 transfer 模板 adapter (AC: 2)
- [x] Task 3: 接入 SIGN policy 检查 (AC: 3,5,6)
- [x] Task 4: SIGN 成功后扣减累计金额 (AC: 4)
- [ ] Task 5: 补充边界测试

## Dev Notes

### 当前实现映射

- `extension/src/entries/background/policy-adapters.ts`
  - 新增 `PolicyAdapter`、`PolicyAction`、`PolicyAsset`。
  - 新增 transfer adapter，识别 `primaryType = Transfer`、`message.command = transfer`、`message.Command Name = transfer` 或 domain name 中的 transfer 信号。
  - 从 `message.amount` / `message.Amount` 提取金额；当 EIP-712 primary type 中对应字段为 `uint*`，或字段为 `string` 但值是纯整数字符串时才解析，且只接受非负整数或安全整数 number，不解析小数和带逗号的展示金额，避免浮点误差。
  - 从 `coin_type` / `coinType` / `token`、`contract` / `tokenAddress`、domain `chainId`、domain `verifyingContract` 提取 asset 边界信息。
- `extension/src/entries/background/state/index.ts`
  - `SigningCapability` 新增 `maxSingleAmount`、`maxTotalAmount`、`usedTotalAmount`、`asset`。
  - 新增 `runWithSigningCapability()`，在同一个 capability 锁内完成 policy 校验、签名执行、成功后提交 `usedSignCount` / `usedTotalAmount`。
  - 如果 capability 预设了 `asset`，会校验 chainId / verifyingContract / token / symbol 与实际 transfer action 匹配。
  - 未设置金额上限时保持当前时间/次数 capability 行为不变。
  - 设置金额上限后，未知模板或无法安全解析金额会拒绝自动 capability 签名。
- `extension/src/entries/background/index.ts`
  - `SIGN` 改为通过 `runWithSigningCapability()` 包裹 `signTypeContent()`，确保签名成功后才扣减次数和累计金额。

### Remaining Gap

- 当前没有 UI 或 SDK 入口配置 `maxSingleAmount` / `maxTotalAmount`，字段仅作为 capability 内部扩展点存在。
- 当前未补自动化测试；依赖缺失导致 lint/build 尚未执行成功。
- 小数字符串金额（例如 `"50000.00"`）会被视为无法安全解析。若业务希望支持人类可读金额，需要在后续 story 中引入 token decimals 和明确的单位转换规则。

---

# Story SSS-5: 抽象认证方式与 signing provider

Status: implemented-pending-full-verification

## Story

As a 产品团队,
I want 将认证方式和签名后端拆成独立扩展点,
so that 未来可以接入 WebAuthn、Native App 和硬件钱包，而不重写 policy。

## Acceptance Criteria

1. [AC1] `AuthMethod` 与 `SigningProvider` 是独立概念。
2. [AC2] PIN capability flow 不依赖 WebAuthn。
3. [AC3] Memory signing provider 实现统一 `signTypedData()` 接口。
4. [AC4] Native App 与 Hardware provider 可作为后续 provider 接入点。
5. [AC5] policy engine 在 provider 前执行，provider 不绕过 policy。

## Tasks / Subtasks

- [x] Task 1: 定义 `AuthMethod` 和 `SigningProvider` 类型 (AC: 1,3)
- [x] Task 2: 将当前 memory keyring 包装为 MemorySigningProvider (AC: 3)
- [x] Task 3: 明确 Native/Hardware provider 边界文档 (AC: 4)
- [x] Task 4: 确保 SIGN 链路固定先 policy 后 provider (AC: 5)

## Dev Notes

### 当前实现映射

- `extension/src/entries/background/signing-providers.ts`
  - 新增 `AuthMethod = 'pin' | 'webauthn' | 'native-biometric' | 'hardware'`。
  - 新增 `SigningProviderType = 'memory' | 'native-app' | 'hardware'`。
  - 新增统一 `SigningProvider.signTypedData()` 接口。
  - 新增 `MemorySigningProvider`，内部复用当前 `signTypeContent()`，只从传入的内存私钥签 EIP-712。
- `extension/src/entries/background/state/index.ts`
  - `SigningCapability.authMethod` 改为使用 `AuthMethod` 类型，当前创建 capability 时仍为 `'pin'`。
  - policy/capability 逻辑不依赖 WebAuthn，也不依赖具体 signing provider。
- `extension/src/entries/background/index.ts`
  - `SIGN` 先校验 session、memory keyring、capability，再进入 `runWithSigningCapability()`。
  - provider 调用被包在 `runWithSigningCapability()` 的 action 中，确保 policy engine 仍在 provider 前执行。

### Native / Hardware Provider 边界

- Native App provider 后续应实现同一个 `signTypedData(signContent)` 接口，通过 native messaging 与本地程序通信。
- Hardware provider 后续应实现同一个 `signTypedData(signContent)` 接口，通过设备交互完成用户确认和签名。
- Native / Hardware provider 不应自行绕过 capability policy；background 的 `SIGN` 入口必须保持 `policy -> provider` 的固定顺序。

### Remaining Gap

- 当前只实现 MemorySigningProvider，Native App 与 Hardware provider 只有接口边界，没有真实通信实现。
- 当前未补自动化测试；依赖缺失导致 lint/build 尚未执行成功。

## References

- [Source: docs/signing-session-security-optimization.md]

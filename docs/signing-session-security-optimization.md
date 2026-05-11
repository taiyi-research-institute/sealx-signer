# SealX Signer 签名会话安全优化方案

## 背景

当前产品希望避免用户每次 EIP-712 签名都输入 PIN，因此引入了 session 机制。这个目标合理，但现有实现存在一个核心安全问题：session 期间可还原私钥的材料被写入持久化存储。

风险不在于“短时间免 PIN”本身，而在于持久化存储中出现了 session 私钥材料。一旦扩展存储、扩展运行时或同权限代码被攻击，攻击者可能绕过 PIN 继续还原私钥并签名。

优化目标是保留“输入一次 PIN 后短时间免输入”的体验，同时移除持久化 session 私钥材料。

## 目标

- 用户输入一次 PIN 后，可在受限条件下短时间连续签名。
- 私钥解锁后只进入 background 运行时内存，不写入 IndexedDB、localStorage 或 chrome.storage。
- session 只表示授权状态，不保存私钥、私钥密文或可还原私钥的材料。
- 每次签名前必须经过 policy 校验。
- 支持有效期、签名次数、单笔金额、累计金额等授权边界。
- 后续可以扩展 WebAuthn、Native App、硬件钱包，但第一阶段不依赖它们。

## 非目标

- 第一阶段不引入 WebAuthn。
- 第一阶段不实现 Native App。
- 第一阶段不实现硬件钱包。
- 第一阶段不支持所有通用 EIP-712 模板的金额识别，只支持已知业务模板。

## 总体模型

将系统拆成三层：

```text
Auth Method
  - PIN
  - WebAuthn
  - Native biometric
  - Hardware confirmation

Capability / Policy
  - 有效期
  - 最大签名次数
  - 单笔金额上限
  - 累计金额上限
  - host / userId / chainId / contract / primaryType 边界

Signing Provider
  - Memory keyring
  - Native app
  - Hardware wallet
```

第一阶段只实现：

```text
Auth Method: PIN
Capability / Policy: bounded capability
Signing Provider: memory keyring
```

## 推荐流程

### 创建授权

```text
用户输入 PIN
  ↓
background 校验 PIN
  ↓
从长期 vault 解密私钥
  ↓
私钥进入 background 内存 keyring
  ↓
创建 bounded capability
  ↓
返回 session/capability 给 popup
```

### 执行签名

```text
收到 EIP-712 sign request
  ↓
查找 capability
  ↓
校验 expiresAt / host / userId / chainId / verifyingContract / primaryType
  ↓
通过 adapter 解析金额和资产
  ↓
校验 maxSignCount / maxSingleAmount / maxTotalAmount
  ↓
从 memory keyring 获取 signer
  ↓
签名
  ↓
签名成功后扣减 usedSignCount / usedTotalAmount
  ↓
返回 signature
```

如果内存 keyring 中没有 signer，返回 `PIN_REQUIRED` 或 `SESSION_LOCKED`，要求用户重新输入 PIN。

## 数据结构建议

```ts
type AuthMethod = 'pin' | 'webauthn' | 'native-biometric' | 'hardware'

type AuthorizationMode =
  | {
      type: 'capability'
      authMethod: AuthMethod
      expiresAt: number
      maxSignCount?: number
      maxSingleAmount?: string
      maxTotalAmount?: string
    }
  | {
      type: 'per-sign'
      authMethod: AuthMethod
    }
```

```ts
type SigningCapability = {
  id: string
  account: string
  host: string
  userId: string
  origin?: string
  chainId?: number
  verifyingContract?: string
  primaryTypes?: string[]
  expiresAt: number

  maxSignCount?: number
  usedSignCount: number

  maxSingleAmount?: string
  maxTotalAmount?: string
  usedTotalAmount: string

  asset?: {
    token?: string
    symbol?: string
    decimals?: number
  }

  createdAt: number
  authMethod: 'pin'
}
```

内存中保存 signer：

```ts
const memoryKeyrings = new Map<string, Wallet>()
```

持久化存储只保存 capability 元数据和使用计数，不保存 `Wallet`、`privateKey`、`pkHex` 或 session 私钥密文。

## Policy Adapter

EIP-712 是通用结构化数据，不同业务模板的金额字段不一致。因此金额策略不应硬编码字段名，应通过 adapter 识别。

```ts
interface PolicyAdapter {
  match(typedData: Eip712Struct): boolean
  extractAmount(typedData: Eip712Struct): bigint | null
  extractAsset(typedData: Eip712Struct): AssetInfo | null
  describeAction(typedData: Eip712Struct): string
}
```

第一阶段只实现已知模板的 adapter。未识别模板不能自动消耗金额 capability，应走保守策略：

- 只允许单次手动确认；
- 或仅允许时间/次数限制；
- 或拒绝自动 capability 签名。

## 并发与一致性

签名前检查 policy，签名成功后扣减次数和金额。这个过程必须避免并发绕过。

典型风险：

```text
请求 A 检查剩余额度 100，通过
请求 B 同时检查剩余额度 100，也通过
A 签名 80
B 签名 80
最终实际签出 160
```

因此需要为同一个 capability 增加串行锁，或使用可保证一致性的更新流程。

## 实施阶段

具体用户故事拆分与执行状态见：

- `_bmad-output/implementation-artifacts/signing-session-security-stories.md`

### Phase 1：移除 session 私钥持久化

涉及重点文件：

- `extension/src/entries/background/state/index.ts`
- `extension/src/entries/background/index.ts`
- `extension/src/core/utils/helper.ts`
- `extension/src/core/state/session/index.ts`

改动：

- 删除 `base-info.pks` 写入链路。
- `generateSession()` 不再生成或保存 `pkHex`。
- 新增 `memoryKeyringStore`。
- `SIGN` 入口只从内存 signer 签名。
- `SIGN` 强制检查 session/capability 是否过期。

### Phase 2：bounded capability

改动：

- 增加 capability store。
- session 中保存 `capabilityId`。
- 签名前检查有效期、次数、host、userId。
- 签名成功后扣减次数。
- logout、reset PIN、import key、过期时清理 capability 和 memory keyring。

### Phase 3：金额 policy

改动：

- 增加 EIP-712 policy adapters。
- 支持单笔金额和累计金额。
- 第一阶段仅支持已知 transfer 模板，金额必须是整数最小单位。
- 未识别模板在存在金额上限时走保守拒绝；未设置金额上限时仍只受时间和次数限制。
- 增加 capability 级并发锁。

### Phase 4：认证方式和签名后端扩展

后续扩展：

- WebAuthn：作为 PIN 的替代认证入口。
- Native App：作为新的 signing provider。
- Hardware Wallet：作为新的 signing provider。

WebAuthn 不应作为 capability 的必要条件。它只是认证方式之一，和 PIN 处于同一抽象层。

第一阶段只落地 provider 接口边界：

- `AuthMethod` 表示用户如何创建 capability，例如 PIN、WebAuthn、Native biometric、Hardware confirmation。
- `SigningProvider` 表示私钥或签名能力在哪里执行，例如 Memory、Native App、Hardware。
- background `SIGN` 入口必须固定为 `capability/policy -> signing provider`，任何 provider 都不能绕过 policy。

## 验收标准

- IndexedDB / chrome storage 中不再出现 session 私钥材料。
- 浏览器重启或 extension service worker 重启后，不能继续无 PIN 签名。
- session/capability 过期后，`SIGN` 必须失败。
- 只有匹配 host/userId 的 capability 能签对应请求。
- 签名次数用完后必须拒绝。
- 单笔金额或累计金额超限时必须拒绝。
- 未识别金额模板不能自动使用金额 capability。
- logout、PIN reset、import key 后必须清理相关 capability 和 memory keyring。

## 推荐结论

优先落地 PIN + bounded capability + memory keyring。这样可以保留“输入一次 PIN 后短时间免输入”的体验，同时移除持久化 session 私钥材料。

WebAuthn、Native App 和硬件钱包应作为后续扩展，不应阻塞第一阶段安全模型收敛。

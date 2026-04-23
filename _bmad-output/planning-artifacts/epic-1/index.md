# Epic 1: Test 模拟交易 Task 签名功能

## 概述

在 test 应用中添加模拟交易 Task 功能，参考 `task-review-transfer.html` 的业务场景，实现一个完整的交易签名审核流程。用户可以在测试页面模拟发起一笔转账交易，通过 SealX 插件进行签名审批。

---

## 业务背景

参考 `custody-prototype/pages/task-review-transfer.html` 的交易审核页面：

### 交易详情
- **转账金额**: 50,000.00 USDT (ERC-20, Ethereum Mainnet)
- **合约地址**: 0xdac1...1ec7
- **Task ID**: #TRX-8829
- **有效期**: 23h 50m

### 发送方信息
- **账户类型**: Payment Account
- **账户 ID**: 88293049
- **地址**: 0x71C...9A23
- **旅行规则 - 发起方 (Travel Rule Originator)**:
  - 名称: Digital Account Fdn.
  - 位置: Singapore
  - VASP: Cregis (已验证)

### 接收方信息
- **收款方**: Creative Solutions Ltd
- **别名**: Creative Solutions Ltd
- **地址**: 0x89a42...B4c9
- **旅行规则 - 受益人 (Travel Rule Beneficiary)**:
  - 名称: Creative Solutions Ltd
  - 位置: British Virgin Islands
  - VASP: Binance (已验证)

### 审批流程
1. ✅ **Initiated** - John Doe, Today 10:30 AM
2. ✅ **Risk Policy Check** - Passed (Auto), Today 10:30 AM
3. ⏳ **Awaiting Approval** - Threshold: 2 of 3 admins must approve
4. ⬜ **Execution** - Pending approval

---

## 用户故事

### Story 1.1: 交易数据展示
**作为** 测试用户
**我想要** 在测试页面看到模拟的交易详情
**以便** 了解待签名交易的全貌

**验收标准**:
- [ ] 显示转账金额 (50,000 USDT)
- [ ] 显示发送方账户信息
- [ ] 显示接收方账户信息
- [ ] 显示旅行规则信息 (Originator/Beneficiary)
- [ ] 显示 Task ID 和有效期

### Story 1.2: 发起签名请求
**作为** 测试用户
**我想要** 点击按钮发起签名请求
**以便** 测试与 SealX 插件的签名交互

**验收标准**:
- [ ] 页面有 "Sign" 按钮
- [ ] 点击后构建 EIP712 签名数据
- [ ] 调用 `signBySealx()` SDK 方法
- [ ] 显示签名等待状态

### Story 1.3: 签名数据构造
**作为** 开发者
**我想要** 构造符合 EIP712 标准的交易签名数据
**以便** 与真实业务系统格式保持一致

**验收标准**:
- [ ] Domain separator 包含系统标识
- [ ] Message 包含交易核心字段 (from, to, amount, token)
- [ ] 包含旅行规则字段
- [ ] layout 配置与页面元素 data-key 对应

### Story 1.4: 签名响应处理
**作为** 测试用户
**我想要** 签名完成后收到响应
**以便** 确认签名成功并获取签名结果

**验收标准**:
- [ ] 显示签名状态变化
- [ ] 显示签名字符串 (截断显示)
- [ ] 可以复制完整签名
- [ ] 调用 `sendSignResponse()` 通知业务系统

---

## 技术要点

### 数据结构 (EIP712 Message)
```javascript
{
  "Task ID": "TRX-8829",
  "Command Name": "transfer",
  "From": {
    "Account Type": "Payment Account",
    "Account ID": "88293049",
    "Address": "0x71C...9A23",
    "Originator": {
      "Name": "Digital Account Fdn.",
      "Location": "Singapore",
      "VASP": "Cregis",
      "Verified": true
    }
  },
  "To": {
    "Name": "Creative Solutions Ltd",
    "Address": "0x89a42...B4c9",
    "Beneficiary": {
      "Name": "Creative Solutions Ltd",
      "Location": "British Virgin Islands",
      "VASP": "Binance",
      "Verified": true
    }
  },
  "Amount": "50000.00",
  "Token": "USDT",
  "Network": "Ethereum Mainnet",
  "Contract": "0xdac1...1ec7",
  "Valid Until": "23h 50m"
}
```

### 页面元素 data-key 映射
| 字段 | data-key | 类型 |
|------|----------|------|
| Task ID | `task_id.TRX-8829` | value |
| Command | `command.transfer` | value |
| Amount | `amount.50000.00` | value |
| Token | `token.USDT` | value |
| From Account | `from.account_id.88293049` | value |
| From Address | `from.address.0x71C...9A23` | value |
| To Name | `to.name.Creative Solutions Ltd` | value |
| To Address | `to.address.0x89a42...B4c9` | value |
| Valid Until | `valid_until.23h50m` | value |

---

## 依赖关系

- 依赖 `sealx-sdk` 已集成
- 依赖 SealX Chrome 扩展已安装
- 依赖 EIP712 签名功能已实现

---

## 成功标准

1. 测试页面可以完整展示交易详情
2. 点击 Sign 按钮可以触发签名流程
3. SealX 插件可以正确接收并显示签名请求
4. 签名完成后测试页面可以显示签名结果
5. 签名数据格式与业务系统保持一致

---

## 文件清单

| 文件 | 说明 |
|------|------|
| `test/src/App.js` | 测试页面主组件 |
| `test/src/App.css` | 样式文件 |
| 参考: `custody-prototype/pages/task-review-transfer.html` | 业务参考页面 |

---

*Created by BMAD - 2026-03-19*

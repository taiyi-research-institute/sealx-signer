# Story 1.1: 交易数据展示

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**作为** 测试用户,
**我想要** 在测试页面看到模拟的交易详情,
**以便** 了解待签名交易的全貌

## Acceptance Criteria

1. [x] 显示转账金额 (50,000 USDT)
2. [x] 显示发送方账户信息
3. [x] 显示接收方账户信息
4. [x] 显示旅行规则信息 (Originator/Beneficiary)
5. [x] 显示 Task ID 和有效期

## Tasks / Subtasks

- [ ] Task 1: 创建交易展示组件 (AC: 1-5)
  - [ ] Subtask 1.1: 添加交易详情卡片样式 (参考 task-review-transfer.html)
  - [ ] Subtask 1.2: 显示转账金额和代币信息
  - [ ] Subtask 1.3: 显示发送方/接收方信息
  - [ ] Subtask 1.4: 显示旅行规则信息
  - [ ] Subtask 1.5: 添加 data-key 属性用于元素定位

## Dev Notes

### 项目结构

- 测试页面: `test/src/App.js`
- 样式文件: `test/src/App.css`

### 现有样式参考

| 类名 | 用途 |
|------|------|
| `.order-info` | 订单信息容器 |
| `.order-row` | 订单行，flex 布局 |
| `.order-row .label` | 标签 |
| `.order-row .value` | 值，monospace 字体 |
| `.info-group` | 信息分组 |

### 参考页面布局 (task-review-transfer.html)

```
Transaction Details Card
├── Transfer Amount Section (居中)
│   ├── 50,000.00 USDT
│   └── ERC-20, Contract address
├── From/To Grid
│   ├── From Card
│   │   ├── Account info
│   │   └── Travel Rule: Originator
│   └── To Card
│       ├── Account info
│       └── Travel Rule: Beneficiary
├── Proposal
└── Meta Info (Unit, Created At, Expires, Task ID)
```

### data-key 映射表

| 字段 | data-key 格式 |
|------|---------------|
| Task ID | `task_id.TRX-8829` |
| Command | `command.transfer` |
| Amount | `amount.50000.00` |
| Token | `token.USDT` |
| From Account | `from.account_id.88293049` |
| From Address | `from.address.0x71C...9A23` |
| From Name | `from.name.Payment Account` |
| To Name | `to.name.Creative Solutions Ltd` |
| To Address | `to.address.0x89a42...B4c9` |
| Network | `network.ERC-20` |
| Contract | `contract.0xdac1...1ec7` |
| Valid Until | `valid_until.23h50m` |
| Originator Name | `originator.name.Digital Account Fdn.` |
| Originator Location | `originator.location.Singapore` |
| Beneficiary Name | `beneficiary.name.Creative Solutions Ltd` |
| Beneficiary Location | `beneficiary.location.British Virgin Islands` |

### 旅行规则信息

**Originator (发送方):**
- Name: Digital Account Fdn.
- Location: Singapore
- VASP: Cregis (已验证)

**Beneficiary (接收方):**
- Name: Creative Solutions Ltd
- Location: British Virgin Islands
- VASP: Binance (已验证)

## Dev Agent Record

### Agent Model Used

MiniMax-M2.5

### Debug Log References

### Completion Notes List

### File List

- `test/src/App.js` - 添加交易展示组件
- `test/src/App.css` - 添加样式

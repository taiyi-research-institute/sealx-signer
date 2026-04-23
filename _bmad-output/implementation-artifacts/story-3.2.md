# Story 3.2: 创建业务系统集成示例

Status: done

## Story

As a 开发者,
I want 创建业务系统集成示例页面,
so that 演示如何在实际业务系统中使用定位功能。

## Acceptance Criteria

1. [AC1] 页面包含典型的 EIP712 签名数据（如订单信息、转账信息）
2. [AC2] 页面元素添加正确的 `data-key` 属性
3. [AC3] 页面调用 SDK 注册可定位的 key
4. [AC4] 用户可以测试点击插件数据项定位到页面元素

## Tasks / Subtasks

- [x] Task 1: 创建示例页面 (AC: 1,2)
  - [x] Subtask 1.1: 创建包含 EIP712 数据的示例页面
  - [x] Subtask 1.2: 为数据元素添加 data-key 属性
- [x] Task 2: 集成 SDK (AC: 3,4)
  - [x] Subtask 2.1: 引入 sealx-sdk 并调用 registerLocatableKeys
  - [x] Subtask 2.2: 调用 onLocateElement 监听定位消息

## Dev Notes

### 相关架构约束

- 示例页面使用 React 构建
- 使用 sealx-sdk 的 registerLocatableKeys 和 onLocateElement
- data-key 属性使用点号分隔嵌套字段

### 项目结构参考

- 测试页面: `test/sealx-test/`
- SDK: `packages/sealx-sdk/src/index.ts`

### 实现思路

```typescript
// 引入 SDK
import { registerLocatableKeys, onLocateElement } from 'sealx-sdk';

// 注册需要定位的 keys
registerLocatableKeys(['orderId', 'message.from', 'message.to']);

// 监听定位消息
onLocateElement();
```

示例页面 HTML 结构:
```html
<div data-key="orderId">ORDER-12345</div>
<div data-key="message.from">0xABC...DEF</div>
<div data-key="message.to">0x123...456</div>
```

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2] - Epic 中的需求定义

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

### Completion Notes List

- 在 test/sealx-test/src/App.tsx 中添加了元素定位集成示例
- 使用 useEffect 在组件挂载时初始化定位功能
- 注册的 keys: orderId, message.from.name, message.from.wallet, message.to.name, message.to.wallet, message.contents
- 在页面上添加了订单信息展示区域，包含带 data-key 属性的数据项

### File List

- test/sealx-test/src/App.tsx (修改)
- test/sealx-test/src/App.css (修改)
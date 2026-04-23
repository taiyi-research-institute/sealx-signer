# Story 3.1: 扩展 SealX SDK 定位 API

Status: done

## Story

As a 业务系统开发者,
I want 在业务系统中注册可定位的 key,
so that 插件能够定位到页面中的对应元素。

## Acceptance Criteria

1. [AC1] SDK 提供 `registerLocatableKeys(keys: string[])` 方法
2. [AC2] 业务系统可以调用此方法注册需要被定位的 key
3. [AC3] SDK 监听来自扩展的定位消息
4. [AC4] 收到消息时调用页面回调函数并高亮对应元素

## Tasks / Subtasks

- [x] Task 1: 实现 registerLocatableKeys 方法 (AC: 1,2)
  - [x] Subtask 1.1: 添加 registerLocatableKeys 函数到 sealx-sdk
  - [x] Subtask 1.2: 实现 key 注册和验证逻辑
- [x] Task 2: 集成定位消息监听 (AC: 3,4)
  - [x] Subtask 2.1: 复用已有的 onLocateElement 函数
  - [x] Subtask 2.2: 实现根据注册的 keys 过滤定位请求

## Dev Notes

### 相关架构约束

- 需要复用 Story 2.3 已实现的 onLocateElement 函数
- registerLocatableKeys 需要与 onLocateElement 配合使用
- 需要支持可选的自定义定位回调

### 项目结构参考

- SDK 主文件: `packages/sealx-sdk/src/index.ts`
- 定位消息类型: `packages/sealx-message/src/contracts/message.ts`
- 消息主题枚举: `packages/sealx-message/src/enums/index.ts`

### 实现思路

```typescript
// 使用方式
import { registerLocatableKeys, onLocateElement } from 'sealx-sdk';

// 注册需要定位的 keys
registerLocatableKeys(['orderId', 'message.from', 'message.to']);

// 监听定位消息（可选自定义定位逻辑）
onLocateElement((key, value) => {
  // 只处理已注册的 key
  return document.querySelector(`[data-key="${key}"]`) as HTMLElement;
});
```

### 测试标准

- 验证 registerLocatableKeys 正确注册 keys
- 验证未注册的 key 不会触发高亮
- 验证 onLocateElement 能接收到定位消息

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1] - Epic 中的需求定义
- [Source: _bmad-output/implementation-artifacts/story-2.3.md] - Story 2.3 实现参考

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

### Completion Notes List

- 实现了 `registerLocatableKeys(keys: string[])` 函数，用于注册可定位的 key
- 实现了 `isKeyRegistered(key: string)` 内部函数，用于检查 key 是否已注册
- 修改了 `onLocateElement` 函数，在处理定位请求前检查 key 是否已注册
- 支持向后兼容：如果没有注册任何 key，则允许所有 key（保持原有行为）
- 代码审查修复: 添加空字符串过滤 `if (key && key.trim())`

### Review Follow-ups (AI)

- [ ] [LOW] 添加空字符串过滤 - 已修复
- [ ] [MEDIUM] 添加单元测试 - 项目无测试框架，无法自动化测试

### File List

- packages/sealx-sdk/src/index.ts (修改)

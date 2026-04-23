# Story 2.2: 使用 Messager 发送定位消息

Status: done

## Story

As a 开发者,
I want 使用 sealx-messager 的 Messager 组件实现消息发送,
so that 点击数据项时能触发页面元素定位。

## Acceptance Criteria

1. [AC1] 使用 Messager 发送定位消息（receiver: MessageChannel.INPAGE）
2. [AC2] Content Script 已通过 sealx-message 消息组件自动处理消息接收和转发
3. [AC3] 消息使用标准的 SealxRequest 格式
4. [AC4] 前端 SDK 通过 messager.on(SealxTopic.LOCATE_ELEMENT) 监听定位消息

## Tasks / Subtasks

- [x] Task 1: 实现消息发送 (AC: 1,2,3)
  - [x] Subtask 1.1: 更新 locateElement.ts 使用 Messager 发送消息
  - [x] Subtask 1.2: 使用 MessageChannel.INPAGE 作为接收者

## Dev Notes

### 相关架构约束

- 使用 MessagerManager.getMessager() 获取 Messager 实例
- 使用 messager.send() 发送消息
- 目标 channel 为 INPAGE（业务系统页面）

### 项目结构参考

- 定位处理: `extension/src/core/utils/locateElement.ts`
- 消息组件: `packages/sealx-message/src/messager/`

### 实现内容

更新 locateElement.ts:
```typescript
import { MessagerManager, SealxTopic, MessageChannel } from 'sealx-message';
import type { LocateElementMessage } from 'sealx-message';

const messager = MessagerManager.getMessager();
const payload: LocateElementMessage = { key: dataKey, value };
messager.send(SealxTopic.LOCATE_ELEMENT, payload, MessageChannel.INPAGE);
```

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2] - Epic 中的需求定义

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

### Completion Notes List

- 使用 Messager 发送定位消息
- 接收者设置为 MessageChannel.INPAGE

### File List

- extension/src/core/utils/locateElement.ts (修改)

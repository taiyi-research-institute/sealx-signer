# Story 2.1: 定义定位消息协议

Status: done

## Story

As a 开发者,
I want 定义插件与业务系统页面之间的定位消息格式,
so that 双方能够正确传递定位信息。

## Acceptance Criteria

1. [AC1] 消息包含 topic 字段（值为 'locate-element'，对应 SealxTopic.LOCATE_ELEMENT）
2. [AC2] 消息包含 payload.key 字段（要定位的 data-key 值）
3. [AC3] 消息包含可选的 payload.value 字段（当前显示的值）
4. [AC4] 在 sealx-message 包中定义 LocateElementMessage 类型
5. [AC5] 在 SealxTopic 枚举中添加 LOCATE_ELEMENT

## Tasks / Subtasks

- [x] Task 1: 定义消息协议 (AC: 1,2,3,4,5)
  - [x] Subtask 1.1: 在 SealxTopic 枚举中添加 LOCATE_ELEMENT
  - [x] Subtask 1.2: 创建 LocateElementMessage 接口

## Dev Notes

### 相关架构约束

- 消息使用标准的 SealxRequest 格式
- 在 sealx-message 包中定义类型

### 项目结构参考

- 消息枚举: `packages/sealx-message/src/enums/index.ts`
- 消息类型: `packages/sealx-message/src/contracts/message.ts`

### 实现内容

1. 在 `SealxTopic` 枚举中添加 `LOCATE_ELEMENT = 'locate-element'`
2. 创建 `LocateElementMessage` 接口:
   ```typescript
   export interface LocateElementMessage {
       key: string
       value?: string
   }
   ```

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1] - Epic 中的需求定义

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

### Completion Notes List

- 在 SealxTopic 枚举中添加 LOCATE_ELEMENT
- 创建 LocateElementMessage 接口

### File List

- packages/sealx-message/src/enums/index.ts (修改)
- packages/sealx-message/src/contracts/message.ts (修改)

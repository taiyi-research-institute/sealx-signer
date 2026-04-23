# Story 1.1: 定义 data-key 属性渲染规则

Status: ready-for-dev

## Story

As a 开发者,
I want 为任务数据渲染组件添加 data-key 属性,
so that 每个数据项都可以被唯一标识和定位。

## Acceptance Criteria

1. [AC1] EIP712 签名任务包含嵌套的 message 数据，任务详情页渲染数据时，为每个叶子节点数据项添加 `data-key` 属性
2. [AC2] 单层字段使用字段名作为 key（如 `data-key="orderId"`）
3. [AC3] 嵌套字段使用点号分隔父级字段名（如 `data-key="message.orderId"`）

## Tasks / Subtasks

- [ ] Task 1: 设计 data-key 生成算法 (AC: 1,2,3)
  - [ ] Subtask 1.1: 分析 EIP712 数据结构，确定叶子节点识别规则
  - [ ] Subtask 1.2: 设计递归遍历函数，生成嵌套 key 路径
  - [ ] Subtask 1.3: 编写单元测试，覆盖单层和嵌套场景

## Dev Notes

### 相关架构约束

- 需要兼容现有的 EIP712 签名数据结构
- 不影响现有的模板渲染逻辑
- data-key 命名遵循 JavaScript 变量命名规范

### 项目结构参考

- 任务渲染组件位于: `extension/src/entries/popup/components/task/`
- 签名数据渲染: `extension/src/entries/popup/components/task/task-render.tsx`
- 模板定义: `extension/src/entries/popup/components/task/init*Template.ts`

### 测试标准

- 单元测试覆盖单层字段场景
- 单元测试覆盖嵌套字段场景（2层及以上）
- 边界测试：空对象、null 值、数组处理

## References

- [Source: docs/feature清单.md] - 现有功能清单
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1] - Epic 中的需求定义

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

### Completion Notes List

### File List

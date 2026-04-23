# Story 1.2: 改造 SignTaskRender 组件

Status: ready-for-dev

## Story

As a 开发者,
I want 修改 SignTaskRender 组件,
so that 自动为渲染的数据项添加 data-key 属性。

## Acceptance Criteria

1. [AC1] SignTaskRender 组件渲染签名内容时，自动计算并添加正确的 `data-key` 属性
2. [AC2] 支持所有内置模板（Board、Authorizer、Transfer 等）
3. [AC3] 不影响现有的模板渲染逻辑

## Tasks / Subtasks

- [ ] Task 1: 改造 SignTaskRender 组件 (AC: 1,2,3)
  - [ ] Subtask 1.1: 在渲染数据项的函数中添加 data-key 属性
  - [ ] Subtask 1.2: 验证 Board 模板渲染正确
  - [ ] Subtask 1.3: 验证 Authorizer 模板渲染正确
  - [ ] Subtask 1.4: 验证 Transfer 模板渲染正确
  - [ ] Subtask 1.5: 验证外部模板（OutsideTemplateRender）渲染正确

## Dev Notes

### 相关架构约束

- 需要复用现有的模板渲染逻辑
- 不修改模板文件，只修改渲染层
- data-key 属性需要添加到实际的 DOM 元素上

### 项目结构参考

- 主渲染组件: `extension/src/entries/popup/components/task/task-render.tsx`
- 模板目录: `extension/src/entries/popup/components/task/init*Template.ts`
- 默认模板: `extension/src/entries/popup/components/task/DefaultTemplateRender.tsx`

### 测试标准

- 手动测试各模板类型的数据项渲染
- 验证 data-key 属性正确生成
- 验证不影响原有渲染效果

## References

- [Source: docs/feature清单.md] - 现有功能清单
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2] - Epic 中的需求定义
- [Source: _bmad-output/implementation-artifacts/story-1.1.md] - Story 1.1 依赖

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

### Completion Notes List

### File List

- extension/src/entries/popup/components/task/task-render.tsx (修改)

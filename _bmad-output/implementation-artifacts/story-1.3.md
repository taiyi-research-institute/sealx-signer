# Story 1.3: 为数据项添加点击事件

Status: ready-for-dev

## Story

As a 用户,
I want 点击任务详情页中的数据项,
so that 触发定位操作。

## Acceptance Criteria

1. [AC1] 任务详情页显示带有 data-key 属性的数据项，用户点击某个数据项时触发定位事件
2. [AC2] 事件包含该数据项的 key 和 value
3. [AC3] 视觉上有轻微的点击反馈（如 hover 效果）

## Tasks / Subtasks

- [ ] Task 1: 添加点击事件处理器 (AC: 1,2)
  - [ ] Subtask 1.1: 在数据项元素上添加 onClick 事件监听
  - [ ] Subtask 1.2: 从事件中提取 data-key 属性值和显示内容
  - [ ] Subtask 1.3: 触发定位事件，传递 key 和 value
- [ ] Task 2: 添加视觉反馈样式 (AC: 3)
  - [ ] Subtask 2.1: 添加 hover 样式（鼠标指针变化）
  - [ ] Subtask 2.2: 添加点击时的视觉反馈（如边框颜色变化）

## Dev Notes

### 相关架构约束

- 点击事件需要触发与业务系统页面的通信
- 事件消息格式待 Story 2.1 定义
- 样式需要与现有 UI 保持一致

### 项目结构参考

- 主渲染组件: `extension/src/entries/popup/components/task/task-render.tsx`
- 样式文件: `extension/src/entries/popup/components/task/index.css`
- 消息通信: `extension/src/core/messager/`

### 测试标准

- 手动测试点击数据项触发事件
- 验证事件包含正确的 key 和 value
- 验证 hover 效果正常工作

## References

- [Source: docs/feature清单.md] - 现有功能清单
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3] - Epic 中的需求定义
- [Source: _bmad-output/implementation-artifacts/story-1.2.md] - Story 1.2 依赖
- [Source: _bmad-output/implementation-artifacts/story-2.1.md] - Story 2.1 (消息协议定义)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

### Completion Notes List

### File List

- extension/src/entries/popup/components/task/task-render.tsx (修改)
- extension/src/entries/popup/components/task/index.css (修改)

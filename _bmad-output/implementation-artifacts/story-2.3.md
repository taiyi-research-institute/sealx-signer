# Story 2.3: 实现页面元素高亮显示

Status: done

## Story

As a 开发者,
I want 业务系统页面接收到定位消息后高亮显示对应元素,
so that 用户能快速找到对应数据。

## Acceptance Criteria

1. [AC1] 业务系统页面接收到 LOCATE_ELEMENT 消息
2. [AC2] 页面找到匹配 data-key 属性的元素时添加高亮样式
3. [AC3] 高亮样式：2px solid #007AFF 边框，rgba(0, 122, 255, 0.1) 背景色
4. [AC4] 3秒后自动移除高亮样式
5. [AC5] 定位失败时静默处理，不显示错误

## Tasks / Subtasks

- [x] Task 1: 实现高亮功能 (AC: 1,2,3,4,5)
  - [x] Subtask 1.1: 在 sealx-sdk 中添加 onLocateElement 函数
  - [x] Subtask 1.2: 实现元素查找和高亮逻辑
  - [x] Subtask 1.3: 实现自动移除高亮

## Dev Notes

### 相关架构约束

- 使用 messager.on(SealxTopic.LOCATE_ELEMENT) 监听消息
- 高亮样式使用 CSS 直接应用
- 使用 setTimeout 3秒后移除高亮

### 项目结构参考

- SDK 主文件: `packages/sealx-sdk/src/index.ts`
- 消息类型: `packages/sealx-message/src/contracts/message.ts`

### 实现内容

```typescript
// 高亮样式
const HIGHLIGHT_STYLE = {
    border: '2px solid #007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    transition: 'all 0.3s ease'
};

// 默认定位回调
const defaultLocateCallback: LocateElementCallback = (key: string) => {
    return document.querySelector(`[data-key="${key}"]`) as HTMLElement;
};

// onLocateElement 函数
export const onLocateElement = (locateCallback?: LocateElementCallback): (() => void) => {
    const locator = locateCallback || defaultLocateCallback;
    const handleLocate = (request) => {
        const { key, value } = request.payload;
        const element = locator(key, value);
        if (!element) return;
        addHighlight(element);
        setTimeout(() => removeHighlight(element), 3000);
    };
    return messager.on(SealxTopic.LOCATE_ELEMENT, handleLocate, MessageChannel.INPAGE);
};
```

## References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3] - Epic 中的需求定义

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

### Completion Notes List

- 创建 onLocateElement 函数
- 实现元素高亮和自动移除逻辑
- 支持自定义定位回调

### File List

- packages/sealx-sdk/src/index.ts (修改)

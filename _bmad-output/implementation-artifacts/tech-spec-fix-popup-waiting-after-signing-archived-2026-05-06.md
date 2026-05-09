---
title: 'Fix: Popup Stuck on Waiting After Signing in Published Extension'
slug: 'fix-popup-waiting-after-signing'
created: '2026-04-27'
status: 'in-progress'
stepsCompleted: [1, 2]
tech_stack:
  - Chrome Extension Manifest V3
  - React + TypeScript
  - Vite
  - sealx-message
files_to_modify:
  - extension/src/entries/popup/components/task/index.tsx
  - extension/src/entries/popup/components/task/task-render.tsx
  - extension/src/entries/background/popup-manager.ts
  - packages/sealx-sdk/src/index.ts
code_patterns:
  - useEffect with request topic matching
  - Message channel communication (INPAGE, BACKGROUND, POPUP, CONTENT)
  - chrome.action.openPopup lifecycle
  - sealx-message topic routing with prefix sealing-signer-{channel}-{topic}
  - Zustand state management with reply function binding
test_patterns: []
---

# Fix: Popup Stuck on "Waiting ..." After Signing in Published Extension

## Problem Statement

在发布的插件版本中，用户完成签名操作后，popup 页面一直显示 "Waiting ..." 动画，不会自动关闭。本地开发版本没有此问题。

## Root Cause Analysis

### 问题链路

签名流程的状态机存在**状态泄漏**：

1. **`task-render.tsx:321`** - `onApproval()` 中 `setSigning(true)` 被调用
2. **`task-render.tsx:356-358`** - `finally` 块中 `setSigning(false)` **被注释掉**
3. **`index.tsx:112-127`** - 签名完成后通过 `state` 导航回 `/task-home` 时，再次 `setSigning(true)`
4. **`index.tsx:141-142`** - `setSigning(false)` 依赖收到 `SealxTopic.SIGN_RESPONSE` 的响应

### 为什么本地正常、发布版异常？

发布版本（`dist_chrome/`）的构建产物可能存在的差异：

1. **消息传递时序差异** - 生产环境构建的代码压缩/优化可能改变了消息传递的时序
2. **`request.reply` 行为差异** - 在不同环境下 `reply` 函数的执行上下文可能不同
3. **根本原因** - 状态管理设计本身就有缺陷：`setSigning(false)` 过于依赖消息回传的成功，没有本地状态的自我保护机制

### 核心 Bug

`task/index.tsx:112-127` 的 useEffect 在签名完成后：
- 设置 `setSigning(true)` 显示 waiting
- 发送响应给 web 端
- **但没有确保 `setSigning(false)` 一定会被调用**

如果 `SIGN_RESPONSE` 的 response 没有回到 popup 的 request context（发布版中更可能发生），`signing` 状态就永远卡在 `true`。

### 第二个关键 Bug（Advanced Elicitation 发现）

**`PopupManager.closeWindow()` 无法关闭 `chrome.action.openPopup()` 打开的 popup。**

- `popupWindow(2)` 走 `chrome.action.openPopup()`（popup-manager.ts:136），只设置 `actionPopupOpened = true`
- `closeWindow()` 只检查 `findPopupWindow()`（windows.create 打开的）和 `findPopupTab()`（tabs.create 打开的）
- **没有处理 `actionPopupOpened = true` 的情况**

即使 signing 状态正确重置，如果 popup 是通过 `chrome.action.openPopup()` 打开的，`closeWindow()` 也无法关闭它。

## Solution

### 修复 1: `task-render.tsx` — 恢复 `onApproval` 中的 `setSigning(false)`

**文件**: `extension/src/entries/popup/components/task/task-render.tsx`

**当前代码** (line 355-358):
```typescript
} finally {
    // props.setSigning?.(false)
}
```

**修复后**:
```typescript
} finally {
    props.setSigning?.(false)
}
```

**原理**: 签名操作完成后（无论成功或失败），必须立即重置 signing 状态。这是 guaranteed exit path，不依赖任何外部消息回传。

### 修复 2: `task/index.tsx` — 乐观重置 signing 状态

**文件**: `extension/src/entries/popup/components/task/index.tsx`

**当前代码** (line 112-127):
```typescript
useEffect(() => {
    if (!signing && (request.topic === SealxTopic.SIGN || request.topic === SealxTopic.BATCH_SIGN) && state && state.result && state.result.taskId && state.result.signatures.length > 0 && state.result.signCount > 0) {
        setSigning(true)
        const reply = replyRef.current ? replyRef.current : request.reply
        try {
            reply?.(state)
            messager.send(state.result, SealxTopic.SIGN_RESPONSE, MessageChannel.INPAGE)
        } catch (e) {
            console.debug(e, '--------------- 00000 ---------')
        }
    }
}, [state, request, signing])
```

**修复后**:
```typescript
useEffect(() => {
    if (!signing && (request.topic === SealxTopic.SIGN || request.topic === SealxTopic.BATCH_SIGN) && state && state.result && state.result.taskId && state.result.signatures.length > 0 && state.result.signCount > 0) {
        setSigning(true)
        const reply = replyRef.current ? replyRef.current : request.reply
        try {
            reply?.(state)
            messager.send(state.result, SealxTopic.SIGN_RESPONSE, MessageChannel.INPAGE)
        } catch (e) {
            console.debug(e, '--------------- 00000 ---------')
        }
        // 乐观重置：签名响应已发出，不等待 SIGN_RESPONSE 回传
        // 因为回传在发布版中可能延迟或丢失，导致状态卡死
        setSigning(false)
    }
}, [state, request, signing])
```

**原理**: `setSigning(false)` 应该由本地签名操作控制，而不是依赖外部消息回传。`reply()` 和 `messager.send()` 都是发送响应给 web 端，发送完成后 popup 的 waiting 状态就应该结束。

### 修复 3: `popup-manager.ts` — 增加 `chrome.action.openPopup()` 的关闭逻辑

**文件**: `extension/src/entries/background/popup-manager.ts`

**当前 `closeWindow()` 方法** (line 238-265):
```typescript
static async closeWindow() {
    // Switch back to the caller tab if it exists
    if (this.callerTabId) {
        try {
            await chrome.tabs.update(this.callerTabId, { active: true })
        } catch (error) {
            console.warn('Failed to switch back to caller tab:', error)
        }
        this.callerTabId = null
    }

    // Close popup windows opened by chrome.windows.create
    const existingWindow = await this.findPopupWindow()
    if (existingWindow && existingWindow.id) {
        chrome.windows.remove(existingWindow.id)
        return true
    }

    // Close tabs opened by chrome.tabs.create
    const existingTab = await this.findPopupTab()
    if (existingTab && existingTab.id) {
        chrome.tabs.remove(existingTab.id)
        this.openTabs.delete(existingTab.id)
        return true
    }
    return false
}
```

**修复后**:
```typescript
static async closeWindow() {
    // Switch back to the caller tab if it exists
    if (this.callerTabId) {
        try {
            await chrome.tabs.update(this.callerTabId, { active: true })
        } catch (error) {
            console.warn('Failed to switch back to caller tab:', error)
        }
        this.callerTabId = null
    }

    // Close popup windows opened by chrome.windows.create
    const existingWindow = await this.findPopupWindow()
    if (existingWindow && existingWindow.id) {
        chrome.windows.remove(existingWindow.id)
        this.openWindows.delete(existingWindow.id)
        return true
    }

    // Close popup opened by chrome.action.openPopup
    if (this.actionPopupOpened) {
        try {
            await chrome.action.hidePopup()
            this.actionPopupOpened = false
            return true
        } catch (error) {
            console.warn('Failed to hide action popup:', error)
        }
    }

    // Close tabs opened by chrome.tabs.create
    const existingTab = await this.findPopupTab()
    if (existingTab && existingTab.id) {
        chrome.tabs.remove(existingTab.id)
        this.openTabs.delete(existingTab.id)
        return true
    }
    return false
}
```

**原理**: `chrome.action.openPopup()` 打开的 popup 需要调用 `chrome.action.hidePopup()` 来关闭。当前代码完全没有处理这种情况。

## Implementation Tasks

按依赖顺序排列：

### Task 1: 修复 `task-render.tsx` onApproval finally 块

- **文件**: `extension/src/entries/popup/components/task/task-render.tsx`
- **行**: 355-358
- **操作**: 取消注释 `props.setSigning?.(false)`
- **说明**: 确保每次 `onApproval` 执行完毕后，signing 状态被正确重置

### Task 2: 修复 `task/index.tsx` 签名响应处理

- **文件**: `extension/src/entries/popup/components/task/index.tsx`
- **行**: 112-127
- **操作**: 在 try-catch 后增加 `setSigning(false)`
- **说明**: 乐观重置策略，不依赖 SIGN_RESPONSE 回传来重置状态

### Task 3: 修复 `popup-manager.ts` closeWindow

- **文件**: `extension/src/entries/background/popup-manager.ts`
- **行**: 238-265
- **操作**: 增加 `chrome.action.hidePopup()` 调用
- **说明**: 处理 `chrome.action.openPopup()` 模式下的 popup 关闭

### Task 4: 修复 SIGN_RESPONSE 的 tabId 传递

- **文件**: `extension/src/entries/popup/components/task/index.tsx`
- **行**: 118
- **操作**: 在发送 SIGN_RESPONSE 时，确保使用原始 SIGN 请求中的 tabId
- **说明**: 在 `messager.send` 的 payload 中携带 `request.header.tabId`，或者在 `replyRef` 中保留原始 tabId

**当前代码**:
```typescript
messager.send(state.result, SealxTopic.SIGN_RESPONSE, MessageChannel.INPAGE)
```

**修复方案**: 在 TaskHome 组件中保存原始请求的 tabId，并在发送 SIGN_RESPONSE 时使用它：
```typescript
// 在组件中保存原始 tabId
const originTabId = useRef<number | undefined>(undefined)

// 在 request useEffect 中保存
useEffect(() => {
    if (request.header?.tabId) {
        originTabId.current = request.header.tabId
    }
}, [request])

// 在发送 SIGN_RESPONSE 时指定 tabId
messager.send(
    { ...state.result, __tabId: originTabId.current },
    SealxTopic.SIGN_RESPONSE,
    MessageChannel.INPAGE
)
```

或者更根本的方案：在 `onSign` 回调中传递 tabId，让 `messager.send` 的消息 header 中包含正确的 tabId。

### Task 5: 验证构建产物一致性

- 对比本地开发和发布构建的 `manifest.json`、CSP 配置
- 确认 `dist_chrome/` 目录的构建配置没有差异

### 第三个关键 Bug（TabManager tabId 不一致）

**`SIGN_RESPONSE` 消息发送时使用了错误的 tabId。**

完整链路：
1. SIGN 请求到达时，`BackgroundMessager.onMessage` 正确捕获 `sender.tab.id` = 业务页面 tab
2. 但 Popup 发送 `SIGN_RESPONSE` 时，通过 `ExtensionMessager.send()` 创建了一个**全新的 SealxRequest**
3. 新 Request 的 header 由 `ExtensionMessager.header` 生成，**不包含原始 tabId**
4. `ExtensionMessager.postMessage` 检测到 `message.header.tabId` 为空，使用 `TabManager.currentTabId` 填充
5. 此时 `TabManager.currentTabId` 可能已被污染（如 popup tab、用户切换的 tab、或 storage 中的旧值）
6. `chrome.tabs.sendMessage(wrongTabId, ...)` → 消息发送到错误的 tab → 业务页面收不到

```
原始 SIGN 请求: header.tabId = Tab A (正确)
       ↓
Popup 发送 SIGN_RESPONSE:
  → ExtensionMessager.send() 创建新 Request
  → header 不包含 tabId
  → postMessage 用 TabManager.currentTabId 填充
  → TabManager.currentTabId = Tab B (错误！)
  → chrome.tabs.sendMessage(Tab B, SIGN_RESPONSE)
  → Tab A 永远收不到消息
```

即使修复 2（乐观重置 `setSigning(false)`）解决了 waiting 显示问题，**业务页面也收不到签名结果**，导致整个签名流程不完整。

### 第四个潜在 Bug：BackgroundMessager.onMessage 污染 TabManager

每次收到消息时，`BackgroundMessager.onMessage` (line 56-60) 都会执行：
```typescript
if (sender?.tab) {
    message.header.tabId = sender.tab.id
    TabManager.getInstance().currentTab = sender.tab
}
```

这意味着**任何**从 extension tab（如 popup tab）发来的消息，都会把 `TabManager.currentTab` 更新为该 tab。如果 popup 是通过 `chrome.tabs.create` 打开的（非 window 模式），TabManager 会被污染。

## Deep Investigation Findings (Step 2)

### 完整消息流分析

通过深入调查 sealx-message 和 sealx-sdk，确认了完整的 SIGN_RESPONSE 消息流：

```
1. 用户点击 "Sign to Approve"
   ↓
2. task-render.tsx: onApproval() → setSigning(true) → sign() 调用
   ↓
3. sign() 返回 → onSign callback → 发送 SIGN_RESPONSE 到 POPUP (回复原始请求)
   ↓
4. index.tsx:114 → setSigning(true) (再次) → reply() + messager.send(SIGN_RESPONSE, INPAGE)
   ↓
5. messager.send 通过 background onForward 转发到 INPAGE
   ↓
6. sealx-sdk onSign() 收到 SIGN_RESPONSE (监听 POPUP channel)
   ↓
7. sealx-sdk 调用 sendSignResponse() → 发送 SIGN_RESPONSE 回 POPUP
   ↓
8. index.tsx:141 → 收到 SIGN_RESPONSE → setSigning(false) ← 只有这步成功才能关闭 waiting
```

### 关键发现：跨上下文依赖

`setSigning(false)` **依赖于 web 端 SDK 的 `onSign` 回调正确执行**。

如果以下任何环节失败：
1. web 端未加载 sealx-sdk
2. web 端的 `onSign` 监听器未注册
3. content script 未能正确转发消息
4. web 端的 `sendSignResponse` 抛出异常

则 `setSigning(false)` 永远不会被调用。

### `messager.send(SIGN_RESPONSE, INPAGE)` 的实际行为

看 `task/index.tsx:118`:
```typescript
messager.send(state.result, SealxTopic.SIGN_RESPONSE, MessageChannel.INPAGE)
```

这条消息的路径：
- POPUP → `messager.send()` → chrome.runtime.sendMessage →
- BACKGROUND (onForward) → 转发到 CONTENT →
- CONTENT → window.postMessage →
- INPAGE (WindowMessager) → 收到消息

在发布版中，如果 web 页面的 content script 未能正确注入（如 CSP 更严格、页面加载时机等），这个消息链就会断裂。

### 为什么本地正常？

本地开发环境中：
- content script 注入更可靠（`run_at: "document_start"` 更容易满足）
- 消息传递延迟更低
- React dev tools 可能有不同的渲染时序

发布版中：
- Vite 生产构建的代码可能有不同的加载时序
- content script 可能因为页面已部分加载而注入失败
- 消息传递的异步行为更明显

### 更新的修复策略

修复 1 和 修复 2 保持不变。修复策略应确保：
- `setSigning(false)` **不依赖** web 端 SDK 的响应
- 签名操作完成后，由 popup **本地状态**控制 waiting 的结束

## Advanced Elicitation Findings

通过 5 种高级启发方法验证：

| 方法 | 关键发现 |
|------|---------|
| Red Team vs Blue Team | setTimeout 是反模式，应改为乐观重置；guard 条件是正确的 |
| First Principles Analysis | 状态机缺少 guaranteed exit path；状态应由本地操作控制而非外部消息 |
| Pre-mortem Analysis | 发现第二个 bug：actionPopup 模式无法关闭 |
| Self-Consistency Validation | 3 种独立方法验证同一 root cause，结论一致 |
| Failure Mode Analysis | 系统性分析了 6 个组件的失败模式，确认 2 个关键 bug |

## Scope

### In Scope
- 修复 signing 状态泄漏导致 popup 无法关闭的问题
- 修复 `chrome.action.openPopup()` 模式下的 popup 关闭问题
- 确保本地和发布版本行为一致

### Out of Scope
- 签名算法和密码学逻辑
- 其他 popup 路由和页面
- SDK 和消息传递库本身

## Context for Development

### 技术约束
- Chrome Extension Manifest V3 Service Worker 架构
- React Hash Router 单页应用
- sealx-message 消息传递通道（INPAGE / BACKGROUND / POPUP / CONTENT）
- Zustand 状态管理

### 消息通道架构
- POPUP 使用 ExtensionMessager（chrome.runtime.sendMessage/onMessage）
- INPAGE 使用 WindowMessager（window.postMessage）
- CONTENT 使用 ContentMessager（chrome.runtime.sendMessage + window.postMessage 桥接）
- BACKGROUND 使用 BackgroundMessager（chrome.runtime.onMessage）

### 消息流关键路径
- `messager.send(payload, topic, channel)` →  topic 前缀化为 `sealx-signer-{channel}-{topic}`
- `onForward(channel, handler)` → background 转发消息到指定 channel
- `reply(response)` → 反转 sender/receiver，附加 responseId

### 注意事项
- 修改必须在 React useEffect 清理函数中正确处理
- `setSigning` 是 React state setter，调用时需要考虑闭包和依赖项
- 消息传递是异步的，需要考虑时序和 race condition
- 发布版可能需要考虑 Chrome 扩展的 CSP 限制
- `chrome.action.hidePopup()` 仅在 Manifest V3 中可用
- **核心原则**: popup 的 UI 状态不应依赖 web 端 SDK 的响应，应由本地操作控制

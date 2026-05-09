---
title: '优化签名 Waiting 动画效果'
slug: 'optimize-signing-waiting-animation'
created: '2026-05-06'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - Chrome Extension Manifest V3
  - React + TypeScript
  - Tailwind CSS
files_to_modify:
  - extension/src/entries/popup/components/task/index.tsx
code_patterns:
  - React state management (signing state, signTimeout, signProgress)
  - CSS animation via Tailwind (animate-spin, animate-pulse)
  - Chrome visibility API (document.hidden)
  - Map-based ref storage (originTabIdMapRef, currentSigningTaskIdRef)
test_patterns:
  - Manual testing via Chrome extension developer tools
---

# 优化签名 Waiting 动画效果

## Problem Statement

当前签名 waiting 动画使用 `TypingAnimation` 组件（逐字打出 "Waiting ..."，再删除循环），配合 `animate-spin` spinner。存在以下问题：

1. **打字机效果过时** — 逐字打出再删除的循环显得老套，给用户焦虑感
2. **节奏拖沓** — 打字 150ms/字，删除 50ms/字，11 个字符一轮循环耗时过长
3. **视觉噪声大** — 遮罩层有 spinner + 打字文字两种动画，不够简洁
4. **signing 状态与前端回执不同步** — `setSigning(false)` 依赖收到 `SIGN_RESPONSE` 回传（`index.tsx:154`），但当前签名结果已发送给前端后，popup 使用 2 秒超时作为兜底关闭（`index.tsx:127-130`），而非等待前端确认。这导致签名状态与前端回执信息不一致，用户体验不可控

## Solution

### 动画优化
移除 `TypingAnimation` 组件，替换为更现代简洁的设计：
- 保留 spinner 但优化其样式（更大、更平滑）
- 使用简短静态文字 **"Signing..."** 代替循环打字效果
- 文字添加 subtle 的呼吸（pulse）动效，传达正在进行的状态
- 整体更干净、专业、轻量

### 签名状态同步
将 signing 状态的生命周期与前端 `SIGN_RESPONSE` 回执消息绑定：
- 发送签名结果后，**不**再使用固定超时关闭
- 收到前端 `SIGN_RESPONSE` 确认消息后，调用 `setSigning(false)` 并关闭 popup
- 保留超时兜底机制（5 秒），但仅在超时后才强制关闭，避免状态卡死

### Before
```
┌─────────────────────────┐
│  ⊙ spinning circle       │
│  Waiting ... (打字机循环) │
└─────────────────────────┘
```

### After
```
┌─────────────────────────┐
│  ⊙ larger smooth spinner │
│  Signing... (pulse)      │
└─────────────────────────┘
```

## Implementation Tasks

### Task 1: 修改 `task/index.tsx` — 替换 waiting 动画

**文件**: `extension/src/entries/popup/components/task/index.tsx`

**操作**:

1. **删除 `TypingAnimation` 组件**（第 45-79 行整个组件）

2. **替换遮罩层渲染代码**（第 423-428 行）

   当前代码：
   ```tsx
   {signing && (<div className='w-full h-full bg-[#000]/[70%] absolute left-0 top-0 flex items-center justify-center'>
       <div className="flex flex-col items-center">
           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
           <TypingAnimation />
       </div>
   </div>)}
   ```

   替换为：
   ```tsx
   {signing && (<div className='w-full h-full bg-[#000]/[80%] absolute left-0 top-0 flex items-center justify-center'>
       <div className="flex flex-col items-center">
           <div className="animate-spin rounded-full h-16 w-16 border-[3px] border-white/30 border-t-white mb-4"></div>
           <div className="text-white text-[20px] font-[500] animate-pulse">Signing...</div>
       </div>
   </div>)}
   ```

   变化说明：
   | 属性 | 旧 | 新 |
   |------|-----|-----|
   | 遮罩透明度 | `70%` | `80%`（更聚焦） |
   | Spinner 大小 | `h-12 w-12` (48px) | `h-16 w-16` (64px) |
   | Spinner 边框 | `border-b-2` | `border-[3px] border-white/30 border-t-white`（更平滑） |
   | 文字 | 打字机循环 "Waiting ..." | 静态 "Signing..." + `animate-pulse` |
   | 文字大小 | `text-[32px]` | `text-[20px]`（更协调） |

### Task 2: 修改 `task/index.tsx` — signing 状态与前端回执同步

**文件**: `extension/src/entries/popup/components/task/index.tsx`

**操作**:

1. **修改签名完成后的处理逻辑**（第 113-136 行）

   当前代码（使用 2 秒超时关闭）：
   ```tsx
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
           setTimeout(() => {
               setSigning(false)
               closeWindow()
           }, 2000)
       }
   }, [state, request, signing])
   ```

   替换为（移除超时关闭，等待前端回执）：
   ```tsx
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
           // 签名结果已发送，等待前端 SIGN_RESPONSE 回执
           // 不再使用超时关闭，状态由前端回执控制
       }
   }, [state, request, signing])
   ```

2. **增强 `SIGN_RESPONSE` 处理**（第 153-187 行）

   当前代码：
   ```tsx
   useEffect(() => {
       if (request.topic === SealxTopic.SIGN_RESPONSE) {
           setSigning(false)
           const payload = request.payload as { taskId: string, error: string }
           if (payload.error) {
               return
           }
           setList(currentList => {
               const task = currentList.find(a => a.taskId == payload.taskId)
               if (task) {
                   if (task.preViewUrl && previewWindow) {
                       chrome.windows.remove(previewWindow.id!).then(() => {
                           previewWindow = null
                       })
                   }
               }
               const items = currentList.filter(a => a.taskId !== payload.taskId)
               setTotal(items.length)
               if (items.length === 0) {
                   setTimeout(() => {
                       closeWindow()
                   }, 50)
               }
               return items
           })
           try {
               request.reply?.(request.payload as never)
           } catch (e) {
               console.debug(e, '----------- 11111 ------------')
           }
       }
   }, [request])
   ```

   修改为（收到前端回执后：重置 signing 状态 + task list 为空时主动关闭插件）：
   ```tsx
   useEffect(() => {
       if (request.topic === SealxTopic.SIGN_RESPONSE) {
           setSigning(false)
           setSignTimeout(false)
           const payload = request.payload as { taskId: string, error: string }
           if (payload.error) {
               // 签名错误：关闭插件
               closeWindow()
               return
           }
           setList(currentList => {
               const task = currentList.find(a => a.taskId == payload.taskId)
               if (task) {
                   if (task.preViewUrl && previewWindow) {
                       chrome.windows.remove(previewWindow.id!).then(() => {
                           previewWindow = null
                       })
                   }
               }
               const items = currentList.filter(a => a.taskId !== payload.taskId)
               setTotal(items.length)
               // 关键：task list 为空时主动关闭插件
               if (items.length === 0) {
                   setTimeout(() => {
                       closeWindow()
                   }, 50)
               }
               return items
           })
           try {
               request.reply?.(request.payload as never)
           } catch (e) {
               console.debug(e, '----------- 11111 ------------')
           }
       }
   }, [request])
   ```

3. **添加超时兜底**（防止消息链断裂导致状态卡死）

   在签名结果发送后，设置一个较长的超时（20 秒）作为兜底：

   新增 `signTimeout` 状态用于区分正常签名和超时：
   ```tsx
   const [signTimeout, setSignTimeout] = useState(false)
   ```

   在签名结果发送后启动兜底定时器：
   ```tsx
   useEffect(() => {
       if (!signing && (request.topic === SealxTopic.SIGN || request.topic === SealxTopic.BATCH_SIGN) && state && state.result && state.result.taskId && state.result.signatures.length > 0 && state.result.signCount > 0) {
           setSigning(true)
           setSignTimeout(false)
           const reply = replyRef.current ? replyRef.current : request.reply
           try {
               reply?.(state)
               messager.send(state.result, SealxTopic.SIGN_RESPONSE, MessageChannel.INPAGE)
           } catch (e) {
               console.debug(e, '--------------- 00000 ---------')
           }
           // 20 秒兜底超时：如果前端回执未到达，显示超时提示
           const fallbackTimer = setTimeout(() => {
               setSignTimeout(true)
           }, 20000)
           return () => clearTimeout(fallbackTimer)
       }
   }, [state, request, signing])
   ```

   收到 `SIGN_RESPONSE` 回执时清除超时状态：
   ```tsx
   useEffect(() => {
       if (request.topic === SealxTopic.SIGN_RESPONSE) {
           setSigning(false)
           setSignTimeout(false)
           const payload = request.payload as { taskId: string, error: string }
           if (payload.error) {
               closeWindow()
               return
           }
           // ... 后续处理保持
       }
   }, [request])
   ```

   **原理**：
   - 正常流程：前端收到签名结果 → 发送 `SIGN_RESPONSE` → `setSigning(false)` → 关闭 popup
   - 异常流程：消息链断裂或延迟 → 20 秒超时触发 → `setSignTimeout(true)` → 显示 "Signing Timeout" 提示
   - 超时时间从 2 秒延长到 20 秒，给正常消息传递足够的缓冲时间（签名操作可能涉及硬件设备交互，需要更长时间）

4. **修改遮罩层显示** — 超时显示错误提示

   在 signing 遮罩层中区分正常签名和超时状态：
   ```tsx
   {signing && (<div className='w-full h-full bg-[#000]/[80%] absolute left-0 top-0 flex items-center justify-center'>
       {signTimeout ? (
           <div className="flex flex-col items-center">
               <div className="text-[#ff4d4f] text-[20px] font-[500] mb-4">Signing Timeout</div>
               <button
                   onClick={() => {
                       setSigning(false)
                       setSignTimeout(false)
                       closeWindow()
                   }}
                   className="px-4 py-2 bg-[#1677ff] text-white rounded-lg text-[14px]"
               >
                   Close
               </button>
           </div>
       ) : (
           <div className="flex flex-col items-center">
               <div className="animate-spin rounded-full h-12 w-12 border-[3px] border-white/30 border-t-white mb-4"></div>
               <div className="text-white text-[20px] font-[500]">Signing...</div>
           </div>
       )}
   </div>)}
   ```

   **效果**：
   - 正常签名：spinner (Tailwind `animate-spin`) + "Signing..."
   - 超时：红色 "Signing Timeout" + Close 按钮，用户确认后手动关闭
   - **关键**：使用 Tailwind class 而非 inline style 确保 `@keyframes spin` 正确注入

### Task 5: 优化超时 timer 管理和 originTabId 映射

**文件**: `extension/src/entries/popup/components/task/index.tsx`

**操作**:

1. **添加 timer ref 清除超时**：

   新增 `signTimeoutRef` 用于存储定时器 ID，确保收到前端回执时清除定时器：
   ```tsx
   const signTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
   ```

   修改 20 秒兜底超时逻辑：
   ```tsx
   useEffect(() => {
       if (!signing) return
       setSignTimeout(false)
       // 清除之前的定时器
       if (signTimeoutRef.current) {
           clearTimeout(signTimeoutRef.current)
       }
       signTimeoutRef.current = setTimeout(() => {
           setSignTimeout(true)
       }, 20000)
       return () => {
           if (signTimeoutRef.current) {
               clearTimeout(signTimeoutRef.current)
           }
       }
   }, [signing])
   ```

   在 `SIGN_RESPONSE` handler 中清除定时器：
   ```tsx
   useEffect(() => {
       if (request.topic === SealxTopic.SIGN_RESPONSE) {
           setSigning(false)
           setSignTimeout(false)
           // 清除超时定时器
           if (signTimeoutRef.current) {
               clearTimeout(signTimeoutRef.current)
               signTimeoutRef.current = null
           }
           // ... 后续处理保持
       }
   }, [request])
   ```

2. **`originTabIdRef` 改为 Map 存储**：

   当前 `originTabIdRef.current` 在多次签名请求时可能被覆盖，改为 Map 以 `taskId` 为 key：
   ```tsx
   const originTabIdMapRef = useRef<Map<string, number>>(new Map())
   ```

   在 SIGN/BATCH_SIGN 请求时保存：
   ```tsx
   useEffect(() => {
       if (request.topic === SealxTopic.BATCH_SIGN || request.topic === SealxTopic.SIGN) {
           // ... 现有逻辑
           if (request.header?.tabId) {
               // 改为 Map 存储
               const tasks = request.payload instanceof Array ? request.payload : [request.payload]
               tasks.forEach((task: SealxSignTask) => {
                   originTabIdMapRef.current.set(task.taskId, request.header.tabId)
               })
           }
       }
   }, [request])
   ```

   在 `onSign` 回调中读取：
   ```tsx
   const onSign = useCallback(async (taskId: string, signatures: ...) => {
       // ... 现有逻辑
       const signResponsePayload = { taskId, signatures }
       const tabId = originTabIdMapRef.current.get(taskId)
       if (tabId) {
           signResponsePayload.__tabId = tabId
           originTabIdMapRef.current.delete(taskId) // 清理已使用的映射
       }
       messager.send(signResponsePayload, SealxTopic.SIGN_RESPONSE, MessageChannel.INPAGE)
   }, [list])
   ```

3. **明确 `onSign` 的 signing 状态处理**：

   `onSign` 函数中 `setSigning(true)` 和 `closeWindow()` 被注释掉（`index.tsx:207,243-244`）。原因分析：
   - `onSign` 是用户点击"签名"按钮时触发
   - signing 状态由 `useEffect` 监听 SIGN/BATCH_SIGN 请求时设置（`index.tsx:112-128`）
   - `onSign` 只负责发送签名结果，不控制 UI 状态

   **保持现状**：`onSign` 不触发 signing 状态，由请求处理逻辑统一管理。但需添加注释说明：
   ```tsx
   const onSign = useCallback(async (taskId: string, signatures: ...) => {
       // Note: signing state is managed by the SIGN/BATCH_SIGN request handler
       // This callback only sends the signature result
       const reply = replyRef.current
       // ... 其余代码保持不变
   ```

### Task 6: 超时前的视觉过渡反馈

**文件**: `extension/src/entries/popup/components/task/index.tsx`

**操作**:

Pre-mortem 分析发现：用户在 20 秒超时触发前可能感到焦虑，缺少视觉进度反馈。添加过渡效果：

1. **超时前 15 秒添加"即将完成..."过渡文字**：

   新增 `signProgress` 状态表示进度百分比：
   ```tsx
   const [signProgress, setSignProgress] = useState<number>(0)
   ```

   修改 20 秒定时器逻辑，使用 `setInterval` 更新进度：
   ```tsx
   useEffect(() => {
       if (!signing) return
       setSignTimeout(false)
       setSignProgress(0)

       if (signTimeoutRef.current) {
           clearTimeout(signTimeoutRef.current)
       }

       const startTime = Date.now()
       const DURATION = 20000

       signTimeoutRef.current = setTimeout(() => {
           setSignTimeout(true)
       }, DURATION)

       // 每 500ms 更新一次进度
       const progressTimer = setInterval(() => {
           const elapsed = Date.now() - startTime
           const progress = Math.min((elapsed / DURATION) * 100, 100)
           setSignProgress(progress)
       }, 500)

       return () => {
           if (signTimeoutRef.current) {
               clearTimeout(signTimeoutRef.current)
               signTimeoutRef.current = null
           }
           clearInterval(progressTimer)
       }
   }, [signing])
   ```

2. **遮罩层显示进度和过渡文字**：

   ```tsx
   {signing && !signTimeout && (
       <div className='w-full h-full bg-[#000]/[80%] absolute left-0 top-0 flex items-center justify-center'>
           <div className="flex flex-col items-center">
               <div className="animate-spin rounded-full h-16 w-16 border-[3px] border-white/30 border-t-white mb-4"></div>
               {signProgress >= 75 ? (
                   <div className="text-white/80 text-[16px] font-[400] animate-pulse">Almost done...</div>
               ) : (
                   <div className="text-white text-[20px] font-[500]">Signing...</div>
               )}
           </div>
       </div>
   )}
   ```

   **效果**：
   - 0-15 秒：正常 spinner + "Signing..."
   - 15-20 秒（75%+ 进度）："Almost done..." 文字 + 弱化 pulse 动效
   - 20 秒+：超时提示 + Close 按钮

### Task 7: Red Team 防御策略 — 状态同步加固

**文件**: `extension/src/entries/popup/components/task/index.tsx`

**操作**:

1. **添加 `currentSigningTaskIdRef` 防止时序竞态**：

   新增 ref 存储当前正在签名的 taskId，收到回执时验证匹配：
   ```tsx
   const currentSigningTaskIdRef = useRef<string | null>(null)
   ```

   在 SIGN/BATCH_SIGN handler 中设置：
   ```tsx
   useEffect(() => {
       if (!signing && (request.topic === SealxTopic.SIGN || request.topic === SealxTopic.BATCH_SIGN) && state && state.result && state.result.taskId) {
           setSigning(true)
           setSignTimeout(false)
           currentSigningTaskIdRef.current = state.result.taskId
           // ... 发送签名结果
       }
   }, [state, request, signing])
   ```

   在 `SIGN_RESPONSE` handler 中验证：
   ```tsx
   useEffect(() => {
       if (request.topic === SealxTopic.SIGN_RESPONSE) {
           const payload = request.payload as { taskId: string, error: string }
           // 验证 taskId 匹配
           if (currentSigningTaskIdRef.current && payload.taskId !== currentSigningTaskIdRef.current) {
               // 不匹配的 taskId，可能是过期消息，忽略
               console.warn(`Sign response taskId mismatch: expected ${currentSigningTaskIdRef.current}, got ${payload.taskId}`)
               return
           }
           currentSigningTaskIdRef.current = null
           setSigning(false)
           setSignTimeout(false)
           // ... 清除定时器 + 后续处理
       }
   }, [request])
   ```

2. **组件卸载时清理**：

   添加 cleanup useEffect 防止内存泄漏：
   ```tsx
   useEffect(() => {
       return () => {
           originTabIdMapRef.current.clear()
           if (signTimeoutRef.current) {
               clearTimeout(signTimeoutRef.current)
           }
       }
   }, [])
   ```

### Task 8: 页面可见性检查 — 主动超时

**文件**: `extension/src/entries/popup/components/task/index.tsx`

**操作**:

用户在签名过程中切换标签页时，Chrome 可能 throttling popup 的 JavaScript 执行。添加页面可见性检查：

```tsx
useEffect(() => {
    if (!signing) return

    const handleVisibility = () => {
        if (document.hidden && signing && !signTimeout) {
            // 页面隐藏时启动快速超时（5 秒）
            const quickTimer = setTimeout(() => {
                if (signing && document.hidden) {
                    setSignTimeout(true)
                }
            }, 5000)
            return () => clearTimeout(quickTimer)
        }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
}, [signing, signTimeout])
```

**效果**：用户切换到其他标签页后，popup 在 5 秒后自动触发超时，避免后台等待无意义。

### Task 9: 安全加固 — SIGN_RESPONSE 消息来源验证

**文件**: `extension/src/entries/popup/components/task/index.tsx`

**操作**:

Security Audit 发现 `SIGN_RESPONSE` 消息来源不可验证，恶意页面可能伪造消息。添加 tabId 匹配验证：

```tsx
useEffect(() => {
    if (request.topic === SealxTopic.SIGN_RESPONSE) {
        const payload = request.payload as { taskId: string, error: string }

        // 安全验证：检查 tabId 是否与发起签名的 tab 匹配
        const expectedTabId = originTabIdMapRef.current.get(payload.taskId)
        if (expectedTabId && request.header?.tabId && request.header.tabId !== expectedTabId) {
            console.warn(`SIGN_RESPONSE from unexpected tab: expected ${expectedTabId}, got ${request.header.tabId}`)
            return
        }

        // 验证 taskId 匹配（防时序竞态）
        if (currentSigningTaskIdRef.current && payload.taskId !== currentSigningTaskIdRef.current) {
            console.warn(`Sign response taskId mismatch: expected ${currentSigningTaskIdRef.current}, got ${payload.taskId}`)
            return
        }

        currentSigningTaskIdRef.current = null
        setSigning(false)
        setSignTimeout(false)

        // 清除超时定时器
        if (signTimeoutRef.current) {
            clearTimeout(signTimeoutRef.current)
            signTimeoutRef.current = null
        }

        if (payload.error) {
            closeWindow()
            return
        }

        // ... 后续 task list 处理保持
    }
}, [request])
```

**效果**：
- 防止恶意页面伪造 `SIGN_RESPONSE` 关闭 popup 或清除 task list
- 双重验证：tabId 来源 + taskId 匹配
- 不匹配时静默忽略，不暴露内部状态

### In Scope
- 修改 `task/index.tsx` 中的 waiting 动画
- 优化 spinner 样式和文字动效，使用 Tailwind class 确保动画兼容
- 签名状态与前端 `SIGN_RESPONSE` 回执同步，移除 2 秒超时关闭
- 添加超时 timer ref 管理，收到回执时清除定时器
- `originTabIdRef` 改为 Map 存储，防止多次签名请求覆盖
- 超时前视觉过渡反馈（15 秒 "Almost done..." 提示）
- taskId 唯一性验证
- `currentSigningTaskIdRef` 防止时序竞态（过期消息过滤）
- 组件卸载时清理 Map 和定时器
- 页面可见性检查（标签页切换后 5 秒主动超时）
- `SIGN_RESPONSE` 消息来源 tabId 验证（安全加固）
- 收到前端回执后关闭 popup

### Out of Scope
- 签名算法和密码学逻辑
- 其他组件的动画效果
- SDK 和消息传递库本身

## Context for Development

### Codebase Patterns
- React functional components with hooks (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`)
- Tailwind CSS utility classes for styling
- Chrome Extension Manifest V3 with `chrome.windows`, `chrome.tabs`, `chrome.runtime` APIs
- Message passing via `sealx-message` package (`Messager`, `SealxTopic`, `MessageChannel`)
- State management via React state + `sealx-core` (`TabManager`, `SealxSignTask`)

### Files to Reference
| File | Purpose |
|------|---------|
| `extension/src/entries/popup/components/task/index.tsx` | Main task component with `TaskHome`, `SigningOverlay` — signing state management, overlay UI |
| `extension/src/core/background/index.ts` | `closeWindow()` helper — sends `SealxTopic.CLOSE` then calls `window.close()` |
| `extension/src/entries/background/popup-manager.ts` | `PopupManager` — handles popup window creation (`chrome.windows.create`, `chrome.action.openPopup`) |
| `extension/src/entries/popup/components/task/task-render.tsx` | `SignTaskRender` component — renders individual sign tasks |

### Technical Decisions
1. **SigningOverlay** 已从 `TypingAnimation` 替换为更简洁的 spinner + "Signing..." pulse 动画
2. **签名状态同步**：移除 2 秒超时关闭，改为等待前端 `SIGN_RESPONSE` 回执
3. **兜底超时**：20 秒 fallback 防止消息链断裂导致状态卡死，超时显示错误提示 + Close 按钮
4. **`signTimeout` 状态**：新增 `useState(false)` 区分正常/超时状态

**Select:** [A] Advanced Elicitation [P] Party Mode [C] Continue to Generate Spec (Step 3 of 4)

## Acceptance Criteria

- [ ] AC 1: Given 用户发起签名请求，当签名结果返回后，popup 应显示 spinner + "Signing..." 动画，不再显示打字机 "Waiting ..."
- [ ] AC 2: Given 签名进行中，当收到前端 `SIGN_RESPONSE` 回执后，popup 应关闭，signing 状态重置
- [ ] AC 3: Given 签名结果发送后 20 秒内未收到回执，当超时触发时，遮罩层应显示红色 "Signing Timeout" + Close 按钮
- [ ] AC 4: Given 超时状态，当用户点击 Close 按钮时，popup 应关闭，所有状态重置
- [ ] AC 5: Given 签名进度达到 75%（约 15 秒），当仍在等待回执时，文字应切换为 "Almost done..."
- [ ] AC 6: Given 用户切换标签页，当 popup 页面隐藏超过 5 秒时，应触发超时提示
- [ ] AC 7: Given 收到伪造或来源不匹配的 `SIGN_RESPONSE`，popup 应静默忽略，不改变状态
- [ ] AC 8: Given 组件卸载时，所有定时器和 Map 应被正确清理，无内存泄漏
- [ ] AC 9: Given 快速连续发起两次签名请求，当收到回执时，应通过 taskId 验证防止状态混乱

## Dependencies

- 无外部库依赖（所有改动使用现有 React hooks + Tailwind CSS + Chrome API）
- 依赖 `sealx-message` 包的 `SealxTopic.SIGN_RESPONSE` 消息机制
- 依赖前端正确发送 `SIGN_RESPONSE` 回执消息

## Testing Strategy

### Manual Testing Steps
1. 安装插件开发版本，打开 popup
2. 在网页发起签名请求，验证 popup 显示 spinner + "Signing..."
3. 等待前端回执到达，验证 popup 自动关闭
4. 模拟消息丢失（在浏览器 DevTools 中断消息传递），验证 20 秒后显示超时提示
5. 点击 Close 按钮，验证 popup 关闭
6. 签名进行中切换标签页，验证 5 秒后触发超时
7. 快速连续发起两次签名，验证状态不会混乱
8. 验证组件卸载后无内存泄漏（Performance/Memory tab 检查）

### Unit Tests
- 无需新增单元测试（当前项目无 popup 组件单元测试体系）

## Notes

### High-Risk Items
- `SIGN_RESPONSE` 消息链的可靠性：如果前端 bug 导致不发送回执，用户会等待 20 秒超时
- Chrome MV3 Service Worker 的定时器行为在后台可能被 throttling

### Known Limitations
- 超时时间（20 秒）是硬编码，未根据签名复杂度动态调整
- 页面可见性检查仅在 popup 环境生效，side panel 模式下行为可能不同

### Future Considerations
- 考虑支持侧边栏（Side Panel）模式打开插件（用户另外的需求）
- 考虑添加签名进度条（当前仅有文字过渡提示）
- 考虑添加 `SIGN_RESPONSE` 消息签名验证（HMAC）

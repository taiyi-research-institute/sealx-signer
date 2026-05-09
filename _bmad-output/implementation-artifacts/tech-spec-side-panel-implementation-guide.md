---
title: 'Chrome Side Panel 侧边栏模式实现指南'
slug: 'side-panel-implementation-guide'
created: '2026-05-08'
parent: 'switch-to-side-panel-mode'
---

# Side Panel 侧边栏模式实现指南

本文档提供 Chrome Side Panel 迁移的详细实现步骤，包括代码示例、CSS 响应式方案和测试清单。

## 一、架构概览

### 1.1 模式对比

```
┌─────────────────────────────────────────────────────────────────┐
│  当前 Popup 模式                                                  │
│                                                                 │
│  ┌─────────┐      chrome.windows.create()      ┌──────────────┐ │
│  │ Web Page │ ──────────────────────────────→   │ Popup Window  │ │
│  │ (DApp)   │                                  │ 600x856px     │ │
│  └──────────┘                                  └──────────────┘ │
│         │                                        │               │
│         │    Content Script ←→ Inpage Script     │               │
│         └────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  目标 Side Panel 模式                                             │
│                                                                 │
│  ┌─────────────────────┐          ┌──────────────────────────┐  │
│  │      Web Page        │          │    Side Panel            │  │
│  │  (DApp 可见)         │          │   (固定右侧, ~360px)      │  │
│  │                     │          │                          │  │
│  └─────────────────────┘          └──────────────────────────┘  │
│                                                                 │
│  优势: DApp 始终可见，无需窗口切换                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 调用流程图

```
Web Page (DApp)
    │
    │  SealxRequest (SIGN/BATCH_SIGN/BIND_PK)
    ↓
Content Script / Inpage Script
    │
    │  Messager.send() → POPUP channel
    ↓
Background Service Worker
    │
    ├─ onForward handler
    │   ├─ 确定目标路由 (task-home/bind-pubkey)
    │   ├─ PanelManager.openPanel(route, tabId)
    │   │   ├─ chrome.sidePanel.setOptions({ path: '...#route' })
    │   │   └─ chrome.sidePanel.open({ tabId })
    │   │
    │   └─ 等待面板就绪 (心跳/就绪消息)
    │
    └─ 转发消息到 Side Panel
        └─ React Router 导航 → 显示签名 UI
```

## 二、详细实现步骤

### Step 1: Manifest 配置

**文件：** `extension/manifest/manifest.json`

```json
{
    "manifest_version": 3,
    "name": "SealX: Secure Review & Sign What You See for Crypto Assets",
    "version": "1.0.0",
    "description": "SealX is a secure plugin for crypto custody...",

    "action": {
        "default_title": "SealX"
    },

    "side_panel": {
        "default_path": "src/entries/popup/index.html"
    },

    "permissions": [
        "activeTab",
        "storage",
        "scripting",
        "tabs",
        "identity",
        "alarms",
        "sidePanel"
    ],

    "icons": { ... },
    "background": { ... },
    "content_scripts": [ ... ],
    "web_accessible_resources": [ ... ]
}
```

**关键变更：**
- 移除 `action.default_popup`
- 添加 `side_panel.default_path` 指向现有的 popup HTML 入口
- 在 permissions 中添加 `sidePanel`
- 保留 `action.default_title`（鼠标悬停提示）

### Step 2: Vite 构建配置适配

**文件：** `extension/vite-config/chrome.ts`

`@crxjs/vite-plugin` 的 `ManifestV3Export` 类型已支持 `side_panel`，但构建时可能过滤未知字段。需要在 manifest 中显式传递：

```typescript
import { crx, ManifestV3Export } from '@crxjs/vite-plugin';
import baseConfig, { baseManifest } from './base'

export default mergeConfig(baseConfig, defineConfig({
    plugins: [
        crx({
            manifest: {
                ...baseManifest,
                side_panel: {
                    default_path: 'src/entries/popup/index.html'
                }
            } as ManifestV3Export,
            browser: 'chrome',
        })
    ],
}))
```

**构建后验证：** 添加脚本确保 `side_panel` 字段存在于产物中：

```bash
# package.json scripts
"verify:manifest": "node -e \"const m=require('./dist_chrome/manifest.json'); if(!m.side_panel){console.error('MISSING side_panel!');process.exit(1)} else {console.log('OK: side_panel present')}\""
```

### Step 3: PopupManager → PanelManager 重构

**文件：** `extension/src/entries/background/popup-manager.ts`

这是最核心的变更。PopupManager 需要完全重构为 PanelManager。

#### 3.1 PanelManager 完整实现

```typescript
/// <reference types="chrome"/>

import { sessionStore } from "@src/core/state"
import { getSealxInfo } from "./state"
import { MessageChannel, SealxTopic, type Messager } from "sealx-message"
import { TabManager } from "sealx-core"

/**
 * 路由白名单
 * 用于 setOptions({ path }) 拼接时的安全验证
 * 与 React Router 的路由定义保持一致
 */
const ALLOWED_ROUTES = [
    '',                    // 空字符串 = 首页（对应 React Router 的空 hash # 或 #/）
    'login',
    'initialize',
    'initialized',
    'task-home',
    'task-detail',
    'bind-pubkey',
    'reset-pin',
    'set-screen-timer',
    'key-manage',
    'key-export',
    'key-import',
] as const;

type AllowedRoute = typeof ALLOWED_ROUTES[number];

/**
 * PanelManager — Chrome Side Panel 管理器
 *
 * 职责：
 * 1. 打开 side panel（如未打开则打开，已打开则导航）
 * 2. 路由管理（通过 setOptions + URL hash 传递路由）
 * 3. 心跳检测（监控 side panel 是否存活）
 * 4. 关闭/导航（重定义 closeWindow 为 navigate）
 *
 * 不依赖窗口生命周期，改为面板路由管理
 */
export default class PanelManager {
    static panelPath: string = 'src/entries/popup/index.html'
    static messager: Messager | null = null

    // 面板状态
    private static isPanelOpen: boolean = false
    private static currentRoute: string = ''

    // 心跳机制
    private static lastHeartbeatAt: number = 0
    private static heartbeatInterval: ReturnType<typeof setInterval> | null = null

    // 就绪等待
    private static pendingReadyResolvers: Array<{ resolve: (v: boolean) => void; timer: NodeJS.Timeout }> = []

    // 并发请求队列（F8 修复 — 多 tab 并发签名）
    private static requestQueue: Array<{
        route: AllowedRoute;
        tabId: number;
    }> = [];
    private static isProcessing: boolean = false;
    private static processingTabId: number | null = null;

    // ========== 初始化 ==========

    /**
     * 初始化 side panel 配置
     * 替代原来的 PopupManager.setPopupWindow()
     */
    static init() {
        // 方案 A: 点击扩展图标自动打开 side panel
        chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
            .catch(err => console.warn('setPanelBehavior failed:', err))

        // 设置默认路径
        chrome.sidePanel.setOptions({
            path: this.panelPath,
            enabled: true,
        }).catch(err => console.warn('setOptions failed:', err))

        // 启动心跳检测（F23 修复：lastHeartbeatAt 初始为 0，首次检查立即检测到未就绪）
        this.lastHeartbeatAt = 0
        this.startHeartbeatCheck()

        // 监听 side panel 发送的心跳消息
        this.registerHeartbeatListener()
    }

    /**
     * 清理资源
     */
    static dispose() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval)
            this.heartbeatInterval = null
        }
    }

    static setMessager(messager: Messager) {
        this.messager = messager

        // 保留 alarm 检查逻辑
        chrome.alarms.onAlarm.addListener(async (alarm) => {
            if (alarm.name !== 'checkSealx') return
            const tab = TabManager.getInstance().currentTab
            if (tab?.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
                const sealx = await getSealxInfo()
                if (this.messager) {
                    this.messager.send(
                        sealx?.address ?? '',
                        SealxTopic.CHECK_INITIALIZED,
                        MessageChannel.INPAGE
                    )
                }
            }
        })
    }

    // ========== 面板打开 ==========

    /**
     * 打开 side panel 并导航到指定路由
     *
     * 替代原来的 PopupManager.popupWindow(showWindow, route)
     *
     * 并发处理：如果面板正在处理其他 tab 的请求，新请求入队等待
     *
     * @param route - 目标路由
     * @param tabId - 目标 tab ID（自动获取当前活动 tab）
     */
    static async openPanel(route: AllowedRoute = '', tabId?: number | null): Promise<void> {
        // 1. 验证路由
        if (!ALLOWED_ROUTES.includes(route as AllowedRoute)) {
            console.warn(`PanelManager: route "${route}" not in allowlist, ignoring`)
            return
        }

        // 2. 获取 tabId
        const targetTabId = tabId ?? await this.getCurrentTabId()
        if (!targetTabId) {
            console.warn('PanelManager: no target tab found')
            return
        }

        // 3. 如果面板已打开且正在处理其他 tab 的请求，入队等待
        if (this.isPanelOpen && this.isProcessing && this.processingTabId !== targetTabId) {
            this.requestQueue.push({ route, tabId: targetTabId })
            console.log(`PanelManager: request from tab ${targetTabId} queued (${this.requestQueue.length} in queue)`)
            return
        }

        // 4. 标记当前正在处理的 tab
        this.processingTabId = targetTabId
        this.isProcessing = true

        try {
            // 5. 如果面板已打开且存活，直接发送导航消息
            if (this.isPanelOpen && Date.now() - this.lastHeartbeatAt < 15_000) {
                await this.navigateToRoute(route)
                return
            }

            // 6. 面板未打开，需要重新打开：先设置路径，再打开
            const fullPath = route ? `${this.panelPath}#${route}` : this.panelPath
            try {
                await chrome.sidePanel.setOptions({
                    path: fullPath,
                    enabled: true,
                })
            } catch (err) {
                console.error('PanelManager: setOptions failed', err)
            }

            // 7. 打开面板
            try {
                await chrome.sidePanel.open({ tabId: targetTabId })
            } catch (err) {
                // open 失败时降级为导航消息（面板可能已在其他上下文中打开）
                await this.navigateToRoute(route)
                return
            }

            // 8. 记录状态
            this.isPanelOpen = true
            this.currentRoute = route
        } finally {
            this.isProcessing = false
        }

        // 9. 处理队列中的下一个请求（异步非阻塞）
        this.scheduleProcessQueue()
    }

    /**
     * 导航到指定路由（面板已打开时调用）
     * 通过 runtime.sendMessage 通知 React Router 更新
     *
     * F15 修复说明：sendMessage 的 response 只返回给第一个 return true 的监听器。
     * 此处不依赖 response 值，仅依赖消息投递的副作用（side panel 页面接收并导航）。
     * registerHeartbeatListener 对 panel-navigate 返回 false，不会拦截。
     * panel-navigate 消息的实际处理在 App.tsx 的 navigateHandler 中。
     */
    static async navigateToRoute(route: AllowedRoute): Promise<void> {
        try {
            await chrome.runtime.sendMessage({
                type: 'panel-navigate',
                route,
            })
            this.currentRoute = route
        } catch (err) {
            // sendMessage 失败通常意味着侧边栏页面已关闭或未加载
            console.warn('PanelManager: navigate failed', err)
        }
    }

    /**
     * 异步调度队列处理（F16 修复 — 使用 setTimeout 避免递归栈溢出）
     */
    private static scheduleProcessQueue(): void {
        if (this.requestQueue.length === 0) return
        setTimeout(() => this.processNextInQueue(), 0)
    }

    /**
     * 处理队列中的下一个请求
     * 由 side panel 页面在完成签名后调用，或 openPanel 完成后自动调度
     */
    static async processNextInQueue(): Promise<void> {
        if (this.requestQueue.length === 0) return

        const next = this.requestQueue.shift()!
        this.processingTabId = next.tabId
        this.isProcessing = true

        try {
            await this.navigateToRoute(next.route)
            this.currentRoute = next.route
        } finally {
            this.isProcessing = false
        }

        // 异步继续处理下一个，避免调用栈累积
        if (this.requestQueue.length > 0) {
            setTimeout(() => this.processNextInQueue(), 0)
        }
    }

    /**
     * 清除队列中指定 tabId 的请求（tab 关闭时调用）
     */
    static clearQueueForTab(tabId: number): void {
        this.requestQueue = this.requestQueue.filter(r => r.tabId !== tabId)
    }

    // ========== 面板关闭 ==========

    /**
     * 关闭面板 / 结束签名流程
     *
     * Chrome 没有 chrome.sidePanel.close() API
     * 改为：导航回首页，视觉上"重置"面板
     *
     * 如果调用方需要强制隐藏面板（如错误场景），使用 forceHide()
     */
    static async closePanel(): Promise<void> {
        await this.navigateToRoute('')
        this.currentRoute = ''
    }

    /**
     * 强制隐藏面板（禁用再启用）
     * 适用于错误/超时等需要"关闭"面板的场景
     */
    static async forceHide(): Promise<void> {
        try {
            await chrome.sidePanel.setOptions({ enabled: false })
            await chrome.sidePanel.setOptions({ enabled: true })
            this.isPanelOpen = false
            this.currentRoute = ''
        } catch (err) {
            console.warn('PanelManager: forceHide failed', err)
        }
    }

    // ========== 心跳机制 ==========

    /**
     * 启动心跳检测（background 侧）
     * 定期检查 side panel 页面是否存活
     */
    private static startHeartbeatCheck() {
        this.lastHeartbeatAt = Date.now()

        this.heartbeatInterval = setInterval(() => {
            const elapsed = Date.now() - this.lastHeartbeatAt
            if (elapsed > 15_000) {
                // 15 秒未收到心跳，认为面板已关闭
                console.warn('PanelManager: heartbeat timeout, panel likely closed')
                this.isPanelOpen = false
            }
        }, 5_000)  // 每 5 秒检查一次
    }

    /**
     * 监听来自 side panel 页面的心跳消息
     *
     * 注意：此监听器通过返回 boolean 区分是否处理消息。
     * 对 `panel-*` 前缀的消息返回 true（阻止传递给其他监听器），
     * 对其他消息返回 false（传递给 MessagerManager 等其他 handler）。
     * 避免与已有的 chrome.runtime.onMessage 监听器冲突。
     */
    private static registerHeartbeatListener() {
        chrome.runtime.onMessage.addListener(
            (message: unknown, _sender, sendResponse) => {
                if (message && typeof message === 'object' && 'type' in message) {
                    const msg = message as Record<string, unknown>
                    const msgType = msg.type as string

                    // 仅处理 panel-* 前缀的消息
                    if (!msgType.startsWith('panel-')) {
                        return false  // 不处理的消息交给其他 handler
                    }

                    // 心跳消息
                    if (msgType === 'panel-heartbeat') {
                        this.lastHeartbeatAt = Date.now()
                        this.isPanelOpen = true
                        sendResponse({ ok: true })
                        return true
                    }

                    // 就绪确认消息
                    if (msgType === 'panel-ready') {
                        this.isPanelOpen = true
                        this.lastHeartbeatAt = Date.now()
                        this.resolveReadyWaiters(true)
                        sendResponse({ ok: true })
                        return true
                    }

                    // 其他 panel-* 消息（如 panel-navigate、panel-closing 等由其他地方处理）
                    return false
                }
                return false
            }
        )
    }

    // ========== 就绪等待 ==========

    /**
     * 等待 side panel 页面加载完成并发送就绪消息
     * 替代原来的 while (!await checkPopup()) 轮询
     *
     * @param timeoutMs - 超时时间（默认 5 秒）
     */
    static waitForReady(timeoutMs: number = 5_000): Promise<boolean> {
        return new Promise((resolve) => {
            let settled = false  // F18 修复 — 防止超时和就绪同时 resolve

            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true
                    resolve(false)
                }
            }, timeoutMs)

            this.pendingReadyResolvers.push({
                resolve: (v: boolean) => {
                    if (!settled) {
                        settled = true
                        clearTimeout(timer)
                        resolve(v)
                    }
                },
                timer,
            })
        })
    }

    private static resolveReadyWaiters(value: boolean) {
        const resolvers = [...this.pendingReadyResolvers]
        this.pendingReadyResolvers = []
        for (const r of resolvers) {
            clearTimeout(r.timer)
            r.resolve(value)
        }
    }

    // ========== 工具方法 ==========

    private static async getCurrentTabId(): Promise<number | null> {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        return tab?.id ?? null
    }
}
```

#### 3.2 保留 PopupManager 兼容性（可选）

如果渐进式迁移需要保留 popup 模式回退能力：

```typescript
// popup-manager.ts — 保留原文件，添加兼容性导出
import PanelManager from './panel-manager'

// 兼容旧代码：PopupManager.popupWindow → PanelManager.openPanel
export default class PopupManager {
    static async popupWindow(showWindow: number = 0, route: string = '') {
        // 直接委托给 PanelManager
        const tabId = await PanelManager['getCurrentTabId']()
        await PanelManager.openPanel(route as any, tabId)
    }

    static async closeWindow() {
        await PanelManager.closePanel()
    }

    // ... 其他方法按需委托或保留
}
```

### Step 4: Background Service Worker 适配

**文件：** `extension/src/entries/background/index.ts`

```typescript
import { MessageChannel, MessagerManager, SealxTopic, type SealxRequest } from "sealx-message";
import PanelManager from "./popup-manager";  // 文件名不变，内部改为 PanelManager
import { ... } from "./state";
import { TabManager, type Eip712Struct } from "sealx-core";
import { sessionStore } from "@src/core/state";
import { useRequestStore } from "@src/core/state/request";

const DB_VERSION = 1

// 初始化
const messager = MessagerManager.getMessager()
PanelManager.setMessager(messager)
PanelManager.init()  // ← 替代 PopupManager.setPopupWindow()

// ========== onForward handler ==========
messager.onForward(MessageChannel.POPUP, async (request: SealxRequest) => {
    if (!request.header.tabId && TabManager.getInstance().currentTabId) {
        request.header.tabId = TabManager.getInstance().currentTabId
    }

    const userId = request.header.userId
    const host = request.header.host
    const state = sessionStore.getState()
    if (host) state.setHost(host)
    if (userId) state.setUserId(userId)

    useRequestStore.getState().setRequest(request)

    // 确定路由
    let route: string = ''
    switch (request.topic) {
        case SealxTopic.BIND_PK:
            route = 'bind-pubkey'
            break
        case SealxTopic.SIGN:
        case SealxTopic.BATCH_SIGN:
            route = 'task-home'
            break
        default:
            route = ''
    }

    // 打开 side panel（替代 PopupManager.popupWindow）
    if (request.topic !== SealxTopic.SIGN_RESPONSE) {
        await PanelManager.openPanel(route as any, request.header.tabId)
    }

    // 等待面板就绪（替代 while (!await checkPopup())）
    const ready = await PanelManager.waitForReady(5_000)
    if (!ready) {
        console.warn('Side panel failed to become ready within timeout')
        // 根据需要返回错误或继续
    }
})

// ========== CONNECT handler ==========
messager.on(SealxTopic.CONNECT, async (request: SealxRequest<{ userId: string, title: string }>) => {
    // ... 前置逻辑不变 ...

    if (state.session && state.session.expire > (Date.now() + 10000) && ...) {
        return { session: state.session, account: user }
    } else {
        state.setSession(null)
        useRequestStore.getState().setRequest(request)

        // 打开 side panel 登录页（只调用一次）
        await PanelManager.openPanel('login', request.header.tabId)

        // 等待面板就绪（单次调用，超时后直接尝试通信）
        const ready = await PanelManager.waitForReady(5_000)
        if (!ready) {
            console.warn('Panel did not become ready within timeout, attempting communication anyway')
        }

        try {
            const res = await messager.send(
                { userId, host: request.header.host ?? '', title: request.payload.title },
                SealxTopic.CONNECT,
                MessageChannel.POPUP
            )
            return res.payload
        } catch (error) {
            console.error('Panel connection failed:', error)
            throw error
        }
    }
})

// ========== CLOSE handler ==========
messager.on(SealxTopic.CLOSE, async () => {
    await PanelManager.closePanel()
    return true
})

// ========== 移除 checkPopup 函数 ==========
// 原来的 checkPopup() 不再需要，替换为 PanelManager.waitForReady()
```

### Step 5: Side Panel 页面适配

#### 5.1 App.tsx — 心跳发送 + 导航监听

**文件：** `extension/src/entries/popup/App.tsx`

```tsx
import { useEffect } from 'react';
import { useRequestContext } from '@src/hooks/useRequestContextHook';
import './App.css';
import { Routes } from './Routes';
import { useMemo } from 'react';
import { usePopupType } from '@src/hooks/usePopupType';
import { TabManager } from 'sealx-core';

function App() {
    const { request } = useRequestContext()
    const isFullscreen = useMemo(() => request?.header?.fullscreen, [request])
    const { popupType } = usePopupType()

    // 设置 popup-mode 属性（不变）
    useEffect(() => {
        if (popupType && popupType !== 'unknown') {
            document.body.setAttribute('popup-mode', popupType);
        } else {
            document.body.removeAttribute('popup-mode');
        }
        return () => document.body.removeAttribute('popup-mode');
    }, [popupType]);

    // ========== Side Panel 心跳发送 ==========
    useEffect(() => {
        // 每 3 秒向 background 发送心跳，证明自己还活着
        const heartbeatTimer = setInterval(() => {
            chrome.runtime.sendMessage({ type: 'panel-heartbeat' })
        }, 3_000)

        // 页面加载完成后立即发送就绪消息
        // 确保 React Router 已挂载
        const readyTimer = setTimeout(() => {
            chrome.runtime.sendMessage(
                { type: 'panel-ready', route: window.location.hash },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.warn('Failed to send panel-ready:', chrome.runtime.lastError)
                    }
                }
            )
        }, 500)  // 等 React 初始化完成

        return () => {
            clearInterval(heartbeatTimer)
            clearTimeout(readyTimer)
        }
    }, []);

    // ========== 导航消息监听 ==========
    useEffect(() => {
        const navigateHandler = (message: any, _sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) => {
            if (message?.type === 'panel-navigate' && message?.route) {
                // 使用 window.location.hash 更新路由（兼容 HashRouter）
                // React Router 会监听 hashchange 事件并自动更新
                const currentHash = window.location.hash
                const newHash = message.route ? `#${message.route}` : '#'
                if (currentHash !== newHash) {
                    // 使用 replaceState 避免在历史记录中堆积
                    window.history.replaceState(null, '', newHash)
                    // 手动触发 hashchange 事件，让 React Router 感知路由变化
                    window.dispatchEvent(new HashChangeEvent('hashchange'))
                }
                sendResponse({ ok: true })
            }
        }

        chrome.runtime.onMessage.addListener(navigateHandler)
        return () => {
            chrome.runtime.onMessage.removeListener(navigateHandler)
        }
    }, []);

    // ========== close-popup 消息监听（保留兼容） ==========
    useEffect(() => {
        const closeHandler = (message: any, _sender, sendResponse) => {
            if (message?.type === 'close-popup') {
                // Side Panel 模式下不关闭，改为导航回首页
                window.location.hash = '#'
                sendResponse({ navigated: true })
            }
        }
        chrome.runtime.onMessage.addListener(closeHandler)
        return () => chrome.runtime.onMessage.removeListener(closeHandler)
    }, []);

    // Tab 更新监听（不变）
    useEffect(() => {
        const updateTab = (_tabId: number, _changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
            TabManager.getInstance().currentTab = tab
        }
        chrome.tabs.onUpdated.addListener(updateTab)
        return () => chrome.tabs.onUpdated.removeListener(updateTab)
    }, []);

    return (
        <div className='sealx-container relative flex' style={isFullscreen ? { marginTop: "120px" } : {}}>
            <Routes />
        </div>
    );
}

export default App;
```

#### 5.2 usePopupType — 新增 sidepanel 检测

**文件：** `extension/src/hooks/usePopupType.ts`

```typescript
import { useState, useEffect } from 'react';

/**
 * 判断当前页面运行在哪种上下文中
 *
 * sidepanel 检测原理：
 * - chrome.tabs.getCurrent() 在 side panel 中返回 undefined 或 tab.url 匹配 side panel 路径
 * - chrome.windows.getCurrent() 返回 type: 'normal'（side panel 属于 normal 窗口类型）
 * - 综合判断：normal 窗口 + 无独立 tab + URL 匹配 → sidepanel
 */
export const usePopupType = () => {
    const [popupType, setPopupType] = useState<'window' | 'action' | 'tab' | 'sidepanel' | 'unknown'>('unknown');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const determinePopupType = async () => {
            try {
                if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.windows) {
                    setPopupType('unknown');
                    setIsLoading(false);
                    return;
                }

                const currentWindow = await chrome.windows.getCurrent();
                const currentTab = await chrome.tabs.getCurrent();

                // ===== 新增：sidepanel 检测 =====
                // Side Panel 中 chrome.tabs.getCurrent() 返回 undefined（多数情况）
                // Side Panel 中 chrome.windows.getCurrent() 返回 type: 'normal'
                // Chrome 版本差异可能导致 getCurrent() 行为不一致，因此增加 URL 作为 fallback

                const isLikelySidePanel = (
                    (currentWindow?.type === 'normal' && !currentTab) ||
                    (currentWindow?.type === 'normal' && currentTab?.url?.includes('src/entries/popup/index.html') && !chrome.action?.getPopup)
                )

                if (isLikelySidePanel) {
                    setPopupType('sidepanel');
                    setIsLoading(false);
                    return;
                }

                // URL hash 参数检测（URL 参数优先级最高）
                const urlParams = new URLSearchParams(window.location.search);
                const hashParams = new URLSearchParams(window.location.hash.substring(1));

                if (urlParams.get('popupType') === 'sidepanel' || hashParams.get('popupType') === 'sidepanel') {
                    setPopupType('sidepanel');
                    setIsLoading(false);
                    return;
                }
                // ... 其余 window/action/tab 检测逻辑保持不变 ...

                // Method: window type popup
                if (currentWindow.type === 'popup') {
                    if (currentWindow.width && currentWindow.width >= 400 && currentWindow.width <= 800 || currentWindow.height && currentWindow.height > 600) {
                        setPopupType('window');
                    } else {
                        setPopupType('action');
                    }
                    setIsLoading(false);
                    return;
                }

                // Method: tab mode
                if (currentWindow.type === 'normal' && currentTab) {
                    setPopupType('tab');
                    setIsLoading(false);
                    return;
                }

                // Default
                setPopupType('action');

            } catch (error) {
                console.warn('Error determining popup type:', error);
                setPopupType('unknown');
            } finally {
                setIsLoading(false);
            }
        };

        determinePopupType();
    }, []);

    return {
        popupType,
        isLoading,
        isWindowPopup: popupType === 'window',
        isActionPopup: popupType === 'action',
        isTabPopup: popupType === 'tab',
        isSidePanel: popupType === 'sidepanel',  // ← 新增
    };
};
```

#### 5.3 popup-menu.tsx — 适配 sidepanel

**文件：** `extension/src/entries/popup/components/layout/popup-menu.tsx`

```tsx
import { useSealXNavigate } from "../../hooks/useSealXNavigate"
import { usePopupType } from "@src/hooks/usePopupType"
import React, { useCallback } from "react"

interface PopupMenuProps extends React.HTMLAttributes<HTMLDivElement> {
    closeMenu?: () => void;
}

export const PopupMenu = React.forwardRef<HTMLDivElement, PopupMenuProps>(({ closeMenu, ...props }, ref) => {
    const navigate = useSealXNavigate()
    const { isActionPopup, isSidePanel, isLoading: isPopupTypeLoading } = usePopupType()

    const handleItemClick = useCallback((callback: () => void) => {
        return () => {
            callback();
            closeMenu?.();
        };
    }, [closeMenu]);

    // Side Panel 模式下不再需要"在新 tab 打开"（面板本身就在侧边，无需弹出新 tab）
    const shouldOpenInNewTab = !isPopupTypeLoading && isActionPopup && !isSidePanel && chrome?.tabs?.create

    return <div {...props} ref={ref}>
        <div onClick={handleItemClick(() => navigate('/reset-pin'))}
            className="pt-[18px] px-[24px] cursor-pointer hover:bg-[#00BE78]/[6%] text-[#000] text-[21px] font-[500] leading-[25px] pb-[17px] text-left">
            Reset Pin
        </div>
        <div onClick={handleItemClick(() => {
            if (shouldOpenInNewTab) {
                chrome.tabs.create({
                    url: chrome.runtime.getURL('src/entries/popup/index.html#/key-manage')
                })
            } else {
                navigate('/key-manage')
            }
        })} className="pt-[18px] px-[24px] cursor-pointer hover:bg-[#00BE78]/[6%] text-[#000] text-[21px] font-[500] leading-[25px] pb-[17px] text-left">
            Key Management
        </div>
        <div onClick={handleItemClick(() => navigate('/set-screen-timer'))}
            className="pt-[18px] px-[24px] cursor-pointer hover:bg-[#00BE78]/[6%] text-[#000] text-[21px] font-[500] leading-[25px] pb-[17px] text-left">
            Set Screen Off Time
        </div>
    </div>
})
```

#### 5.4 home/index.tsx — 适配 sidepanel

**文件：** `extension/src/entries/popup/components/home/index.tsx`

变更 `isActionPopup` 判断逻辑：

```tsx
const { isActionPopup, isSidePanel, isLoading: isPopupTypeLoading } = usePopupType();

// 在 handleSettingsOption 中：
case 'key-manage':
    // Side Panel 模式下不需要新 tab 打开
    if (!isPopupTypeLoading && isActionPopup && !isSidePanel && chrome?.tabs?.create) {
        chrome.tabs.create({
            url: chrome.runtime.getURL('src/entries/popup/index.html#/key-manage') + '#/key-manage'
        });
    } else {
        navigate('/key-manage');
    }
    break;
```

### Step 5.5: ErrorBoundary 组件（F9 修复 — Side Panel JS 崩溃恢复）

Side Panel 是持久面板，JS 崩溃后需要恢复机制。添加 React ErrorBoundary 组件：

**新建文件：** `extension/src/entries/popup/components/ErrorBoundary.tsx`

```tsx
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Side Panel ErrorBoundary caught:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="flex flex-col items-center justify-center h-screen p-6 text-center">
                    <div className="text-2xl font-bold text-red-600 mb-4">Something went wrong</div>
                    <div className="text-gray-600 mb-4 text-sm">{this.state.error?.message}</div>
                    <button
                        onClick={() => {
                            // F20 修复：使用 hash + reload 重新挂载 React 树
                            // 不丢失 sessionStore 中的内存状态（storage 中的数据不受影响）
                            window.location.hash = '#'
                            // 仅重新加载页面（side panel 中 reload 不会关闭面板）
                            window.location.reload()
                        }}
                        className="px-6 py-2 bg-[#00BE78] text-white rounded-lg hover:bg-[#00A366] transition-colors"
                    >
                        Retry
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
```

**在 App.tsx 中包裹 `<Routes />`：**

```tsx
import { ErrorBoundary } from './components/ErrorBoundary';

// 在 App() 的 return 中：
return (
    <ErrorBoundary>
        <div className='sealx-container relative flex' style={isFullscreen ? { marginTop: "120px" } : {}}>
            <Routes />
        </div>
    </ErrorBoundary>
);
```

### Step 5.6: onBeforeUnload 监听（F10 修复 — 面板关闭前清理）

面板关闭前通知 background 清理请求状态：

**在 App.tsx 中添加：**

```tsx
    // ========== 面板关闭前清理 ==========
    useEffect(() => {
        const handleBeforeUnload = () => {
            chrome.runtime.sendMessage({
                type: 'panel-closing',
                route: window.location.hash
            });
        };
        // F26 修复：同时监听 pagehide 和 beforeunload，确保 Chrome side panel 卸载时能触发
        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('pagehide', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handleBeforeUnload);
        };
    }, []);
```

**在 background/index.ts 中，将 `panel-closing` 和 `panel-process-queue` 监听器合并到统一入口（F22 修复）：**

> **不要单独注册 `chrome.runtime.onMessage.addListener`** — 以下监听器应与 Step 5.8 的队列监听器合并。

```typescript
// ========== 统一 panel-* 消息处理（合并 Step 5.6 + Step 5.8） ==========
// 在 background/index.ts 中只注册一次
chrome.runtime.onMessage.addListener((message: any, _sender, _sendResponse) => {
    if (message?.type === 'panel-process-queue') {
        PanelManager.processNextInQueue()
        return true
    }
    if (message?.type === 'panel-closing') {
        // tab 关闭时清除队列
        if (_sender.tab?.id) {
            PanelManager.clearQueueForTab(_sender.tab.id)
        }
        useRequestStore.getState().clearRequest()
        return true
    }
    return false
})
```

### Step 5.7: useSealXNavigate Hook 分析（F12 修复）

需要检查 `useSealXNavigate` hook 是否在 sidepanel 模式下有异常行为。该 hook 可能在 popup 模式下有全屏/新 tab 打开的特殊逻辑。

**处理方式：** 在 `popup-menu.tsx` 和 `home/index.tsx` 中，sidepanel 模式下直接使用 `navigate()` 即可，无需特殊处理（`isSidePanel` 为 true 时走 `else` 分支，调用 `navigate()`）。当前代码已经正确处理。

**确认：** `useSealXNavigate` 内部不做模式判断，仅封装 `useNavigate`。sidepanel 模式下行为与普通页面导航一致，无需额外适配。

### Step 5.8: 并发签名请求处理（F8 修复 — 多 tab 并发签名队列）

> **已合并到 Step 3.1 的主实现中**。以下为集成说明：

当 side panel 正在显示 A tab 的签名任务时，B tab 也触发签名。队列机制已内置于 `PanelManager.openPanel()` 中：

1. 如果面板已打开且正在处理其他 tab 的请求，新请求自动入队
2. `openPanel()` 完成后自动调度 `scheduleProcessQueue()`
3. side panel 页面签名完成时通知 background 处理队列：

```tsx
// 在 task/index.tsx 或 task-render.tsx 的签名完成回调中：
const onSignComplete = () => {
    chrome.runtime.sendMessage({ type: 'panel-process-queue' })
    // 导航回首页
    window.history.replaceState(null, '', '#')
    window.dispatchEvent(new HashChangeEvent('hashchange'))
};
```

**background/index.ts 中添加队列处理监听：**

```typescript
chrome.runtime.onMessage.addListener((message: any, _sender, _sendResponse) => {
    if (message?.type === 'panel-process-queue') {
        PanelManager.processNextInQueue()
        return true
    }
    if (message?.type === 'panel-closing') {
        if (_sender.tab?.id) {
            PanelManager.clearQueueForTab(_sender.tab.id)
        }
        useRequestStore.getState().clearRequest()
        return true
    }
    return false
})
```

### Step 6: CSS 响应式适配

Side Panel 宽度约为 320-400px（Chrome 可调整），而现有 UI 按 600px 设计。需要响应式适配。

#### 6.1 方案：基于 body 属性的 Tailwind 类覆盖（实用方案）

> **背景：** 现有组件大量使用 Tailwind 硬编码类（如 `w-[600px]`、`px-[41px]`），无法直接使用 CSS 变量。
>
> **方案：** 使用 `body[popup-mode="sidepanel"]` 组合选择器提高 specificity 优先级，覆盖 Tailwind 生成的类。

在 `extension/src/entries/popup/main.css`（或全局样式文件）中添加：

```css
/* ========== Side Panel 响应式适配 ========== */
/* 通过 body[popup-mode="sidepanel"] 选择器覆盖 Tailwind 硬编码类 */

/* 容器宽度 */
body[popup-mode="sidepanel"] .w-\[600px\] {
    width: 100%;
}

/* 容器水平内边距 */
body[popup-mode="sidepanel"] .px-\[26\.25px\] {
    padding-left: 16px;
    padding-right: 16px;
}

body[popup-mode="sidepanel"] .px-\[41px\] {
    padding-left: 16px;
    padding-right: 16px;
}

/* 菜单项内边距 */
body[popup-mode="sidepanel"] .px-\[24px\] {
    padding-left: 12px;
    padding-right: 12px;
}

/* 标题字号 */
body[popup-mode="sidepanel"] .text-\[32px\] {
    font-size: 24px;
}

/* 正文/菜单字号 */
body[popup-mode="sidepanel"] .text-\[21px\] {
    font-size: 18px;
}

/* 通用 padding 缩减 */
body[popup-mode="sidepanel"] .p-\[16px\] {
    padding: 12px;
}

body[popup-mode="sidepanel"] .py-\[24px\] {
    padding-top: 16px;
    padding-bottom: 16px;
}

body[popup-mode="sidepanel"] .mt-\[60px\] {
    margin-top: 32px;
}

body[popup-mode="sidepanel"] .mb-\[24px\] {
    margin-bottom: 16px;
}

/* 间距类适配 */
body[popup-mode="sidepanel"] .space-y-\[16px\] > * + * {
    margin-top: 12px;
}

body[popup-mode="sidepanel"] .gap-\[16px\] {
    gap: 12px;
}

body[popup-mode="sidepanel"] .mb-\[16px\] {
    margin-bottom: 12px;
}

body[popup-mode="sidepanel"] .pt-\[20px\] {
    padding-top: 12px;
}

body[popup-mode="sidepanel"] .pt-\[18px\] {
    padding-top: 12px;
}

body[popup-mode="sidepanel"] .pb-\[17px\] {
    padding-bottom: 12px;
}
```

> **注意：** 每个新的 Tailwind 类都需要手动添加对应的覆盖规则。建议在实现时全局搜索项目中所有固定宽度/内边距类，逐一添加覆盖。

**推荐长期方案：** 逐步将组件中的固定 Tailwind 值替换为 CSS 变量或 Tailwind 响应式前缀（如 `sm:w-[600px] w-full`），从根本上消除覆盖需求。

#### 6.2 关键组件适配清单

| 组件 | 需要适配的样式 | 说明 |
|------|---------------|------|
| `home/index.tsx` | `w-[600px]` → `w-full` | 容器宽度 |
| `home/index.tsx` | `px-[26.25px]`, `px-[41px]` → `px-4` | 水平内边距 |
| `home/index.tsx` | `text-[32px]` → `text-2xl` | 标题字号 |
| `popup-menu.tsx` | `text-[21px]` → `text-lg` | 菜单项字号 |
| `popup-menu.tsx` | `px-[24px]` → `px-3` | 菜单项内边距 |
| `task/index.tsx` | 检查是否有固定宽度 | 签名任务页 |
| `task/task-render.tsx` | 检查是否有固定宽度 | 签名渲染页 |
| `login/index.tsx` | 检查是否有固定宽度 | 登录页 |
| `bind-pubkey/index.tsx` | 检查是否有固定宽度 | 绑定公钥页 |

#### 6.3 通用响应式工具类

在 `main.css` 中定义可复用的响应式工具类：

```css
/* 响应式容器 */
.responsive-container {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
}

@media (max-width: 450px) {
    .responsive-container {
        max-width: 100%;
        padding-left: 16px;
        padding-right: 16px;
    }
}

/* 响应式字体 */
.responsive-title {
    font-size: 32px;
}

@media (max-width: 450px) {
    .responsive-title {
        font-size: 24px;
    }
}

.responsive-body {
    font-size: 18px;
}

@media (max-width: 450px) {
    .responsive-body {
        font-size: 16px;
    }
}

.responsive-menu-item {
    font-size: 21px;
    padding-left: 24px;
    padding-right: 24px;
}

@media (max-width: 450px) {
    .responsive-menu-item {
        font-size: 18px;
        padding-left: 12px;
        padding-right: 12px;
    }
}
```

## 三、测试清单

### 3.1 功能测试

| # | 测试场景 | 预期行为 | 状态 |
|---|---------|---------|------|
| 1 | 点击扩展图标 | 右侧打开 Side Panel，显示首页 | ☐ |
| 2 | 在 DApp 页面触发签名 | Side Panel 打开并导航到 task-home | ☐ |
| 3 | 未登录状态触发签名 | Side Panel 打开并导航到 login | ☐ |
| 4 | 已登录状态触发签名 | Side Panel 导航到 task-home 显示签名 | ☐ |
| 5 | 签名完成后 | Side Panel 导航回首页 | ☐ |
| 6 | 签名过程中取消 | Side Panel 导航回首页 | ☐ |
| 7 | 手动关闭 Side Panel（X 按钮） | 面板关闭，无报错 | ☐ |
| 8 | 再次点击扩展图标 | 重新打开 Side Panel | ☐ |
| 9 | 侧边栏已打开时再次触发签名 | 导航更新，不重复打开 | ☐ |
| 10 | 多标签页并发签名 | 请求按 FIFO 队列处理：A tab 签名完成后自动处理 B tab 的请求，面板不冲突闪烁 | ☐ |
| 11 | BIND_PK 事件 | Side Panel 导航到 bind-pubkey | ☐ |
| 12 | CONNECT 事件（未登录） | Side Panel 导航到 login | ☐ |
| 13 | Settings 菜单 → Reset PIN | 导航到 reset-pin | ☐ |
| 14 | Settings 菜单 → Key Management | 导航到 key-manage | ☐ |
| 15 | 扩展安装后首次打开 | 导航到初始化/登录页 | ☐ |

### 3.2 UI 测试

| # | 测试场景 | 预期行为 | 状态 |
|---|---------|---------|------|
| 1 | Side Panel 宽度 320px | 内容不溢出，可滚动 | ☐ |
| 2 | Side Panel 宽度 400px | 布局正常 | ☐ |
| 3 | Side Panel 宽度 500px | 布局正常 | ☐ |
| 4 | 登录页适配 | 表单不截断 | ☐ |
| 5 | 签名任务页适配 | 签名内容完整显示 | ☐ |
| 6 | 菜单下拉适配 | 文字不换行/截断 | ☐ |
| 7 | 深色模式（如适用） | 颜色正确 | ☐ |

### 3.3 边界测试

| # | 测试场景 | 预期行为 | 状态 |
|---|---------|---------|------|
| 1 | Background Service Worker 休眠后唤醒 | Chrome 自动唤醒，无状态丢失 | ☐ |
| 2 | Side Panel 页面 JS 崩溃 | ErrorBoundary 捕获，显示错误信息和 Retry 按钮 | ☐ |
| 7 | ErrorBoundary Retry 按钮 | 点击后重置路由到首页并重新加载，面板不关闭 | ☐ |
| 3 | 网络断开时签名 | 超时错误处理 | ☐ |
| 4 | Chrome 版本 < 116 | 降级方案或提示 | ☐ |
| 5 | 无痕模式 | 正常工作（需确认 permissions） | ☐ |
| 6 | 多窗口浏览器 | 每个窗口独立 Side Panel | ☐ |

### 3.4 构建测试

| # | 测试场景 | 预期行为 | 状态 |
|---|---------|---------|------|
| 1 | `npm run build:chrome` | 构建成功 | ☐ |
| 2 | `dist_chrome/manifest.json` 含 `side_panel` | 字段存在 | ☐ |
| 3 | `dist_chrome/manifest.json` 不含 `action.default_popup` | 字段不存在 | ☐ |
| 4 | `dist_chrome/manifest.json` 含 `sidePanel` 权限 | 权限列表包含 | ☐ |
| 5 | Firefox 构建不变 | 仍使用 `action.default_popup` | ☐ |

## 四、回退方案

### 4.1 快速回退步骤

如果 Side Panel 模式出现问题，可按以下步骤回退到 popup 模式：

1. **恢复 manifest**：恢复 `action.default_popup`，注释 `side_panel`：
   ```json
   {
       "action": {
           "default_popup": "src/entries/popup/index.html",
           "default_title": "SealX"
       },
       // "side_panel": { ... },
       "permissions": [
           "activeTab", "storage", "scripting", "tabs", "identity", "alarms"
       ]
   }
   ```

2. **恢复 PopupManager**：取消对 `PopupManager.popupWindow()` 的注释，恢复原始实现

3. **恢复 background/index.ts**：将 `PanelManager` 调用改回 `PopupManager`

4. **恢复 usePopupType**：移除 `sidepanel` 分支

5. **重新构建**：`npm run build:chrome`

### 4.2 保留回退代码

推荐保留原 PopupManager 代码作为注释或独立文件，便于快速回退：

```
extension/src/entries/background/
├── popup-manager.ts          # 改为 PanelManager
├── popup-manager.backup.ts   # 备份原版（.backup.ts 不会被构建）
```

## 五、迁移检查清单

- [ ] manifest.json 已添加 `side_panel` 和 `sidePanel` 权限
- [ ] manifest.json 已移除 `action.default_popup`
- [ ] vite-config/chrome.ts 确保 `side_panel` 字段不被过滤
- [ ] PopupManager 已重构为 PanelManager（含并发请求队列）
- [ ] background/index.ts `onForward` 改用 PanelManager.openPanel()
- [ ] background/index.ts `CONNECT` handler 改用 PanelManager.openPanel()
- [ ] background/index.ts `CLOSE` handler 改用 PanelManager.closePanel()
- [ ] background/index.ts 移除 checkPopup() 函数
- [ ] background/index.ts 统一注册 panel-* 消息监听器（panel-process-queue + panel-closing）
- [ ] App.tsx 已添加心跳发送逻辑
- [ ] App.tsx 已添加导航消息监听
- [ ] App.tsx close-popup 消息适配 sidepanel（导航而非关闭）
- [ ] App.tsx 已添加 pagehide 监听（面板关闭前清理）
- [ ] App.tsx 已用 ErrorBoundary 包裹 Routes
- [ ] 新建 ErrorBoundary.tsx 组件
- [ ] usePopupType 已添加 sidepanel 检测
- [ ] popup-menu.tsx 已添加 isSidePanel 分支
- [ ] home/index.tsx 已添加 isSidePanel 分支
- [ ] CSS 已适配 320-400px 宽度
- [ ] task/index.tsx 或 task-render.tsx 签名完成回调添加 panel-process-queue 通知
- [ ] 构建产物 manifest.json 验证通过
- [ ] 所有功能测试用例通过
- [ ] 所有 UI 测试用例通过
- [ ] 所有边界测试用例通过
- [ ] 回退方案已准备

## 六、常见问题 (FAQ)

### Q1: Side Panel 能否在 Firefox 中使用？

不能。`chrome.sidePanel` 是 Chrome 独有 API。Firefox 构建通过 `vite-config/firefox.ts` 独立配置，继续使用 `action.default_popup`。

### Q2: Chrome 版本低于 116 怎么办？

`chrome.sidePanel.open({ tabId })` 需要 Chrome 116+。对于旧版本：
- 设置 `setPanelBehavior({ openPanelOnActionClick: true })` 让用户手动点击打开
- 或通过 content script 注入方式触发

### Q3: Side Panel 和 popup 能否同时存在？

可以，但不推荐。同时配置时 popup 优先级更高，side panel 可能不生效。迁移时务必移除 `action.default_popup`。

### Q4: 如何在开发模式下调试 Side Panel？

1. 加载扩展后，打开 `chrome://extensions/`
2. 点击扩展的 "Service Worker" 链接打开 DevTools
3. Side Panel 页面右键 → "检查" 可以打开 Side Panel 的 DevTools
4. 使用 `console.log` 和断点调试

### Q5: 多个窗口时 Side Panel 行为如何？

Chrome Side Panel 是**每窗口独立**的。每个浏览器窗口有自己的 side panel。跨窗口不共享 panel 实例。

### Q6: Side Panel 会影响性能吗？

Side Panel 页面是普通的扩展页面，与 popup 页面使用相同的 HTML/JS/CSS 资源。性能开销与 popup 相同。额外的开销仅在于心跳消息（每 3 秒一次 `runtime.sendMessage`，可忽略）。

### Q7: `@crxjs/vite-plugin` 的 `ManifestV3Export` 是否支持 `side_panel` 类型定义？（F13 修复）

取决于插件版本。`side_panel` 是 Chrome MV3 标准字段，但 `@crxjs/vite-plugin` 的 TypeScript 类型定义可能在旧版本中不包含 `side_panel`。

**处理方式：**
1. 如果 TypeScript 报错，使用 `as ManifestV3Export` 类型断言即可
2. 构建后检查 `dist_chrome/manifest.json` 确认 `side_panel` 字段存在
3. 如果构建时字段被过滤，在 `vite-config/chrome.ts` 中手动注入（见 Step 2）

**验证命令：**
```bash
cat dist_chrome/manifest.json | jq '.side_panel'
# 应输出: { "default_path": "src/entries/popup/index.html" }
```

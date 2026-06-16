/// <reference types="chrome"/>

// import { sessionStore } from "@src/core/state"
import { getSealxInfo } from "./state"
import { Channel, ChannelManager, MessageChannel, SealxTopic, type Messager } from "sealx-message"
import { TabManager } from "sealx-core"

/**
 * 路由白名单
 * 用于 setOptions({ path }) 拼接时的安全验证
 * 与 React Router 的路由定义保持一致
 */
const ALLOWED_ROUTES = [
    '',                    // 空字符串 = 首页
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
    private static panelChannel: Channel | null = null

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
    private static _alarmListenerRegistered: boolean = false;

    // ========== 初始化 ==========

    /**
     * 通知面板已通过手势通道打开
     * 由 open-side-panel handler 在 sidePanel.open 成功后调用
     */
    static notifyPanelOpened(route: string) {
        this.isPanelOpen = true
        this.currentRoute = route
        this.lastHeartbeatAt = Date.now()
        this.clearBadge()
        this.resolveReadyWaiters(true)
    }

    /**
     * 设置扩展图标 badge（用于 fallback 提示）
     */
    static setBadge() {
        chrome.action.setBadgeText({ text: '!' })
        chrome.action.setBadgeBackgroundColor({ color: '#F0231E' })
    }

    /**
     * 清除扩展图标 badge
     */
    static clearBadge() {
        chrome.action.setBadgeText({ text: '' })
    }

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

        // 长链接监听：side panel 端口断开即视为面板关闭
        ChannelManager.accept('sealx-panel', (channel) => {
            this.panelChannel = channel
            channel.on('ready', (payload: unknown) => {
                const route = typeof (payload as Record<string, unknown>)?.route === 'string'
                    ? (payload as Record<string, unknown>).route as string
                    : '';
                this.notifyPanelOpened(route);
            });
            channel.onDisconnect(() => {
                if (this.panelChannel === channel) this.panelChannel = null
                this.notifyPanelClosing();
            });
        });
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

        // 使用标志位防止重复注册 alarm listener
        if (this._alarmListenerRegistered) return
        this._alarmListenerRegistered = true

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
     * 导航到指定路由（不调用 sidePanel.open）
     *
     * sidePanel.open() 只能由用户手势触发（通过 open-side-panel handler），
     * 此方法仅负责：
     * - 面板已打开且存活 → 发送导航消息
     * - 面板未打开 → 设置路径（点击扩展图标时生效）+ 显示 badge 提示用户
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

            // 6. 面板未打开或心跳超时：
            //    sidePanel.open() 必须由用户手势触发，此处无法调用。
            //    先设置路径（openPanelOnActionClick 生效时用户点击图标即打开到正确路由），
            //    再尝试导航（面板可能已通过手势通道打开但心跳尚未到达），
            //    如果面板确实未打开则显示 badge 提示用户点击扩展图标。
            const fullPath = route ? `${this.panelPath}#${route}` : this.panelPath
            try {
                await chrome.sidePanel.setOptions({ path: fullPath, enabled: true })
            } catch (err) {
                console.warn('PanelManager: setOptions failed', err)
            }

            // 尝试导航（面板可能已通过手势通道打开，尚未收到心跳）
            const navigated = await this.tryNavigate(route)
            if (!navigated) {
                // 面板确实未打开，显示 badge 提示用户点击扩展图标
                this.setBadge()
                console.info('PanelManager: panel not open, badge set — user can click extension icon')
            }
        } finally {
            this.isProcessing = false
        }

        // 7. 处理队列中的下一个请求（异步非阻塞）
        this.scheduleProcessQueue()
    }

    /**
     * 通过按钮手势打开 panel，使用 chrome.storage.session 传递 button 来源标识
     *
     * 调用时序：
     * 1. chrome.storage.session.set({ panelTriggerSource: 'button' }) — 同步入队，不打断手势链
     * 2. chrome.sidePanel.open({ tabId }) — 在 transient activation 上下文内执行
     *
     * panel 端通过 chrome.storage.session.get('panelTriggerSource') 检测来源和时间戳，
     * 读到 'button' 则显示不透明白色全屏 loading 直到签名/绑定请求到达。
     *
     * @param tabId - 触发打开的 tab ID
     */
    static async openPanelWithSource(tabId: number): Promise<void> {
        chrome.storage.session.set({
            panelTriggerSource: 'button',
            panelTriggerSourceAt: Date.now(),
        })
        // Keep this fire-and-forget: awaiting before sidePanel.open can break transient activation.
        chrome.sidePanel.setOptions({
            tabId,
            path: this.panelPath,
            enabled: true,
        }).catch(err => console.warn('PanelManager: setOptions before open failed', err))
        // MUST remain synchronous — no await between set and open, preserves transient activation
        await chrome.sidePanel.open({ tabId })
    }

    /**
     * 向 tab 的 content script 发送消息，激活 PIN 键盘中继
     * 全屏模式下 side panel 无法接收键盘事件，通过 content script 拦截并转发
     */
    static async armKeyRelay(tabId: number): Promise<void> {
        console.log('[PM:relay] armKeyRelay → sending arm-pin-key-relay to tab', tabId);
        try {
            await chrome.tabs.sendMessage(tabId, { type: 'arm-pin-key-relay' });
        } catch {
            console.warn('[PM:relay] failed for tab', tabId, '→ scanning all tabs');
            // Content script not on this tab — scan all tabs to find one
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
                if (tab.id && tab.id !== tabId) {
                    try {
                        await chrome.tabs.sendMessage(tab.id, { type: 'arm-pin-key-relay' });
                        console.log('[PM:relay] found content script on tab', tab.id);
                        return;
                    } catch { continue; }
                }
            }
            console.warn('[PM:relay] no tab with content script found');
        }
    }

    /**
     * 导航到指定路由（面板已打开时调用）
     * 通过 runtime.sendMessage 通知 React Router 更新
     *
     * F15 修复说明：sendMessage 的 response 只返回给第一个 return true 的监听器。
     * 此处不依赖 response 值，仅依赖消息投递的副作用（side panel 页面接收并导航）。
     * registerHeartbeatListener 对 panel-navigate 返回 false，不会拦截。
     * panel-navigate 消息的实际处理在 App.tsx 的 navigateHandler 中。
     *
     * @returns true 如果导航消息发送成功，false 如果失败（面板未打开/未加载）
     */
    static async navigateToRoute(route: AllowedRoute): Promise<boolean> {
        try {
            await chrome.runtime.sendMessage({
                type: 'panel-navigate',
                route,
            })
            this.currentRoute = route
            return true
        } catch (err) {
            // sendMessage 失败通常意味着侧边栏页面已关闭或未加载
            console.warn('PanelManager: navigate failed', err)
            return false
        }
    }

    /**
     * 尝试导航到指定路由（用于面板可能刚通过手势通道打开但心跳尚未到达的场景）
     * 先尝试直接导航，如果失败则短暂重试一次
     *
     * @returns true 如果导航成功，false 如果面板确实未打开
     */
    private static async tryNavigate(route: AllowedRoute): Promise<boolean> {
        // 第一次尝试：面板可能已通过手势通道打开
        if (await this.navigateToRoute(route)) {
            return true
        }
        // 短暂等待后面板可能已加载完成，再试一次
        await new Promise(resolve => setTimeout(resolve, 300))
        return await this.navigateToRoute(route)
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
     *
     * 注意：不调用 sidePanel.open()，因为此方法不在用户手势上下文中。
     * 仅通过导航或设置路径+badge 来处理。
     */
    static async processNextInQueue(): Promise<void> {
        if (this.requestQueue.length === 0) return

        const next = this.requestQueue.shift()!
        this.processingTabId = next.tabId
        this.isProcessing = true

        try {
            // 如果面板已打开且存活，直接导航
            if (this.isPanelOpen && Date.now() - this.lastHeartbeatAt < 15_000) {
                await this.navigateToRoute(next.route)
                this.currentRoute = next.route
            } else {
                // 面板未打开或心跳超时：设置路径 + 尝试导航 + badge fallback
                const fullPath = next.route ? `${this.panelPath}#${next.route}` : this.panelPath
                try {
                    await chrome.sidePanel.setOptions({ path: fullPath, enabled: true })
                } catch (err) {
                    console.warn('PanelManager: processNextInQueue setOptions failed', err)
                }
                const navigated = await this.tryNavigate(next.route)
                if (!navigated) {
                    this.setBadge()
                }
            }
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
     * Panel closed by user — immediately sync state (faster than heartbeat timeout).
     * Called from background's panel-closing handler.
     */
    static notifyPanelClosing(): void {
        // Send close event to frontend BEFORE clearing state
        if (this.messager) {
            this.messager.send({}, SealxTopic.PANEL_CLOSE, MessageChannel.INPAGE).catch(() => {});
        }

        // F8: resolve any pending waitForReady() callers with false
        // (panel closed while someone was waiting for it to be ready)
        this.resolveReadyWaiters(false)
        this.isPanelOpen = false
        this.processingTabId = null
        this.isProcessing = false
    }

    /**
     * Clear the queue entry for the currently processing tab.
     * Used by panel-closing handler where sender.tab is undefined for side panels,
     * so clearQueueForTab(sender.tab.id) wouldn't work.
     */
    static clearCurrentProcessingQueue(): void {
        if (this.processingTabId) {
            this.clearQueueForTab(this.processingTabId)
        }
    }

    /**
     * 关闭面板 / 结束签名流程
     *
     * Chrome 没有 chrome.sidePanel.close() API
     * 改为：导航回首页，视觉上"重置"面板
     *
     * 如果调用方需要强制隐藏面板（如错误场景），使用 forceHide()
     */
    static async closePanel(tabId?: number | null): Promise<void> {
        if (this.panelChannel) {
            try {
                this.panelChannel.send('close-window', { tabId })
                return
            } catch (err) {
                console.warn('PanelManager: close-window send failed', err)
            }
        }
        await this.forceHide(tabId)
    }

    /**
     * 强制隐藏面板（禁用再启用）
     * 适用于错误/超时等需要"关闭"面板的场景
     */
    static async forceHide(tabId?: number | null): Promise<void> {
        try {
            const targetTabId = tabId ?? this.processingTabId ?? await this.getCurrentTabId()
            if (targetTabId) {
                await chrome.sidePanel.setOptions({ tabId: targetTabId, enabled: false })
                await chrome.sidePanel.setOptions({ tabId: targetTabId, path: this.panelPath, enabled: true })
            } else {
                await chrome.sidePanel.setOptions({ enabled: false })
                await chrome.sidePanel.setOptions({ path: this.panelPath, enabled: true })
            }
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
        // 保持 lastHeartbeatAt = 0，这样首次检查立即检测到面板未就绪
        this.lastHeartbeatAt = 0

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

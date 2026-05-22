import { MessageChannel, MessagerManager, SealxTopic, type SealxRequest } from "sealx-message";
import PanelManager from "./panel-manager";
import {
    addUser,
    clearAllSessionRuntimeState,
    clearSessionRuntimeState,
    generateSession,
    getAddressByPin,
    getSealxInfo,
    getSessionPrivateKey,
    getUser,
    initializeSealx,
    initializeSealxInfo,
    installDB,
    pkHex,
    resetSealxPin,
    runWithSigningCapability,
    setSealxSessionTimeout
} from "./state";
import { decodeSession, decodeSessionPrivateKey, sessionKey } from "@src/core/utils/helper";
import { sessionStore } from "@src/core/state";
import { TabManager, type Eip712Struct } from "sealx-core";
import { useRequestStore } from "@src/core/state/request";
import { createMemorySigningProvider } from "./signing-providers";
import { signingFailure, SigningError } from "./signing-errors";

/**
 * Current version of the IndexedDB database schema
 */
const DB_VERSION = 1
// Initialize message handler and panel manager
const messager = MessagerManager.getMessager()
PanelManager.setMessager(messager)
PanelManager.init()

// Wait for Zustand persist to rehydrate from chrome.storage.local,
// then clear stale session. On SW restart the in-memory privateKeyCache is
// always empty, so any persisted session refers to a non-existent key.
// This only runs in the background Service Worker context.
;(async () => {
    try {
        const persistStore = sessionStore as typeof sessionStore & {
            persist?: {
                rehydrate?: () => Promise<unknown> | unknown
            }
        }
        await persistStore.persist?.rehydrate?.()
    } catch {
        // rehydrate() may not exist in all Zustand versions — ignore
    }
    sessionStore.getState().setSession(null)
})()

/**
 * Handles extension installation and startup
 */
chrome.runtime.onInstalled.addListener((details) => {
    installDB('sealx', ['base-info', 'sealx-pk', 'user'], DB_VERSION).then((ok) => {
        if (!ok) {
            console.error('Failed to initialize SealX database')
            return
        }
        initializeSealxInfo()
    })
    sessionStore.getState().clearAllSession()
    clearAllSessionRuntimeState()
    if (details.reason === 'install') {
        chrome.tabs.create({
            url: chrome.runtime.getURL('src/entries/popup/index.html#/login')
        }).catch(() => {
            PanelManager.openPanel('login')
        })
    }
    chrome.alarms.create('checkSealx', { periodInMinutes: 1 })
})

chrome.runtime.onStartup.addListener(() => {
    chrome.alarms.create('checkSealx', { periodInMinutes: 1 })
})

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
            TabManager.getInstance().currentTab = tab;
        }
    } catch (error) {
        console.error('Failed to handle tab activation:', error);
    }
})

/**
 * Handles connection requests from other extension contexts
 */
messager.on(SealxTopic.CONNECT, async (request: SealxRequest<{ userId: string, title: string }>) => {
    const userId = request.payload.userId
    const title = request.payload.title
    const host = request.header.host
    const state = sessionStore.getState()
    state.setHost(host)
    state.setUserId(userId)
    let user = await getUser(userId, host)
    if (!user) {
        user = await addUser(userId, host)
    }
    state.setHost(host)
    state.setUserId(userId)
    state.setSession(state.session) // Refresh session based on updated host/userId
    // Session is still valid for this user/host
    if (
        state.session &&
        state.session.expire > (Date.now() + 10000) &&
        state.session.userId === userId &&
        state.session.host === host &&
        getSessionPrivateKey(host, userId)
    ) {
        return { session: state.session, account: user }
    } else {
        clearSessionFor(host, userId)
        const setRequest = useRequestStore.getState().setRequest
        setRequest(request)
        // Panel opens via gesture channel (content script click listener),
        // not via openPanel(). Store the request for panel self-routing.

        // 等待面板就绪（gesture channel 触发 sidePanel.open 后 panel 加载→发送 panel-ready）
        const ready = await PanelManager.waitForReady(5_000)
        if (!ready) {
            console.warn('Panel did not become ready within timeout, attempting communication anyway')
        }

        try {
            const res = await messager.send({ userId, host, title }, SealxTopic.CONNECT, MessageChannel.POPUP)
            await getUser(userId, host)
            // 直接返回 res.payload
            return res.payload
        } catch (error) {
            console.error('Panel connection failed:', error)
            throw error
        }
    }
})

messager.onForward(MessageChannel.POPUP, async (request: SealxRequest) => {
    if (!request.header.tabId && TabManager.getInstance().currentTabId) {
        request.header.tabId = TabManager.getInstance().currentTabId
    }
    const userId = request.header.userId
    const host = request.header.host
    const state = sessionStore.getState()
    if (host) state.setHost(host)
    if (userId) state.setUserId(userId)
    const setRequest = useRequestStore.getState().setRequest
    setRequest(request)
    // Store request in persist store — panel self-routes from store on load.
    // Panel opens via gesture channel (content script click listener).
    // No need to openPanel() or determine route here.
    // Forward the message to panel via bridge (no-op if panel not loaded).
})

// ========== 统一 panel-* 消息处理 ==========
// 处理面板队列处理和关闭通知
chrome.runtime.onMessage.addListener((message: Record<string, unknown>, _sender) => {
    if (message?.type === 'open-side-panel') {
        const tabId = _sender.tab?.id
        if (tabId) {
            PanelManager.openPanelWithSource(tabId).then(() => {
                PanelManager.notifyPanelOpened('')
            }).catch((err: Error) => {
                console.warn('open-side-panel: openPanelWithSource failed', err.message)
                chrome.storage.session.remove(['panelTriggerSource', 'panelTriggerSourceAt']).catch(() => {})
                PanelManager.setBadge()
                // Ensure default path + enabled (use PanelManager.panelPath, not hardcoded)
                chrome.sidePanel.setOptions({
                    path: PanelManager.panelPath,
                    enabled: true
                })
            })
        }
        return true
    }
    if (message?.type === 'sealx-pin-relay-keydown') {
        const key = typeof message.key === 'string' ? message.key : ''
        if (/^[a-zA-Z0-9]$/.test(key) || key === 'Backspace') {
            chrome.runtime.sendMessage({ type: 'sealx-pin-keydown', key }).catch(() => { })
        }
        return true
    }
    if (message?.type === 'panel-process-queue') {
        PanelManager.processNextInQueue()
        return true
    }
    if (message?.type === 'sealx-clear-session-private-key') {
        const host = typeof message.host === 'string' ? message.host : ''
        const userId = typeof message.userId === 'string' ? message.userId : ''
        if (host || userId) {
            clearSessionFor(host, userId)
        } else {
            sessionStore.getState().clearAllSession()
            clearAllSessionRuntimeState()
        }
        return true
    }
    if (message?.type === 'panel-closing') {
        // Side Panel 中 sender.tab 为 undefined，使用 processingTabId 清除队列
        const tabId = _sender.tab?.id ?? null
        if (tabId) {
            PanelManager.clearQueueForTab(tabId)
        } else {
            PanelManager.clearCurrentProcessingQueue()
        }
        PanelManager.notifyPanelClosing()
        useRequestStore.getState().clearRequest()
        return true
    }
    return false
})

// ========== 其他 handler ==========

messager.on(SealxTopic.CLOSE, async () => {
    return await PanelManager.closePanel()
})

messager.on(SealxTopic.BIND_PK, async (request: SealxRequest<{ pk: string, userId: string, host: string }>) => {
    const userId = request.payload.userId
    const host = request.payload.host
    const pk = request.payload.pk
    return await addUser(userId, host, { pk })
}, MessageChannel.POPUP)

messager.on(SealxTopic.RESET_PIN, async (request: SealxRequest<{ address: string, old: string, pin: string }>) => {
    const res = await resetSealxPin(request.payload.address, request.payload.old, request.payload.pin)
    sessionStore.getState().clearAllSession()
    clearAllSessionRuntimeState()
    return res?.address
})

/**
 * Checks if extension has been initialized (wallet created)
 * @returns Promise resolving to boolean indicating initialization status
 */
messager.on(SealxTopic.CHECK_INITIALIZED, async () => {
    return await checkInitialed()
})

/**
 * Gets the current screen off timeout setting
 * @returns Promise resolving to the timeout value in minutes (defaults to 5 if not set)
 */
messager.on(SealxTopic.GET_SCREEN_OFF_TIMER, async () => {
    const res = await getSealxInfo()
    return res?.sessionTimeout ?? 5
})

/**
 * Sets the screen off timeout value
 * @param request - Contains the new timeout value in minutes
 * @returns Promise resolving when the timeout is updated
 */
messager.on(SealxTopic.SET_SCREEN_OFF_TIMER, async (request: SealxRequest<number>) => {
    await setSealxSessionTimeout(request.payload)
    return request.payload
})

/**
 * Validates a provided PIN against stored wallet
 * @param request - Contains pin and address to validate
 * @returns Promise resolving to boolean indicating if PIN is valid
 */
messager.on(SealxTopic.CHECK_PIN, async (request: SealxRequest<string>) => {
    return await checkPin(request.payload)
})

/**
 * Checks if user session has expired for a given host
 * @param request - Contains userId and host to check
 * @returns Promise resolving to boolean indicating session status
 */
messager.on(SealxTopic.CHECK_SESSION_EXPIRED, async (_request: SealxRequest<{ userId: string, host: string }>) => {
    return await checkSessionExpire(_request.payload.userId, _request.payload.host)
})

/**
 * Initializes extension by creating a new wallet with provided PIN
 * @param request - Contains the encryption PIN
 * @returns Promise resolving to the wallet initialization result
 */
messager.on(SealxTopic.INITIALIZE, async (request: SealxRequest<string>) => {
    return await initialize(request.payload)
})

/**
 * Handles user login by generating a new session
 * @param request - Contains optional userId and host, plus required pin
 * @returns Promise resolving to the generated session
 */
messager.on(SealxTopic.LOGIN, async (request: SealxRequest<{ userId?: string, host?: string, pin: string }>) => {
    if (request.payload.host && request.payload.userId) {
        await addUser(request.payload.userId, request.payload.host)
    }
    return await generateSession(request.payload.pin, request.payload.host ?? '', request.payload.userId ?? '')
})

messager.on(SealxTopic.IMPORT_KEY, async (request: SealxRequest<{
    pin: string,
    ecSession: string
    tpPin: string
}>) => {
    // Verify PIN correctness
    const isPinValid = await checkPin(request.payload.pin)
    if (!isPinValid) {
        throw new Error('PIN code error')
    }

    const session = await decodeSession(request.payload.tpPin, request.payload.ecSession)
    const privateKey: string | null = await decodeSessionPrivateKey(session)
    if (privateKey) {
        const res = await initializeSealx(request.payload.pin, privateKey)
        if (!res) {
            throw new Error('Import key failed')
        }
        cachedAddress = res.address
        const state = sessionStore.getState()
        state.clearAllSession()
        clearAllSessionRuntimeState()
        return res.address
    }
    throw new Error('Import key failed')
})

messager.on(SealxTopic.VERIFY_TEMP_CODE, async (request: SealxRequest<{
    tpPin: string,
    ecSession: string
}>) => {
    try {
        const session = await decodeSession(request.payload.tpPin, request.payload.ecSession)
        const privateKey: string | null = await decodeSessionPrivateKey(session)
        return !!privateKey
    } catch (error) {
        console.error('Temp code verification failed:', error)
        return false
    }
})

/**
 * Exports private key as hex-encoded encrypted data
 * @param request - Contains pin, host, userId, expire, and sessionId for encryption
 * @returns Promise resolving to hex-encoded encrypted private key
 */
messager.on(SealxTopic.PK_HEX, async (request: SealxRequest<{
    pin: string,
    host?: string,
    userId?: string,
    expire?: number,
    sessionId?: string
}>) => {
    try {
        const { pin, host = '', userId = '', expire = 0, sessionId = '' } = request.payload
        const hex = await pkHex(pin, host, userId, expire, sessionId)
        return hex
    } catch (error) {
        console.error('Failed to export private key as hex:', error)
        throw error
    }
})

/**
 * Checks if user session has expired for a given host
 * @param userId - User identifier
 * @param host - Host domain
 * @returns Promise resolving to boolean (true if expired, false if valid)
 */
const checkSessionExpire = async (userId: string = '', host: string = '') => {
    const state = sessionStore.getState()
    const key = sessionKey(host, userId)
    const session = state.sessionMap[key]

    if (!session) {
        // No session found for this user/host
        return true
    }

    // Check if session has expired
    const now = Date.now()
    const isExpired = now >= session.expire

    // If session is expired, remove it from the session map
    if (isExpired) {
        delete state.sessionMap[key]
        clearSessionRuntimeState(host, userId, session.capabilityId)

        // If this is the current session, clear it
        if (state.session && state.session.sessionId === session.sessionId) {
            state.setSession(null)
        }
    }

    return isExpired
}

const clearSessionFor = (host: string = '', userId: string = '') => {
    const state = sessionStore.getState()
    const key = sessionKey(host, userId)
    delete state.sessionMap[key]
    const capabilityId = state.session?.host === host && state.session?.userId === userId
        ? state.session.capabilityId
        : undefined
    clearSessionRuntimeState(host, userId, capabilityId)
    if (
        state.session &&
        state.session.host === host &&
        state.session.userId === userId
    ) {
        state.setSession(null)
    }
}

let cachedAddress: string = ''
/**
 * Checks if extension has been initialized
 * @returns Promise resolving to the wallet address if initialized, empty string otherwise
 */
const checkInitialed = async () => {
    if (cachedAddress) {
        return cachedAddress
    }
    const res = await getSealxInfo()
    cachedAddress = res?.address ?? ''
    return cachedAddress
}

/**
 * Initializes extension by creating a new wallet
 * @param pin - Encryption PIN for the wallet
 * @returns Promise resolving to initialization result
 */
const initialize = async (pin: string) => {
    const res = await initializeSealx(pin)
    cachedAddress = res.address
    return res.address
}

/**
 * Validates a PIN against the stored wallet.
 * Rate limiting is enforced in state/getAddressByPin so all PIN entry points
 * share one lock policy.
 * @param pin - PIN to validate
 * @returns Promise resolving to boolean indicating if PIN is valid
 */
const checkPin = async (pin: string) => {
    const address = await getAddressByPin(pin)
    return !!address
}


messager.on(SealxTopic.SIGN, async (request: SealxRequest<{ host: string, userId: string, signContent: Eip712Struct }>) => {
    const state = sessionStore.getState()
    state.setHost(request.payload.host)
    state.setUserId(request.payload.userId)
    const session = state.session
    if (!session) {
        return signingFailure(new SigningError('SESSION_EXPIRED', 'Session expired. Please unlock SealX again.'))
    }
    const now = Date.now()
    const requestHost = request.payload.host ?? ''
    const requestUserId = request.payload.userId ?? ''
    if (session.expire <= now || session.host !== requestHost || session.userId !== requestUserId) {
        clearSessionFor(session.host ?? '', session.userId ?? '')
        return signingFailure(new SigningError('SESSION_EXPIRED', 'Session expired. Please unlock SealX again.'))
    }
    const pk = getSessionPrivateKey(requestHost, requestUserId)
    const signingProvider = createMemorySigningProvider(pk)
    if (!signingProvider) {
        clearSessionFor(requestHost, requestUserId)
        return signingFailure(new SigningError('MEMORY_KEY_MISSING', 'Session key is no longer available. Please unlock SealX again.'))
    }
    if (!session.capabilityId) {
        clearSessionFor(requestHost, requestUserId)
        return signingFailure(new SigningError('CAPABILITY_MISSING', 'Signing authorization is missing. Please unlock SealX again.'))
    }
    try {
        return await runWithSigningCapability(
            session.capabilityId,
            session,
            request.payload.signContent,
            () => signingProvider.signTypedData(request.payload.signContent)
        ) ?? null
    } catch (error) {
        if (!(error instanceof SigningError && ['AMOUNT_LIMIT_EXCEEDED', 'USAGE_LIMIT_REACHED', 'POLICY_MISMATCH', 'CAPABILITY_BUSY'].includes(error.code))) {
            clearSessionFor(requestHost, requestUserId)
        }
        return signingFailure(error)
    }
}, MessageChannel.POPUP)
//

// ========== Global shortcut: inject PIN input overlay ==========
// In browser fullscreen mode, the side panel can't receive keyboard events
// because it doesn't have focus. The user presses Ctrl/Cmd+Shift+K to open
// a focused input overlay directly on the web page (which DOES have focus).
// Keystrokes typed into this overlay are forwarded to the side panel.

/**
 * Injected into the web page via chrome.scripting.executeScript.
 * This function runs in the ISOLATED world and has access to chrome.* APIs.
 * It creates a small focused input overlay, captures keystrokes, and forwards
 * them to the side panel via the background service worker.
 */
async function injectPinInputOverlay() {
    // Avoid duplicate overlays
    const existing = document.querySelector('#sealx-pin-overlay');
    if (existing) {
        const input = existing.querySelector('input');
        input?.focus();
        return;
    }

    // Create overlay container
    const overlay = document.createElement('div');
    overlay.id = 'sealx-pin-overlay';
    overlay.style.cssText = `
        position: fixed; left: 50%; top: 60px; transform: translateX(-50%);
        z-index: 2147483647; display: flex; align-items: center; gap: 8px;
        background: white; border: 1.5px solid #0aa06e; border-radius: 12px;
        padding: 10px 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.18);
        font-family: system-ui, sans-serif;
    `;

    // Hint label
    const label = document.createElement('span');
    label.textContent = 'PIN:';
    label.style.cssText = 'font-size:14px; font-weight:700; color:#5a6677;';

    // Hidden real input — captures keyboard events
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 6;
    input.autocomplete = 'off';
    input.style.cssText = `
        width: 120px; font-size: 18px; font-weight: 800; border: none;
        outline: none; letter-spacing: 4px; color: #17202a;
    `;

    // Dismiss on Escape
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
        }
    });

    // Track previous value to detect additions vs deletions
    let prevVal = '';
    input.addEventListener('input', () => {
        const val = input.value;
        if (val.length < prevVal.length) {
            // Backspace was pressed
            chrome.runtime.sendMessage({ type: 'sealx-pin-relay-keydown', key: 'Backspace' }).catch(() => {});
        } else {
            // New character added
            const added = val.split('').find((c, i) => c !== prevVal[i]);
            if (added && /^[a-zA-Z0-9]$/.test(added)) {
                chrome.runtime.sendMessage({ type: 'sealx-pin-relay-keydown', key: added }).catch(() => {});
            }
        }
        prevVal = val;
        // Auto-dismiss after 6 chars
        if (val.length >= 6) {
            setTimeout(() => overlay.remove(), 600);
        }
    });

    overlay.appendChild(label);
    overlay.appendChild(input);

    // Find the best parent: prefer the fullscreen element, body, or documentElement
    const root = document.fullscreenElement || document.body || document.documentElement;
    root.appendChild(overlay);

    input.focus();
}

chrome.commands.onCommand.addListener(async (command, tab) => {
    if (command !== 'enable-pin-input') return;
    console.log('[CMD] enable-pin-input — command tab:', tab?.id, tab?.url);

    // Try the command's tab first, fall back to finding any HTTP/HTTPS tab
    const tabs: Array<{ id?: number }> = [];
    if (tab?.id && tab.url && !tab.url.startsWith('chrome://')) {
        tabs.push(tab);
    }
    if (tabs.length === 0) {
        const queriedTabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
        tabs.push(...queriedTabs);
    }
    if (tabs.length === 0) {
        console.warn('[CMD] no injectable tab found');
        return;
    }

    const targetTabId = tabs[0].id!;
    console.log('[CMD] injecting overlay into tab', targetTabId);
    try {
        await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            func: injectPinInputOverlay,
        });
        console.log('[CMD] pin overlay injected');
    } catch (err) {
        console.warn('[CMD] script injection failed:', (err as Error)?.message);
    }
});

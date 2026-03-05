import { MessageChannel, MessagerManager, SealxTopic, type SealxRequest } from "sealx-message";
import PopupManager from "./popup-manager";
import { addUser, generateSession, getAddressByPin, getSealxInfo, getUser, initializeSealx, initializeSealxInfo, installDB, pkHex, resetSealxPin, setSealxSessionTimeout } from "./state";
import { decodeSession, decodeSessionPrivateKey, sessionKey } from "@src/core/utils/helper";
import { sessionStore } from "@src/core/state";
import { TabManager, type Eip712Struct } from "sealx-core";
import { signTypeContent } from "./utils/crypto";
import { useRequestStore } from "@src/core/state/request";

/**
 * Current version of the IndexedDB database schema
 */
const DB_VERSION = 1
// Initialize message handler and popup manager
const messager = MessagerManager.getMessager()
PopupManager.setMessager(messager)
PopupManager.setPopupWindow()

/**
 * Handles extension installation by setting up required databases
 */
chrome.runtime.onInstalled.addListener(() => {
    installDB('sealx', ['base-info', 'sealx-pk', 'user'], DB_VERSION).then(() => {
        initializeSealxInfo()
    })
})

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    // 当标签页激活时，尝试发送消息到content脚本，如果失败则刷新页面注入脚本
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);

        // 只对有效的网页URL进行处理
        if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
            // 首先尝试发送消息到content脚本，检查是否已加载
            await chrome.tabs.sendMessage(activeInfo.tabId, {
                type: 'CHECK_CONTENT_SCRIPT_LOADED'
            }).catch(async error => {
                // 如果发送消息失败，说明content脚本未加载，需要刷新页面注入脚本
                console.debug('Content script not loaded, refreshing tab to inject script:', error.message);

                // 刷新标签页以确保content脚本被正确注入
                await chrome.tabs.reload(activeInfo.tabId).catch(reloadError => {
                    console.debug('Tab reload failed:', reloadError.message);
                });

                console.log('Tab refreshed to inject content script:', tab.id, tab.url);
            });

            // 如果发送消息成功，content脚本已加载
            console.log('Content script already loaded for tab:', tab.id, tab.url);
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
    console.log('CONNECT user:', user, request, state.session)
    state.setHost(host)
    state.setUserId(userId)
    state.setSession(state.session) // Refresh session based on updated host/userId
    if (state.session && state.session.expire > (Date.now() + 10000) && state.session.userId == userId && state.session.userId) {
        return { session: state.session, account: user }
    } else {
        console.log('CONNECT need login:', request, state.session, state.session ? state.session.expire > (Date.now() + 10000) : false)
        state.setSession(null)
        const setRequest = useRequestStore.getState().setRequest
        setRequest(request)
        if (request.header.fullscreen) {
            await PopupManager.popupWindow(2, 'login')
        } else {
            await PopupManager.popupWindow(1, 'login')
        }
        while (!await checkPopup()) {
            // check active
        }
        try {
            state.setSession({
                sessionId: "",
                address: "",
                expire: 0
            })
            const res = await messager.send({ userId, host, title }, SealxTopic.CONNECT, MessageChannel.POPUP)
            const user1 = await getUser(userId, host)
            // PopupManager.closeWindow()
            return {
                session: res.payload,
                account: user1
            }
        } catch (error) {
            console.error('Popup connection failed:', error)
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
    // Ensure popup is fully loaded before forwarding messages
    let route = ''
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
    if (request.topic !== SealxTopic.SIGN_RESPONSE) {
        // await PopupManager.popupWindow(2, route)
        if (request.header.fullscreen) {
            await PopupManager.popupWindow(2, route)
        } else {
            await PopupManager.popupWindow(1, route)
        }
    }
    // Wait for popup to be fully initialized and ready to receive messages
    // Increased timeout to ensure React app is fully mounted
    // await wait(1000)
    while (!await checkPopup()) {
        // check active
    }

})

const checkPopup = async () => {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            resolve(false)
        }, 100)
        const checkActive = async () => {
            try {
                const res = await messager.send('', SealxTopic.CHECK_ACTIVE, MessageChannel.POPUP)
                resolve(res?.payload ?? false)
            } catch (e) {
                console.error(e)
                resolve(false)
            } finally {
                clearTimeout(timer)
            }
        }
        checkActive()
    })
}

messager.on(SealxTopic.CLOSE, async () => {
    return await PopupManager.closeWindow()
})

messager.on(SealxTopic.BIND_PK, async (request: SealxRequest<{ pk: string, userId: string, host: string }>) => {
    const userId = request.payload.userId
    const host = request.payload.host
    const pk = request.payload.pk
    return await addUser(userId, host, { pk })
}, MessageChannel.POPUP)

messager.on(SealxTopic.RESET_PIN, async (request: SealxRequest<{ address: string, old: string, pin: string }>) => {
    const res = await resetSealxPin(request.payload.address, request.payload.old, request.payload.pin)
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
        console.log('----- private key -----', privateKey)
        const res = await initializeSealx(request.payload.pin, privateKey)
        console.log('--------- import result ---', res)
        if (!res) {
            throw new Error('Import key failed')
        }
        const state = sessionStore.getState()
        state.clearAllSession()
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

        // If this is the current session, clear it
        if (state.session && state.session.sessionId === session.sessionId) {
            state.setSession(null)
        }
    }

    return isExpired
}

let address: string = ''
/**
 * Checks if extension has been initialized (stub implementation)
 * @returns Promise resolving to boolean (currently always false)
 */
const checkInitialed = async () => {
    if (address) {
        return address
    }
    getSealxInfo().then((res) => {
        address = res?.address ?? ''
    })
    return ''
}

/**
 * Initializes extension by creating a new wallet
 * @param pin - Encryption PIN for the wallet
 * @returns Promise resolving to initialization result
 */
const initialize = async (pin: string) => {
    const res = await initializeSealx(pin)
    return res.address
}

/**
 * Validates a PIN against a wallet address
 * @param pin - PIN to validate
 * @param address - Wallet address to check against
 * @returns Promise resolving to boolean indicating if PIN is valid
 */
const checkPin = async (pin: string) => {
    const address = await getAddressByPin(pin)
    return address ? true : false
}


messager.on(SealxTopic.SIGN, async (request: SealxRequest<{ host: string, userId: string, signContent: Eip712Struct }>) => {
    const state = sessionStore.getState()
    state.setHost(request.payload.host)
    state.setUserId(request.payload.userId)
    const session = state.session
    console.log('-------- sign handle ----', request, session, state)
    if (session) {
        const info = await getSealxInfo()
        if (info?.pks) {
            session.pk = info.pks[session.pk] ?? session.pk
        }
        const pk = await decodeSessionPrivateKey(session)
        // const record = await getPrivateKey
        if (pk) {
            //
            return await signTypeContent(request.payload.signContent, pk)
        }
    }
    return null
}, MessageChannel.POPUP)
//

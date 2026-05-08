import { MessageChannel, SealxTopic } from "sealx-message"
import messager from "../messager"
import CryptoJS from "crypto-js"
import type { Eip712Struct, SealxSession } from "sealx-core"

const SEALX_KEY = `7f35d4e45d3724baa39beb35202c6955a55e24fff815335c4c72b86d3b8ffa7c`

declare global {
    interface Window {
        checkSessionExpire: (userId: string, host: string) => Promise<boolean>
        checkInitialed: () => Promise<boolean>
        initialize: () => Promise<string>
        checkPin: (pin: string) => Promise<boolean>
    }
}

/**
 * Hashes a pin with the SEALX_KEY using SHA256
 * @param pin The pin to hash
 * @returns Hex string of the hashed pin
 */
export const hashPin = (pin: string): string => {
    return CryptoJS.SHA256(pin + SEALX_KEY).toString(CryptoJS.enc.Hex)
}

/**
 * Gets the Chrome extension background page
 * @returns Promise resolving to the background page or null if not available
 */
export const getBackground = async (): Promise<Window | null> => {
    return await chrome.extension.getBackgroundPage()
}

/**
 * Helper function to send messages with error handling
 * @param payload The message payload
 * @param topic The message topic
 * @returns Promise resolving to the response payload
 */
const sendMessage = async <T>(payload: unknown, topic: SealxTopic): Promise<T> => {
    try {
        const res = await messager.send(payload, topic, MessageChannel.BACKGROUND)
        return res.payload
    } catch (error) {
        console.error(`Error in ${topic}:`, error)
        throw error
    }
}

/**
 * Initializes SealX with the given pin
 * @param pin The pin to initialize with
 * @returns Promise resolving when initialization is complete
 */
export const initializeSealx = async (pin: string): Promise<string> => {
    return await sendMessage<string>(hashPin(pin), SealxTopic.INITIALIZE)
}

/**
 * Resets the SealX pin
 * @param address The user address
 * @param old The old pin
 * @param pin The new pin
 * @returns Promise resolving when pin reset is complete
 */
export const resetSealxPin = async (address: string, old: string, pin: string): Promise<string> => {
    return await sendMessage<string>({
        address,
        old: hashPin(old),
        pin: hashPin(pin)
    }, SealxTopic.RESET_PIN)
}

/**
 * Checks if the given pin is valid
 * @param pin The pin to check
 * @returns Promise resolving to boolean indicating if pin is valid
 */
export const checkPin = async (pin: string): Promise<boolean> => {
    return await sendMessage<boolean>(hashPin(pin), SealxTopic.CHECK_PIN)
}

/**
 * Logs in with the given pin
 * @param pin The pin to login with
 * @param userId Optional user ID
 * @param host Optional host
 * @returns Promise resolving when login is complete
 */
export const login = async (pin: string, userId: string = '', host: string = ''): Promise<SealxSession> => {
    return await sendMessage<SealxSession>({
        pin: hashPin(pin),
        userId,
        host
    }, SealxTopic.LOGIN)
}

/**
 * Checks if SealX is initialized
 * @returns Promise resolving to boolean indicating initialization status
 */
export const checkInitialed = async (): Promise<string> => {
    return await sendMessage<string>(true, SealxTopic.CHECK_INITIALIZED)
}

/**
 * Gets the current session timeout
 * @returns Promise resolving to the timeout in milliseconds
 */
export const getSealxSessionTimeout = async (): Promise<number> => {
    return await sendMessage<number>('', SealxTopic.GET_SCREEN_OFF_TIMER)
}

/**
 * Sets the session timeout
 * @param time Timeout in milliseconds
 * @returns Promise resolving to the new timeout value
 */
export const setSessionTimeout = async (time: number): Promise<number> => {
    return await sendMessage<number>(time, SealxTopic.SET_SCREEN_OFF_TIMER)
}


/**
 * Verifies the temporary code for import
 * @param tpPin The temporary pin to verify
 * @param ecSession The ecSession content from file
 * @returns Promise resolving to boolean indicating if verification succeeded
 */
export const verifyTempCode = async (tpPin: string, ecSession: string): Promise<boolean> => {
    return await sendMessage<boolean>({ tpPin: hashPin(tpPin), ecSession }, SealxTopic.VERIFY_TEMP_CODE)
}

export const importKey = async (pin: string, ecSession: string, tpPin: string): Promise<string> => {
    return await sendMessage<string>({ pin: hashPin(pin), ecSession, tpPin: hashPin(tpPin) }, SealxTopic.IMPORT_KEY)
}

export const bindKey = async (userId: string, host: string, pk: string): Promise<string> => {
    return await sendMessage<string>({ userId, host, pk }, SealxTopic.BIND_PK)
}

/**
 * Exports private key as hex-encoded encrypted data
 * @param pin - User's PIN for decryption
 * @param host - Optional host domain
 * @param userId - Optional user identifier
 * @param expire - Optional expiration timestamp
 * @param sessionId - Optional session identifier
 * @returns Promise resolving to hex-encoded encrypted private key
 */
export const pkHex = async (
    pin: string,
    host: string = '',
    userId: string = '',
    expire: number = 0,
    sessionId: string = ''
): Promise<string> => {
    return await sendMessage<string>({ pin: hashPin(pin), host, userId, expire, sessionId }, SealxTopic.PK_HEX)
}

export const sign = async (userId: string, host: string, signContent: Eip712Struct | Eip712Struct[]): Promise<{ signature: string, address: string } | { signature: string, address: string }[] | null> => {
    return await sendMessage({ userId, host, signContent }, SealxTopic.SIGN)
}

export const closeWindow = async () => {
    try {
        const result = await sendMessage(null, SealxTopic.CLOSE)
        console.log('[closeWindow] sendMessage result:', result)
    } catch (error) {
        console.error('[closeWindow] sendMessage error:', error)
    }
    // Side Panel 模式下 window.close() 无效，不再调用
}

import { dbStorageWrapper, type Eip712Struct, type SealxAccount, type SealxSession, PinError, DataCorruptedError } from "sealx-core";
import type { PrivateKeyStoreRecord, SealxBaseInfo } from "../models";
import { createWallet } from "../utils/wallet";
import { decodeEncryptedPrivateKey, encodePrivateKey, strToHex } from "../utils/crypto";
import CryptoJS from "crypto-js";
import { sessionKey } from "@src/core/utils/helper";
import { sessionStore } from "@src/core/state/session";
import { syncStores } from "@src/core/state/internal/syncStores";
import { extractPolicyAction, type PolicyAsset } from "../policy-adapters";
import type { AuthMethod } from "../signing-providers";
import { SigningError } from "../signing-errors";
syncStores()

// --- IndexedDB write mutex ---
// Serializes write operations on shared tables to prevent race conditions
// (e.g. clear() + setItem() gaps) in the single-threaded SW event loop.
let _dbLock: Promise<void> = Promise.resolve()

function withDbLock<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void
    const chain = _dbLock.then(fn)
    _dbLock = new Promise<void>(r => { release = r })
    return chain.finally(() => release!())
}
// --- End DB mutex ---

const privateKeyTable = () => dbStorageWrapper('sealx', 'sealx-pk');
const memoryKeyrings = new Map<string, string>()
const DEFAULT_MAX_SIGN_COUNT = 10

export interface SigningCapability {
    id: string
    address: string
    host: string
    userId: string
    expiresAt: number
    maxSignCount: number
    usedSignCount: number
    maxSingleAmount?: string
    maxTotalAmount?: string
    usedTotalAmount: string
    asset?: PolicyAsset
    createdAt: number
    authMethod: AuthMethod
}

const signingCapabilities = new Map<string, SigningCapability>()
const capabilityLocks = new Set<string>()

const memoryKeyringKey = (host: string = '', userId: string = '') => sessionKey(host, userId)

export const setSessionPrivateKey = (host: string = '', userId: string = '', privateKey: string) => {
    memoryKeyrings.set(memoryKeyringKey(host, userId), privateKey)
}

export const getSessionPrivateKey = (host: string = '', userId: string = '') => {
    return memoryKeyrings.get(memoryKeyringKey(host, userId)) ?? null
}

export const clearSessionPrivateKey = (host: string = '', userId: string = '') => {
    memoryKeyrings.delete(memoryKeyringKey(host, userId))
}

export const clearAllSessionPrivateKeys = () => {
    memoryKeyrings.clear()
}

const createSigningCapability = ({
    id,
    address,
    host = '',
    userId = '',
    expiresAt,
}: {
    id: string
    address: string
    host?: string
    userId?: string
    expiresAt: number
}) => {
    const capability: SigningCapability = {
        id,
        address,
        host,
        userId,
        expiresAt,
        maxSignCount: DEFAULT_MAX_SIGN_COUNT,
        usedSignCount: 0,
        usedTotalAmount: '0',
        createdAt: Date.now(),
        authMethod: 'pin'
    }
    signingCapabilities.set(id, capability)
    return capability
}

export const getSigningCapability = (id?: string | null) => {
    return id ? signingCapabilities.get(id) ?? null : null
}

export const clearSigningCapability = (id?: string | null) => {
    if (!id) return
    signingCapabilities.delete(id)
    capabilityLocks.delete(id)
}

export const clearAllSigningCapabilities = () => {
    signingCapabilities.clear()
    capabilityLocks.clear()
}

export const clearSessionRuntimeState = (host: string = '', userId: string = '', capabilityId?: string | null) => {
    clearSessionPrivateKey(host, userId)
    clearSigningCapability(capabilityId)
}

export const clearAllSessionRuntimeState = () => {
    clearAllSessionPrivateKeys()
    clearAllSigningCapabilities()
}

const parseCapabilityLimit = (value?: string) => {
    if (!value) return null
    if (!/^\d+$/.test(value)) {
        throw new SigningError('POLICY_MISMATCH', 'Invalid signing capability amount limit')
    }
    return BigInt(value)
}

const normalizePolicyValue = (value?: string | number) => `${value ?? ''}`.trim().toLowerCase()

const ensureAssetPolicy = (capability: SigningCapability, actionAsset: PolicyAsset | null) => {
    const expected = capability.asset
    if (!expected) return
    if (!actionAsset) {
        throw new SigningError('POLICY_MISMATCH', 'Signing capability cannot parse asset')
    }
    if (
        expected.chainId !== undefined &&
        expected.chainId !== actionAsset.chainId
    ) {
        throw new SigningError('POLICY_MISMATCH', 'Signing capability chainId does not match')
    }
    if (
        expected.verifyingContract &&
        normalizePolicyValue(expected.verifyingContract) !== normalizePolicyValue(actionAsset.verifyingContract)
    ) {
        throw new SigningError('POLICY_MISMATCH', 'Signing capability verifying contract does not match')
    }
    if (
        expected.token &&
        normalizePolicyValue(expected.token) !== normalizePolicyValue(actionAsset.token)
    ) {
        throw new SigningError('POLICY_MISMATCH', 'Signing capability token does not match')
    }
    if (
        expected.symbol &&
        normalizePolicyValue(expected.symbol) !== normalizePolicyValue(actionAsset.symbol)
    ) {
        throw new SigningError('POLICY_MISMATCH', 'Signing capability symbol does not match')
    }
}

const getAmountPolicyUpdate = (capability: SigningCapability, signContent?: Eip712Struct) => {
    const maxSingleAmount = parseCapabilityLimit(capability.maxSingleAmount)
    const maxTotalAmount = parseCapabilityLimit(capability.maxTotalAmount)
    if (maxSingleAmount === null && maxTotalAmount === null) {
        return null
    }

    if (!signContent) {
        throw new SigningError('POLICY_MISMATCH', 'Signing capability requires sign content for amount policy')
    }
    const action = extractPolicyAction(signContent)
    if (!action) {
        throw new SigningError('POLICY_MISMATCH', 'Signing capability cannot apply amount policy to unknown template')
    }
    if (action.amount === null) {
        throw new SigningError('POLICY_MISMATCH', 'Signing capability cannot parse amount')
    }
    ensureAssetPolicy(capability, action.asset)
    if (maxSingleAmount !== null && action.amount > maxSingleAmount) {
        throw new SigningError('AMOUNT_LIMIT_EXCEEDED', 'Signing capability single amount limit exceeded')
    }

    const usedTotalAmount = BigInt(capability.usedTotalAmount)
    if (maxTotalAmount !== null && usedTotalAmount + action.amount > maxTotalAmount) {
        throw new SigningError('AMOUNT_LIMIT_EXCEEDED', 'Signing capability total amount limit exceeded')
    }

    return {
        usedTotalAmount: (usedTotalAmount + action.amount).toString(),
        asset: action.asset ?? capability.asset
    }
}

export const runWithSigningCapability = async <T>(
    id: string,
    session: SealxSession,
    signContent: Eip712Struct,
    action: () => Promise<T | null | undefined>
) => {
    if (capabilityLocks.has(id)) {
        throw new SigningError('CAPABILITY_BUSY', 'Signing capability is busy')
    }
    capabilityLocks.add(id)
    try {
        const capability = getSigningCapability(id)
        if (!capability) {
            throw new SigningError('CAPABILITY_MISSING', 'Signing capability not found')
        }
        if (capability.expiresAt <= Date.now()) {
            clearSigningCapability(id)
            throw new SigningError('CAPABILITY_EXPIRED', 'Signing capability expired')
        }
        if (
            capability.address !== session.address ||
            capability.host !== (session.host ?? '') ||
            capability.userId !== (session.userId ?? '')
        ) {
            throw new SigningError('SESSION_MISMATCH', 'Signing capability does not match session')
        }
        if (capability.usedSignCount >= capability.maxSignCount) {
            throw new SigningError('USAGE_LIMIT_REACHED', 'Signing capability usage limit reached')
        }
        const amountPolicyUpdate = getAmountPolicyUpdate(capability, signContent)
        const result = await action()
        if (result !== null && result !== undefined) {
            if (amountPolicyUpdate) {
                capability.usedTotalAmount = amountPolicyUpdate.usedTotalAmount
                capability.asset = amountPolicyUpdate.asset
            }
            capability.usedSignCount += 1
        }
        return result
    } finally {
        capabilityLocks.delete(id)
    }
}

// --- Global PIN brute-force rate limiting ---
// Applies to ALL PIN verification entry points (checkPin, login, import, export).
// Rolling window: 10 failures in 1 minute triggers lock with exponential backoff.
// PIN success resets everything.
const MAX_PIN_ATTEMPTS = 10
const PIN_WINDOW_MS = 60 * 1000 // 1 minute sliding window
const PIN_BASE_LOCK_MINUTES = 10
let _pinFailures: number[] = [] // timestamps of failures in current window
let _pinLockExpire = 0
let _lockCount = 0 // number of times locked (for exponential backoff)

function assertPinNotLocked() {
    if (_pinLockExpire > 0 && Date.now() < _pinLockExpire) {
        const remaining = Math.ceil((_pinLockExpire - Date.now()) / 60000)
        throw new Error(`PIN locked. Remaining: ${remaining} minutes`)
    }
    if (_pinLockExpire > 0) {
        _pinLockExpire = 0
        _pinFailures = []
    }
}

function recordPinSuccess() {
    _pinFailures = []
    _pinLockExpire = 0
    _lockCount = 0
}

function recordPinFailure() {
    const now = Date.now()
    _pinFailures.push(now)

    const cutoff = now - PIN_WINDOW_MS
    _pinFailures = _pinFailures.filter(t => t > cutoff)

    if (_pinFailures.length >= MAX_PIN_ATTEMPTS) {
        _lockCount++
        // Exponential backoff: 10min, 20min, 40min, 80min, ...
        const lockMs = PIN_BASE_LOCK_MINUTES * 60 * 1000 * Math.pow(2, _lockCount - 1)
        _pinLockExpire = now + lockMs
        _pinFailures = []
    }
}
// --- End rate limiting ---

/**
 * Initializes SealX by creating a new wallet and encrypting its private key
 * @param pin - User's PIN for encryption
 * @returns Promise resolving to the stored record
 */
export const initializeSealx = async (pin: string, privateKey: string = ''): Promise<PrivateKeyStoreRecord> => {
    const db = privateKeyTable()
    // const pin1 = CryptoJS.SHA256(pin).toString(CryptoJS.enc.Hex)
    try {
        const wallet = createWallet(privateKey)
        if(!privateKey)privateKey = wallet.privateKey
        const address = wallet.address.toLowerCase()
        const storeRecord = await encodePrivateKey(address, privateKey, pin)
        const baseInfo = await getSealxInfo()
        if (baseInfo) {
            baseInfo.address = address
            baseInfo.updateTime = Date.now()
            await sealxTable().setItem(baseInfoKey, baseInfo)
        }
        await withDbLock(async () => {
            await db.clear()
            await db.setItem(storeRecord.id, storeRecord);
        })
        clearAllSessionRuntimeState()
        return storeRecord;
    } catch (error) {
        console.error('Failed to initialize SealX:', error);
        throw new Error('Initialization failed');
    } finally {
        db.close()
    }
}

/**
 * Resets the encryption PIN for a wallet by re-encrypting the private key with a new PIN
 * 
 * @param address - Wallet address to update
 * @param oldPin - Current PIN for decryption
 * @param pin - New PIN for encryption
 * @returns Promise resolving to the updated PrivateKeyStoreRecord
 * @throws Error if:
 * - The old PIN is incorrect
 * - Private key cannot be retrieved
 * - Re-encryption fails
 */
export const resetSealxPin = async (address: string, oldPin: string, pin: string) => {
    const db = privateKeyTable()
    try {
        const privateKey = await getPrivateKey(oldPin)
        if (privateKey) {
            const storeRecord = await encodePrivateKey(address, privateKey, pin)
            await withDbLock(async () => {
                await db.clear()
                await db.setItem(storeRecord.id, storeRecord);
            })
            clearAllSessionRuntimeState()
            return storeRecord
        }
    } finally {
        db.close()
    }
}

/**
 * Retrieves and decrypts a private key with additional validation
 * @param id - Wallet address/ID
 * @param pin - User's PIN for decryption
 * @returns Promise resolving to decrypted private key or null if not found
 * @throws Error if decryption fails or data is invalid
 */
export const getPrivateKey = async (pin: string): Promise<string | null> => {
    assertPinNotLocked()

    // Validate inputs
    if (!pin) {
        throw new Error('Invalid parameters');
    }

    const result = await getSealxPkRecord(pin);
    if (!result) {
        recordPinFailure()
        return null;
    }

    // Verify required fields exist
    if (!result.encrypted || !result.iv || !result.slat) {
        throw new Error('Invalid stored key data');
    }

    // Additional validation - check if private key is valid
    try {
        const pk = await decodeEncryptedPrivateKey(result, pin, result.address)
        recordPinSuccess()
        return pk
    } catch (walletError) {
        // Data corruption is NOT a PIN failure — don't count against rate limiting
        if (walletError instanceof DataCorruptedError) {
            throw new Error(`Data corrupted: ${walletError.message}`);
        }
        recordPinFailure()
        console.log('------- wallet error ------', walletError)
        throw new Error(`Invalid private key: ${walletError instanceof Error ? walletError.message : 'Unknown error'}`);
    }

}

/**
 * Gets the wallet address associated with a given PIN
 * @param pin - User's PIN for decryption
 * @returns Promise resolving to the wallet address or empty string if not found
 */
export const getAddressByPin = async (pin: string) => {
    assertPinNotLocked()

    const result = await getSealxPkRecord(pin)
    if (!result) {
        recordPinFailure()
    }
    return result?.address ?? ''
}

/**
 * Retrieves the encrypted private key record for a given PIN
 * @param pin - User's PIN used as the record key
 * @returns Promise resolving to PrivateKeyStoreRecord or undefined if not found
 * @throws Error if PIN is invalid
 */
export const getSealxPkRecord = async (pin: string) => {
    const db = privateKeyTable()
    try {
        // Validate inputs
        if (!pin) {
            throw new Error('Invalid parameters');
        }
        const pin1 = CryptoJS.SHA256(pin).toString(CryptoJS.enc.Hex)
        const result = await db.getItem<PrivateKeyStoreRecord>(pin1);
        return result
    } finally {
        db.close()
    }
}

const sealxTable = () => dbStorageWrapper('sealx', 'base-info');
const baseInfoKey = 'sealx-info-2025';

/**
 * Gets basic SealX information
 * @returns Promise resolving to SealxBaseInfo or null if not found
 */
export const getSealxInfo = async (): Promise<SealxBaseInfo | null> => {
    const db = sealxTable()
    try {
        return await db.getItem<SealxBaseInfo>(baseInfoKey);
    } catch (error) {
        console.error('Failed to get SealX info:', error);
        return null;
    } finally {
        db.close()
    }
}

export const saveSealxInfo = async (info: SealxBaseInfo): Promise<SealxBaseInfo | null> => {
    const db = sealxTable()
    try {
        return await db.setItem<SealxBaseInfo>(baseInfoKey, info);
    } catch (error) {
        console.error('Failed to save SealX info:', error);
        return null;
    } finally {
        db.close()
    }
}

/**
 * Initializes the base information record for SealX extension
 * 
 * @returns Promise resolving to the created SealxBaseInfo record
 * @remarks
 * - Sets the current extension version from manifest
 * - Records the installation timestamp
 * - Initializes with empty address (to be updated later)
 */
export const initializeSealxInfo = async (time?: number) => {
    const db = sealxTable()
    try {
        const version = chrome.runtime.getManifest().version
        const existing = await db.getItem<SealxBaseInfo>(baseInfoKey)
        const info = {
            ...existing,
            version,
            installedTime: existing?.installedTime ?? Date.now(),
            address: existing?.address ?? '',
            sessionTimeout: time ?? existing?.sessionTimeout ?? 5
        } as SealxBaseInfo
        return await db.setItem(baseInfoKey, info)
    } finally {
        db.close()
    }
}

export const setSealxSessionTimeout = async (time: number) => {
    const db = sealxTable()
    try {
        const info = await db.getItem<SealxBaseInfo>(baseInfoKey);
        if (info) {
            info.sessionTimeout = time
            return await db.setItem(baseInfoKey, info)
        } else {
            return initializeSealxInfo(time)
        }

    } finally {
        db.close()
    }
}

/**
 * Installs IndexedDB database with specified tables/object stores
 *
 * @param dbName - Name of the database to create/upgrade
 * @param tables - Array of table/object store names to create
 * @returns Promise that resolves when database is ready
 * @remarks
 * - Creates a new database or upgrades existing one to specified version
 * - Creates all specified tables if they don't exist
 * - Resolves immediately if DB already exists at target version (no upgrade needed)
 * - Used during initial extension setup
 */
export const installDB = (dbName: string, tables: string[], version: number = 1) => {
    return new Promise((resolve) => {
        const request = indexedDB.open(dbName, version);
        request.onupgradeneeded = () => {
            const db = request.result;
            for (const table of tables) {
                if (!db.objectStoreNames.contains(table)) {
                    db.createObjectStore(table);
                }
            }
        };
        request.onsuccess = () => {
            request.result.close()
            resolve(true)
        };
        request.onerror = () => {
            resolve(false)
        };
    })
}





/**
 * Generates a new session for a user with expiration
 * @param pin - User's PIN for address verification
 * @param host - Optional host domain for the session
 * @param userId - Optional user identifier
 * @returns Promise resolving to the created SealxSession
 * @throws PinError if address cannot be retrieved
 */
export const generateSession = async (pin: string, host: string = '', userId: string = '') => {
    const key = sessionKey(host, userId)
    const sessionId = CryptoJS.SHA256(key + Date.now()).toString()
    const sealxInfo = await getSealxInfo()
    const expire = Date.now() + (sealxInfo?.sessionTimeout ?? 3) * 60 * 1000
    const address = await getAddressByPin(pin)
    if (!address) {
        throw new PinError()
    }
    const setSession = sessionStore.getState().setSession
    const pk = await getPrivateKey(pin)
    if (!pk) {
        throw new PinError()
    }
    setSessionPrivateKey(host, userId, pk)
    const capability = createSigningCapability({
        id: sessionId,
        address,
        host,
        userId,
        expiresAt: expire
    })

    const session: SealxSession = {
        address,
        expire,
        host,
        userId,
        sessionId,
        capabilityId: capability.id
    }

    setSession(session)
    return session
}

export const pkHex = async (pin: string, host: string = '', userId: string = '', expire: number = 0, sessionId: string = '') => {
    const address = await getAddressByPin(pin)
    if (!address) {
        throw new PinError()
    }
    const pk = await getPrivateKey(pin)
    const k = CryptoJS.SHA256(`sealx-export-v1:${sessionId}:${host}:${userId}:${expire}`).toString(CryptoJS.enc.Hex)
    const pkObj = pk ? (await encodePrivateKey(address, pk, k)) : null
    const pkHexStr = pkObj ? strToHex(JSON.stringify(pkObj)) : ''
    return pkHexStr
}


/**
 * Creates a database wrapper instance for the user table
 * @returns Database wrapper configured for the 'user' table
 */
export const userTable = () => dbStorageWrapper('sealx', 'user')

/**
 * Adds or updates a user record in the database
 * @param userId - Unique user identifier
 * @param host - Domain host associated with the user
 * @returns Promise resolving to the created/updated SealxAccount
 */
export const addUser = async (userId: string, host: string, user?: SealxAccount) => {
    const key = CryptoJS.MD5(`${host}:${userId}`).toString()
    const db = userTable()
    try {
        let record = await db.getItem<SealxAccount>(key)
        if (!record) {
            record = {
                id: key,
                host,
                userId: userId || '',
                email: '',
                userName: '',
                pk: ''
            } as SealxAccount
            if (user) {
                if (user.pk) record.pk = user.pk
            }
            await db.setItem(key, record)
        }
        return record
    } finally {
        db.close()
    }
}

/**
 * Retrieves a user record from the database
 * @param userId - Unique user identifier
 * @param host - Domain host associated with the user
 * @returns Promise resolving to SealxAccount or undefined if not found
 */
export const getUser = async (userId: string, host: string) => {
    const key = CryptoJS.MD5(`${host}:${userId}`).toString()
    const db = userTable()
    try {
        const record = await db.getItem<SealxAccount>(key)
        return record
    } finally {
        db.close()
    }
}

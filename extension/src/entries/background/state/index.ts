import { dbStorageWrapper, type SealxAccount, type SealxSession } from "sealx-core";
import type { PrivateKeyStoreRecord, SealxBaseInfo } from "../models";
import { createWallet } from "../utils/wallet";
import { decodeEncryptedPrivateKey, encodePrivateKey, strToHex } from "../utils/crypto";
import CryptoJS from "crypto-js";
import { sessionKey } from "@src/core/utils/helper";
import PinError from "../../../../../packages/sealx-core/src/exceptions/PinError";
import { sessionStore } from "@src/core/state/session";
import { syncStores } from "@src/core/state/internal/syncStores";
syncStores()

const privateKeyTable = () => dbStorageWrapper('sealx', 'sealx-pk');

/**
 * Initializes SealX by creating a new wallet and encrypting its private key
 * @param pin - User's PIN for encryption
 * @returns Promise resolving to the stored record
 */
export const initializeSealx = async (pin: string, privateKey: string = ''): Promise<PrivateKeyStoreRecord> => {
    const db = privateKeyTable()
    const pin1 = CryptoJS.SHA256(pin).toString(CryptoJS.enc.Hex)
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
        await db.clear()
        await db.setItem(pin1, storeRecord);
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
            await privateKeyTable().clear()
            const pin1 = CryptoJS.SHA256(pin).toString(CryptoJS.enc.Hex)
            const storeRecord = await encodePrivateKey(address, privateKey, pin)
            return await db.setItem(pin1, storeRecord);
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
    // Validate inputs
    if (!pin) {
        throw new Error('Invalid parameters');
    }

    const result = await getSealxPkRecord(pin);
    if (!result) return null;

    // Verify required fields exist
    if (!result.encrypted || !result.iv || !result.slat) {
        throw new Error('Invalid stored key data');
    }

    // Additional validation - check if private key is valid
    try {
        return decodeEncryptedPrivateKey(result, pin, result.address)
    } catch (walletError) {
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
    const result = await getSealxPkRecord(pin)
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
        const info = {
            version,
            installedTime: Date.now(),
            address: '',
            sessionTimeout: time ?? 5
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
 * - Creates a new database or upgrades existing one to version 1
 * - Creates all specified tables if they don't exist
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
            resolve(true)
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
    // // 存在风险问题，要上代码分析得到这里的信息，可能获得密钥
    const k = CryptoJS.MD5(sessionId + host + userId + expire).toString()
    const pkObj = pk ? (await encodePrivateKey(address, pk, k)) : null
    const pkHex = pkObj ? strToHex(JSON.stringify(pkObj)) : ''
    const info = await getSealxInfo()
    const pkHash = CryptoJS.MD5(pkHex).toString()
    if (info) {
        info.pks = info.pks ? { ...info.pks } : {}
        info.pks[pkHash] = pkHex
        const res = await saveSealxInfo(info)
        if (!res) {
            throw new Error('save sealx info failed')
        }
    }

    const session: SealxSession = {
        address,
        expire,
        host,
        userId,
        sessionId,
        pk: pkHash
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
    // 存在风险问题，要上代码分析得到这里的信息，可能获得密钥
    const k = CryptoJS.MD5(sessionId + host + userId + expire).toString()
    const pkObj = pk ? (await encodePrivateKey(address, pk, k)) : null
    const pkHex = pkObj ? strToHex(JSON.stringify(pkObj)) : ''
    return pkHex
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

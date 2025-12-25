import { decryptPrivateKey, encryptPrivateKey, slatGenerator, type Eip712Struct } from "sealx-core";
import type { PrivateKey, PrivateKeyStoreRecord } from "../models";
import CryptoJS from "crypto-js";
import { createWallet } from "./wallet";

/**
 * Encodes and encrypts a private key using a two-layer encryption scheme for secure storage.
 * 
 * Layer 1: Encrypts the private key with keys derived from PIN + salt + nonce
 * Layer 2: Encrypts the entire record with PIN + address-specific salt
 * 
 * @param address - The wallet address associated with this private key
 * @param privateKey - The raw private key to encrypt
 * @param pin - User's PIN used for encryption
 * @returns Encrypted storage record containing:
 *   - Double-encrypted private key
 *   - Initialization vectors
 *   - Salts for key derivation
 */
export const encodePrivateKey = async (address: string, privateKey: string, pin: string) => {
    // First layer encryption - uses time-based nonce and random salt
    const nonce = Date.now().toString(); // Time-based nonce for uniqueness
    const salt = slatGenerator(); // Random salt for key derivation
    // Derive two encryption keys from PIN+salt+nonce combinations
    const s1 = CryptoJS.SHA256(`${pin},${salt},${nonce}`).toString(CryptoJS.enc.Hex);
    const s2 = CryptoJS.SHA256(`${pin},${nonce},${salt}`).toString(CryptoJS.enc.Hex);

    // Encrypt private key with derived keys
    const encrypted = await encryptPrivateKey(privateKey, s1, s2);

    // Create intermediate record containing first layer encrypted data
    const record: PrivateKey = {
        privateKey: encrypted.encrypted, // First layer encrypted private key
        iv: encrypted.iv,               // Initialization vector for first layer
        nonce,                          // Time-based nonce
        salt                          // Random salt used in key derivation
    };

    // Second layer encryption - encrypts the entire record
    const salt1 = slatGenerator(); // New salt for second layer
    // Encrypt record with PIN and address-specific derived key
    const encryptedRecord = await encryptPrivateKey(
        JSON.stringify(record),
        pin, // Main encryption key
        CryptoJS.SHA256(pin + salt1 + address).toString(CryptoJS.enc.Hex) // Additional key
    );

    // Create final storage record with double-encrypted data
    const storeRecord: PrivateKeyStoreRecord = {
        id: pin,
        address: address,                    // Wallet address as record ID
        encrypted: encryptedRecord.encrypted, // Double-encrypted private key
        iv: encryptedRecord.iv,         // IV for second layer encryption
        slat: salt1                     // Salt for second layer key derivation
    };
    return storeRecord
}

/**
 * Decrypts a double-encrypted private key from storage.
 * 
 * Performs two decryption steps:
 * 1. Decrypts the outer layer using PIN + address-specific salt
 * 2. Decrypts the inner private key using PIN + original salts/nonce
 * 
 * @param record - The encrypted storage record
 * @param pin - User's PIN used for decryption
 * @param address - Wallet address for key derivation
 * @returns Decrypted private key
 * @throws Error if decryption or validation fails at any step
 */
export const decodeEncryptedPrivateKey = async (record: PrivateKeyStoreRecord, pin: string, address: string) => {

    // First decryption layer - decrypt the outer encrypted record
    const decryptionKey = CryptoJS.SHA256(pin + record.slat + address).toString(CryptoJS.enc.Hex);
    const decrypted = await decryptPrivateKey(
        pin,                    // Primary decryption key
        record.encrypted,       // Double-encrypted data
        record.iv,              // IV for second layer
        decryptionKey           // Address-specific derived key
    );

    // Parse the intermediate record from JSON
    let keyData: PrivateKey;
    try {
        keyData = JSON.parse(decrypted);
    } catch (parseError) {
        throw new Error(`Failed to parse decrypted data: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }

    // Validate the intermediate record structure
    if (!keyData?.privateKey || !keyData.iv || !keyData.salt || !keyData.nonce) {
        throw new Error('Invalid key data structure - missing required fields');
    }

    // Second decryption layer - decrypt the actual private key
    // Recreate the original derived keys using stored salt/nonce
    const s1 = CryptoJS.SHA256(`${pin},${keyData.salt},${keyData.nonce}`).toString(CryptoJS.enc.Hex);
    const s2 = CryptoJS.SHA256(`${pin},${keyData.nonce},${keyData.salt}`).toString(CryptoJS.enc.Hex);

    // Decrypt the private key using original encryption parameters
    const decryptedPrivateKey = await decryptPrivateKey(
        s1,                 // First derived key
        keyData.privateKey, // First layer encrypted private key
        keyData.iv,          // IV from first layer encryption
        s2                 // Second derived key
    );

    return decryptedPrivateKey;
}

/**
 * Signs EIP-712 typed data using the provided private key.
 * 
 * Processes the domain and message fields, removes EIP712Domain from types,
 * and generates a signature using the wallet's signTypedData method.
 * 
 * @param signContent - The EIP-712 structured data to sign, containing:
 *   - domain: The domain separator fields (name, version, chainId, etc.)
 *   - types: Type definitions for the message
 *   - message: The actual message content to sign
 * @param privateKey - The private key used for signing
 * @returns An object containing:
 *   - signature: The generated ECDSA signature
 *   - address: The address derived from the private key
 * @throws Does not throw but logs errors to console
 */
export const signTypeContent = async (signContent: Eip712Struct, privateKey: string) => {
    const wallet = createWallet(privateKey)

    const address = wallet.address
    const types = signContent.types
    delete types['EIP712Domain']
    try {
        const domain: Record<string, unknown> = {}
        const keys = Object.keys(signContent.domain) as Array<keyof typeof signContent.domain>
        const message: Record<string, unknown> = signContent.message
        keys.forEach((k) => {
            const value = signContent.domain[k]
            if (value !== null && value !== '') {
                domain[k] = value
            }
        })
        const signature = await wallet.signTypedData(domain, types, message)
        return {
            signature,
            address
        }
    } catch (e) {
        console.error(e)
    }
}

export const strToHex = (str: string) => {
    return str ? CryptoJS.enc.Hex.stringify(CryptoJS.enc.Utf8.parse(str)) : ''
}

/**
 * Converts a hex string back to its original UTF-8 string representation
 * @param hex - The hex string to convert
 * @returns The original UTF-8 string or empty string if input is falsy
 */
export const hexToStr = (hex: string) => {
    return hex ? CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Hex.parse(hex)) : ''
}

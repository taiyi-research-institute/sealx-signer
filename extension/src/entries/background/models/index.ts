/**
 * Represents an encrypted private key with its encryption parameters.
 * Used as an intermediate structure in the two-layer encryption process.
 * 
 * @property privateKey - The encrypted private key (hex string)
 * @property iv - Initialization vector used for AES encryption (hex string)
 * @property salt - Random salt used in key derivation (hex string)
 * @property nonce - Time-based unique value used in key derivation
 */
export interface PrivateKey {
    privateKey: string;
    iv: string;
    salt: string;
    nonce: string;
}

/**
 * Represents the final stored record of an encrypted private key.
 * Contains the double-encrypted data and all required decryption parameters.
 * 
 * @property id - Wallet address serving as unique identifier (hex string)
 * @property encrypted - Double-encrypted private key data (hex string)
 * @property iv - Initialization vector for outer encryption layer (hex string)
 * @property slat - Salt used in address-specific key derivation (hex string)
 * 
 * @note The 'slat' property name is intentionally spelled this way for backward compatibility
 */
export interface PrivateKeyStoreRecord {
    id: string;
    encrypted: string;
    iv: string;
    slat: string
    address: string
}


/**
 * Basic information about the SealX extension installation.
 * Used for tracking and version management.
 * 
 * @property version - Current extension version (semver string)
 * @property address - Default wallet address associated with this installation
 * @property installedTime - Unix timestamp of when extension was first installed
 */
export type SealxBaseInfo = {
    version: string;
    address: string;
    pks?: Record<string, string>
    updateTime: number
    installedTime: number;
    sessionTimeout?: number
};

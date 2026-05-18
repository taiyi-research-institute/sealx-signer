import { SignContent } from "../eip712";

export interface SealxSession {
    /**
     * Unique identifier for the session.
     */
    sessionId: string;

    /**
     * Optional user identifier from authentication system.
     * Used when session needs to be associated with a specific user account.
     * Example: "auth0|123456"
     */
    userId?: string;

    /**
     * Address associated with the session.
     */
    address: string;

    /**
     * Expiration time of the session in milliseconds since epoch.
     */
    expire: number;

    host?: string;

    /**
     * Runtime authorization capability associated with this session.
     * This is metadata only and must not contain private key material.
     */
    capabilityId?: string;

    /**
     * Cryptographic public key associated with the session.
     * Used for signing operations when no account is specified.
     * Can be any key format supported by the implementation.
     */
    pk?: any;

    pkKdf?: 'sha256-v1' | 'md5-legacy';
}

/**
 * Represents a SealX account with all required user information
 */
export interface SealxAccount {
    /**
     * Unique database identifier for the account record
     */
    id?: string;

    /** 
     * Unique user identifier from authentication system
     */
    userId?: string | number;

    /**
     * User's email address for communication
     */
    email?: string;

    /**
     * Display name for the user account
     */
    userName?: string;

    /**
     * Public key associated with the SealX address
     * Used for cryptographic operations and verification
     */
    pk?: string;

    newPk?: string
}


/**
 * Represents a signing task to be processed by SealX.
 * Contains all information needed to generate and validate a signature.
 */
export interface SealxSignTask {
    /**
     * Unique identifier for the signing task.
     * Used to track task status and results.
     * Example: "task_xyz789"
     */
    taskId: string;

    /**
     * Type/category of the signing task.
     * Determines how the content should be processed.
     * Example: "eip712" or "raw"
     */
    taskType: string;

    /**
     * The signing command/operation to perform.
     * Example: "signPersonal" or "signTypedData"
     */
    command: string;


    /**
     * The content to be signed, formatted according to taskType.
     */
    signContent: SignContent | { taskId: string, signContent: SignContent }[];

    /**
     * Time unit for signature validity period.
     * Example: "seconds", "minutes", or "hours"
     */
    validUntilTime: string;
    /** Optional: Third-party provided task preview page */
    preViewUrl?: string

    /**(Optional) Additional external data or context for the task, provided as a key-value map. */
    extenals?: Record<string, unknown>
}

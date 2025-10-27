import { StorageLike } from "../storage/storage";
import type { SealxSession, SealxAccount } from "./sealx-interface";
export interface AutoCheckSealxCallback {
    (signer: SealxSigner): Promise<boolean>;
}
/**
 * The SealxSigner class provides functionality for managing the Sealx plugin state,
 * including installation, connection management, and signing operations.
 *
 * Key Features:
 * - Tracks plugin installation state
 * - Manages plugin open/close state via DOM attributes
 * - Handles session connections for signing operations
 * - Provides cryptographic signing capabilities
 */
export declare class SealxSigner {
    id: string;
    /** Whether the plugin has been installed */
    installed: boolean;
    /** Whether the plugin UI is currently active */
    active: boolean;
    /** Whether a session is currently connected */
    connected: boolean;
    /** Current active session, if connected */
    session: SealxSession | null;
    /** Current account information, if available */
    account: SealxAccount | null;
    autoConnectCallback: (() => void) | null;
    autoClearTimer: any;
    /** Storage wrapper for persisting plugin state */
    storageWrapper: StorageLike;
    constructor();
    initializeAccount(account: SealxAccount): Promise<void>;
    initializeSession(session: SealxSession): Promise<void>;
    setAutoClearTimer(): void;
    /**
     * Synchronizes the plugin's active state with the DOM attribute.
     * Called by the MutationObserver when the data-sealx-signer-active attribute changes.
     */
    activeStateInitialize(): void;
    /**
     * Initializes the plugin state:
     * - Loads installation status from storage
     * - Sets up MutationObserver to track plugin active state changes
     * - Initializes current active state
     */
    initialize(): Promise<void>;
    /**
     * Marks the plugin as installed and persists this state.
     * Can only be called once - subsequent calls will warn.
     */
    install(): void;
    /**
     * Activates the plugin UI by setting the DOM attribute.
     * Updates internal state and logs the operation.
     */
    activate(): void;
    /**
     * Deactivates the plugin UI by clearing the DOM attribute.
     * Updates internal state and logs the operation.
     */
    deactivate(): void;
    autoCheckTimer: any;
    autoCheck(checker: AutoCheckSealxCallback): Promise<void>;
}

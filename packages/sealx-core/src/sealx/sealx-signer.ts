import { now } from "lodash";
import { localStorageWrapper } from "../storage";
import { StorageLike } from "../storage/storage";
import type { SealxSession, SealxAccount } from "./sealx-interface";

export interface AutoCheckSealxCallback {
    (signer: SealxSigner): Promise<boolean>
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
export class SealxSigner {
    id: string = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    /** Whether the plugin has been installed */
    installed: boolean = false;

    /** Whether the plugin UI is currently active */
    active: boolean = false;

    /** Whether a session is currently connected */
    connected: boolean = false;

    /** Current active session, if connected */
    session: SealxSession | null = null;

    /** Current account information, if available */
    account: SealxAccount | null = null;

    autoConnectCallback: (() => void) | null = null

    autoClearTimer: any = null

    /** Storage wrapper for persisting plugin state */
    storageWrapper: StorageLike = localStorageWrapper('sealx', 'state');


    constructor() {
        /**
         * Initializes a new SealxSigner instance.
         * Automatically calls initialize() to set up the plugin state.
         */
        console.log("SealxSigner initialized");
        this.initialize();
    }

    async initializeAccount(account: SealxAccount) {
        /**
         * Initializes the account information.
         * @param userId - Unique identifier for the user
         * @param userName - Name of the user
         * @param email - Email address of the user
         */
        this.account = account;
        await this.storageWrapper.setItem('account', account)
        console.log("SealxSigner account initialized:", this.account);
    }

    async initializeSession(session: SealxSession) {
        this.session = session
        await this.storageWrapper.setItem('session', session)
        this.setAutoClearTimer()
    }

    setAutoClearTimer() {
        if (this.autoClearTimer) {
            clearTimeout(this.autoClearTimer)
            this.autoClearTimer = null
        }
        if (this.session) {
            const timeUntilExpire = this.session.expire - Date.now()
            // Only set timer if session is not already expired
            if (timeUntilExpire > 0) {
                this.autoClearTimer = setTimeout(() => {
                    if (this.autoConnectCallback)
                        this.autoConnectCallback()
                    this.session = null
                    // this.storageWrapper.removeItem('account')
                    this.storageWrapper.removeItem('session')
                    this.autoClearTimer = null
                }, timeUntilExpire)
            }
        }
    }
    /**
     * Synchronizes the plugin's active state with the DOM attribute.
     * Called by the MutationObserver when the data-sealx-signer-active attribute changes.
     */
    activeStateInitialize() {
        const isActive = document.body.getAttribute('data-sealx-signer-active') === 'true';
        if (isActive && !this.active) {
            this.active = true;
            console.log("SealxSigner plugin activated via mutation observer");
        } else if (!isActive && this.active) {
            this.active = false;
            console.log("SealxSigner plugin closed via mutation observer");
        }
    }
    /**
     * Initializes the plugin state:
     * - Loads installation status from storage
     * - Sets up MutationObserver to track plugin active state changes
     * - Initializes current active state
     */
    async initialize(): Promise<void> {
        // Load installation status from persistent storage
        this.installed = await this.storageWrapper.getItem('installed') || false;
        this.account = await this.storageWrapper.getItem('account')
        this.session = await this.storageWrapper.getItem('session')

        this.setAutoClearTimer()
        // Set up observer for DOM attribute changes
        const observe = new MutationObserver(() => {
            // this.activeStateInitialize();
        });
        observe.observe(document.body, {
            attributes: true,
            attributeFilter: ['data-sealx-signer-active']
        });

        // Initialize current state
        // this.activeStateInitialize();
    }
    /**
     * Marks the plugin as installed and persists this state.
     * Can only be called once - subsequent calls will warn.
     */
    install(): void {
        if (this.installed) return;

        this.installed = true;
        this.storageWrapper.setItem('installed', true);
        console.log("SealxSigner installed");
    }

    /**
     * Activates the plugin UI by setting the DOM attribute.
     * Updates internal state and logs the operation.
     */
    activate(): void {
        if (!this.active) {
            this.active = true;
            document.body.setAttribute('data-sealx-signer-active', 'true');
            console.log("SealxSigner plugin activated");
        } else {
            //console.warn("SealxSigner plugin is already activated.");
        }
    }

    /**
     * Deactivates the plugin UI by clearing the DOM attribute.
     * Updates internal state and logs the operation.
     */
    deactivate(): void {
        const wasActive = this.active;

        this.active = false;
        this.session = null
        this.storageWrapper.removeItem('session')
        if (document.body.getAttribute('data-sealx-signer-active') !== 'false') {
            document.body.setAttribute('data-sealx-signer-active', 'false');
        }

        if (wasActive) {
            console.log("SealxSigner plugin deactivated");
        }
    }
    autoCheckTimer: any

    async autoCheck(checker: AutoCheckSealxCallback): Promise<void> {
        if (this.autoCheckTimer) {
            clearInterval(this.autoCheckTimer)
        }
        this.autoCheckTimer = setInterval(async () => {
            const res = await checker(this)
            if (res) {
                this.active = true
                if (!this.session?.userId) {
                    this.session = null
                    this.storageWrapper.removeItem('session')
                }
            } else {
                this.active = false
                this.session = null
                this.storageWrapper.removeItem('session')
            }
        }, 30000);
    }
}

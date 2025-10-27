import MessagerBase from "./messager";
import { SealxRequest } from "../contracts";
/**
 * BackgroundMessager handles message communication for browser extension background scripts.
 *
 * This class extends MessagerBase to provide browser extension-specific message handling:
 * - Communication between background script and content scripts
 * - Tab-specific message routing
 * - Browser extension API integration
 *
 * @remarks
 * Uses webextension-polyfill for cross-browser compatibility.
 * Manages tab-specific messaging through TabManager.
 */
export default class BackgroundMessager extends MessagerBase {
    /** Manages tab information for message routing */
    private tabManager;
    /**
     * Creates a new ExtensionMessager instance
     * @remarks
     * Initializes with BACKGROUND channel and gets TabManager instance
     */
    constructor();
    /**
     * Gets the current active tab ID
     * @returns Current tab ID or undefined if no active tab
     */
    get tabId(): number | undefined;
    get host(): string;
    /**
     * Sets up message listener for incoming messages
     * @remarks
     * Forwards valid messages to receiveMessage handler
     */
    onMessage(): void;
    /**
     * Sends a message to the appropriate recipient
     * @param message - The message to send
     * @remarks
     * Handles two message types:
     * 1. Runtime messages (no tab ID)
     * 2. Tab-specific messages (with tab ID)
     *
     * Automatically adds tab ID for content script messages if missing
     */
    postMessage(message: SealxRequest): void;
    /**
     * Adds a message listener
     * @param callback - Function to call when message is received
     */
    addListener(callback: (event: any, sender?: chrome.runtime.MessageSender) => any): void;
    /**
     * Removes a message listener
     * @param callback - Function to remove from listeners
     */
    removeListener(callback: (event: any) => any): void;
}

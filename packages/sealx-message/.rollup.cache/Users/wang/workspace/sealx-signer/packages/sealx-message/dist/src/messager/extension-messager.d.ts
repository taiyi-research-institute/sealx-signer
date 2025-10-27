import MessagerBase from "./messager";
import { MessageChannel } from "../enums";
import { SealxRequest } from "../contracts";
/**
 * ExtensionMessager handles message communication for browser extension UI components
 *
 * This class extends MessagerBase to provide browser extension-specific message handling:
 * - Communication between popup/options/sidebar and background/content scripts
 * - Tab-specific message routing
 * - Browser extension API integration
 *
 * @remarks
 * Uses webextension-polyfill for cross-browser compatibility.
 * Manages tab-specific messaging through TabManager.
 */
export default class ExtensionMessager extends MessagerBase {
    /** Manages tab information for message routing */
    private tabManager;
    /**
     * Creates a new ExtensionMessager instance
     * @param channel - The message channel type (POPUP, OPTIONS, SIDEBAR or EXTENSION)
     */
    constructor(channel: MessageChannel.POPUP | MessageChannel.OPTIONS | MessageChannel.SIDEBAR | MessageChannel.EXTENSION);
    /**
     * Gets the current active tab ID
     * @returns Current tab ID or undefined if no active tab
     */
    get tabId(): number | undefined;
    /**
     * Sets up message listener for incoming messages
     * @remarks
     * Only processes messages specifically addressed to this channel
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

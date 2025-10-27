import { TabManager } from "sealx-core";
import MessagerBase from "./messager";
// import browser from "webextension-polyfill";
import { MessageChannel } from "../enums";
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
    /**
     * Creates a new ExtensionMessager instance
     * @param channel - The message channel type (POPUP, OPTIONS, SIDEBAR or EXTENSION)
     */
    constructor(channel) {
        super(channel);
        this.tabManager = TabManager.getInstance();
    }
    /**
     * Gets the current active tab ID
     * @returns Current tab ID or undefined if no active tab
     */
    get tabId() {
        return this.tabManager.currentTabId;
    }
    /**
     * Sets up message listener for incoming messages
     * @remarks
     * Only processes messages specifically addressed to this channel
     */
    onMessage() {
        this.addListener(async (event) => {
            const message = event;
            if (message && message.header) {
                if (message.header.messagerId === this.id) {
                    return;
                }
                if (message.receiver === this.channel) {
                    const response = await this.receiveMessage(message);
                    const f = response.filter(r => r !== undefined);
                    const t = f.length > 0 ? f.pop() : undefined;
                    if (!('responseId' in message) && !message.reply)
                        this.reply(t, message);
                }
            }
        });
    }
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
    postMessage(message) {
        // Add tab ID for content script messages if not provided
        const contentScriptChannels = [
            MessageChannel.CONTENT,
            MessageChannel.INPAGE,
            MessageChannel.IFRAME
        ];
        message.header.messagerId = this.id;
        if (contentScriptChannels.includes(message.receiver)) {
            if (!message.header.tabId && this.tabId) {
                message.header.tabId = this.tabId;
            }
        }
        // Send message to appropriate destination
        if (!message.header.tabId) {
            chrome.runtime?.sendMessage(message);
        }
        else {
            chrome.tabs?.sendMessage(message.header.tabId, message);
        }
    }
    /**
     * Adds a message listener
     * @param callback - Function to call when message is received
     */
    addListener(callback) {
        chrome.runtime?.onMessage.addListener(callback);
    }
    /**
     * Removes a message listener
     * @param callback - Function to remove from listeners
     */
    removeListener(callback) {
        chrome.runtime?.onMessage.removeListener(callback);
    }
}
//# sourceMappingURL=extension-messager.js.map
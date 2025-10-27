
import { TabManager } from "sealx-core";
import MessagerBase from "./messager";
// import browser from "webextension-polyfill";
import { MessageChannel } from "../enums";
import { SealxRequest } from "../contracts";
import { SealxResponse } from "../contracts/response";

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
    private tabManager: TabManager;

    /**
     * Creates a new ExtensionMessager instance
     * @remarks
     * Initializes with BACKGROUND channel and gets TabManager instance
     */
    constructor() {
        super(MessageChannel.BACKGROUND);
        this.tabManager = TabManager.getInstance();
    }

    /**
     * Gets the current active tab ID
     * @returns Current tab ID or undefined if no active tab
     */
    get tabId(): number | undefined {
        return this.tabManager.currentTabId;
    }

    get host(): string {
        return MessageChannel.BACKGROUND
    }

    /**
     * Sets up message listener for incoming messages
     * @remarks
     * Forwards valid messages to receiveMessage handler
     */
    onMessage(): void {
        this.addListener(async (event: any, sender?: chrome.runtime.MessageSender) => {
            const message: SealxRequest = event;
            if (message && message.header) {
                if (sender?.tab) message.header.tabId = sender.tab.id
                if (message.header.messagerId === this.id) {
                    return
                }

                if (this.channel !== message.receiver && message.sender !== this.channel && message.receiver !== MessageChannel.ALL) {
                    // Forward messages to other channels when bridge is available
                    message.header.messagerId = this.id
                    await this.forwardHandlers[message.receiver]?.(message)
                    this.postMessage(message)
                } else {
                    const response = await this.receiveMessage(message);
                    const f = response.filter(r => r !== undefined)
                    const t = f.length > 0 ? f.pop() : undefined
                    if (!('responseId' in message) && !message.reply) this.reply(t, message)
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
    postMessage(message: SealxRequest): void {
        message.header.messagerId = this.id
        // Add tab ID for content script messages if not provided
        if ([MessageChannel.CONTENT, MessageChannel.INPAGE, MessageChannel.IFRAME].includes(message.receiver)) {
            if (!message.header.tabId && this.tabId) {
                message.header.tabId = this.tabId;
            }
        }
        message.header.messagerId = this.id;
        // Send message to appropriate destination
        if (message.receiver === MessageChannel.EXTENSION
            || message.receiver === MessageChannel.POPUP
            || message.receiver === MessageChannel.OPTIONS
            || message.receiver === MessageChannel.SIDEBAR
            || !message.header.tabId) {
            console.log('--------- send messager from backgroud by chrome.runtime.sendMessage', message)
            chrome.runtime?.sendMessage(message);
        } else {
            console.log('---------- send messager from background by chrome.tabs.sendMessage ------', message)
            chrome.tabs?.sendMessage(message.header.tabId, message);
        }
    }

    /**
     * Adds a message listener
     * @param callback - Function to call when message is received
     */
    addListener(callback: (event: any, sender?: chrome.runtime.MessageSender) => any): void {
        chrome.runtime?.onMessage.addListener(callback);
    }

    /**
     * Removes a message listener  
     * @param callback - Function to remove from listeners
     */
    removeListener(callback: (event: any) => any): void {
        chrome.runtime?.onMessage.removeListener(callback);
    }
}

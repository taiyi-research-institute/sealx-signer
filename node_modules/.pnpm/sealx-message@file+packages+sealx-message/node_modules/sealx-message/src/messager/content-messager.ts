// import { TabManager } from "sealx-core";
import MessagerBase from "./messager";
// import browser from "webextension-polyfill";
import { SealxRequest } from "../contracts";
import { MessageChannel } from "../enums";
import { SealxResponse } from "../contracts/response";

/**
 * Handles message communication for content scripts in browser extensions.
 * Manages message passing between:
 * - Content scripts and background pages
 * - Content scripts and iframes
 * - Content scripts and inpage scripts
 */
export default class ContentMessager extends MessagerBase {
    /**
     * Flag indicating whether messages should be forwarded to other channels
     */
    forwardMessage: MessageChannel | MessageChannel[] | null = null;


    constructor() {
        super(MessageChannel.CONTENT)
    }


    /**
     * Enables message forwarding capability
     */
    setMessageBridgeAvailable(forward: MessageChannel | MessageChannel[] | null = MessageChannel.ALL) {
        this.forwardMessage = forward
    }
    /**
     * Sets up message listeners for:
     * - Window messages (from iframes/pages)
     * - Runtime messages (from background/other content scripts)
     * Handles message filtering and forwarding logic
     */
    onMessage(): void {
        this.addListener(async (event: any, sender?: chrome.runtime.MessageSender) => {

            let message: SealxRequest | null = null
            if (event instanceof MessageEvent) {
                message = event.data
            } else {
                message = event
                if (message && message.header && sender?.tab)
                    message.header.tabId = sender.tab.id
            }
            if (message && message.header) {
                // Skip messages sent by this messager to prevent loops
                if (message.header.messagerId === this.id) {
                    return
                }
                console.log(JSON.stringify(message), '---------- on message ----------')
                if (this.channel !== message.receiver && message.sender !== this.channel) {
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
        })
    }

    /**
     * Gets all iframe windows in the current document
     * @returns NodeList of all iframe elements
     */
    get iframeWindows() {
        const iframes = document.querySelectorAll('iframe');
        return iframes;
    }
    /**
     * Posts a message to the appropriate receiver:
     * - inpage: Uses postMessage API with targetOrigin '*'
     * - Background: Uses browser.runtime.sendMessage
     * @param message The message to send
     */
    postMessage(message: SealxRequest): void {
        message.header.messagerId = this.id
        if (message.receiver === MessageChannel.INPAGE || message.receiver === MessageChannel.IFRAME) {
            window.postMessage(message, '*')
            if (this.iframeWindows) {
                this.iframeWindows.forEach((iframe) => {
                    // Note: Using '*' targetOrigin allows any iframe to receive the message
                    // Optional chaining (?.) safely handles cases where contentWindow is null
                    iframe.contentWindow?.postMessage(message, '*');
                })
            }
        } else {
            try {
                const runtime = chrome.runtime
                if (runtime) runtime.sendMessage(message)
            } catch (e) {
                console.error('postMessage error:', e)
                this.replyError(e, message)
            }
        }
    }

    /**
     * Adds message listeners for:
     * - Window messages (from iframes/pages)
     * - Runtime messages (from background/other content scripts)
     * @param callback Function to handle incoming messages
     */
    addListener(callback: (event: any, sender?: chrome.runtime.MessageSender) => any): void {
        const runtime = chrome.runtime
        // Listen for messages from window (iframes/pages)
        window.addEventListener('message', callback)
        // Listen for messages from extension runtime (background/other content scripts)
        if (runtime) runtime.onMessage.addListener(callback);
    }

    /**
     * Removes previously added message listeners
     * @param callback The callback function to remove
     */
    removeListener(callback: (event: any, sender?: chrome.runtime.MessageSender) => any): void {
        const runtime = chrome.runtime
        window.removeEventListener('message', callback)
        if (runtime) runtime.onMessage.removeListener(callback);
    }
}

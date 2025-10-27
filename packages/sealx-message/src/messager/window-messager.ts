import { isNativeFullscreen, isViewportFullscreenBySize } from "sealx-core";
import { SealxRequest } from "../contracts";
import { SealxResponse } from "../contracts/response";
import { MessageChannel } from "../enums";
import MessagerBase from "./messager";

/**
 * WindowMessager handles message communication between windows and iframes
 * 
 * This class extends MessagerBase to provide window.postMessage-based communication:
 * - Communication between parent window and iframes
 * - Cross-origin messaging support
 * - Automatic message routing between frames
 * 
 * @remarks
 * Uses window.postMessage API for cross-frame communication.
 * Supports both same-origin and cross-origin iframe communication.
 */
export default class WindowMessager extends MessagerBase {
    /**
     * Creates a new WindowMessager instance
     */
    constructor() {
        super(MessageChannel.INPAGE);
        if (this.isInIframeSafe) {
            this.channel = MessageChannel.IFRAME
            this.id = `messager-${this.channel}-${Date.now()}-${(Math.random() * 1000).toFixed(0)}`;
        }
    }

    get fullscreen() {
        return isNativeFullscreen() || isViewportFullscreenBySize()
    }

    get header() {
        const h = super.header
        h.fullscreen = this.fullscreen
        return h
    }
    /**
     * Sets up message listener for incoming messages
     * @remarks
     * Forwards valid messages to receiveMessage handler
     */
    onMessage(): void {
        this.addListener(async (event: MessageEvent<SealxRequest>) => {
            const message = event.data
            if (message && message.header) {
                if (message.header.messagerId === this.id) {
                    return
                }
                if (message?.receiver === this.channel) {
                    const response = await this.receiveMessage(message);
                    const f = response.filter(r => r !== undefined)
                    const t = f.length > 0 ? f.pop() : undefined
                    if (!('responseId' in message) && !message.reply) this.reply(t, message)
                }
            }
        });
    }

    /**
     * Gets the window object used for messaging
     * @returns The window object acting as the messaging endpoint
     */
    private get messagerInstance(): Window {
        return window;
    }

    /**
     * Checks if the current context is safely within an iframe
     * @returns True if in an iframe (including cross-origin), false otherwise
     * @remarks
     * Handles cross-origin iframe cases where direct window comparison would throw errors
     */
    private get isInIframeSafe(): boolean {
        try {
            return window.self !== window.top;
        } catch (e) {
            return true; // Exception indicates cross-origin iframe
        }
    }

    /**
     * Sends a message to the appropriate window targets
     * @param message - The message to send
     * @remarks
     * Handles two scenarios:
     * 1. Sends to current window context (for same-window listeners)
     * 2. If in iframe, also sends to parent window
     */
    postMessage(message: SealxRequest): void {
        // Send to current window context
        this.messagerInstance.postMessage(message, '*');
        message.header.messagerId = this.id
        // If in iframe, also send to parent window
        if (this.isInIframeSafe) {
            this.messagerInstance.parent.postMessage(message, '*');
        }
    }

    /**
     * Adds a message event listener
     * @param callback - Function to call when message is received
     */
    addListener(callback: (event: MessageEvent<SealxRequest>) => void): void {
        this.messagerInstance.addEventListener('message', callback);
    }

    /**
     * Removes a message event listener
     * @param callback - Function to remove from listeners
     */
    removeListener(callback: (event: MessageEvent<SealxRequest>) => void): void {
        this.messagerInstance.removeEventListener('message', callback);
    }
}

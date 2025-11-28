import { SealxRequest } from "../contracts";
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
    constructor();
    get fullscreen(): boolean;
    get header(): import("..").SealxHeader;
    /**
     * Sets up message listener for incoming messages
     * @remarks
     * Forwards valid messages to receiveMessage handler
     */
    onMessage(): void;
    /**
     * Gets the window object used for messaging
     * @returns The window object acting as the messaging endpoint
     */
    private get messagerInstance();
    /**
     * Checks if the current context is safely within an iframe
     * @returns True if in an iframe (including cross-origin), false otherwise
     * @remarks
     * Handles cross-origin iframe cases where direct window comparison would throw errors
     */
    private get isInIframeSafe();
    /**
     * Sends a message to the appropriate window targets
     * @param message - The message to send
     * @remarks
     * Handles two scenarios:
     * 1. Sends to current window context (for same-window listeners)
     * 2. If in iframe, also sends to parent window
     */
    postMessage(message: SealxRequest): void;
    /**
     * Adds a message event listener
     * @param callback - Function to call when message is received
     */
    addListener(callback: (event: MessageEvent<SealxRequest>) => void): void;
    /**
     * Removes a message event listener
     * @param callback - Function to remove from listeners
     */
    removeListener(callback: (event: MessageEvent<SealxRequest>) => void): void;
}

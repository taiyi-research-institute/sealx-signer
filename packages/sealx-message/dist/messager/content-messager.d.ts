import MessagerBase from "./messager";
import { SealxRequest } from "../contracts";
import { MessageChannel } from "../enums";
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
    forwardMessage: MessageChannel | MessageChannel[] | null;
    constructor();
    /**
     * Enables message forwarding capability
     */
    setMessageBridgeAvailable(forward?: MessageChannel | MessageChannel[] | null): void;
    /**
     * Sets up message listeners for:
     * - Window messages (from iframes/pages)
     * - Runtime messages (from background/other content scripts)
     * Handles message filtering and forwarding logic
     */
    onMessage(): void;
    /**
     * Gets all iframe windows in the current document
     * @returns NodeList of all iframe elements
     */
    get iframeWindows(): NodeListOf<HTMLIFrameElement>;
    /**
     * Posts a message to the appropriate receiver:
     * - inpage: Uses postMessage API with targetOrigin '*'
     * - Background: Uses browser.runtime.sendMessage
     * @param message The message to send
     */
    postMessage(message: SealxRequest): void;
    /**
     * Adds message listeners for:
     * - Window messages (from iframes/pages)
     * - Runtime messages (from background/other content scripts)
     * @param callback Function to handle incoming messages
     */
    addListener(callback: (event: any, sender?: chrome.runtime.MessageSender) => any): void;
    /**
     * Removes previously added message listeners
     * @param callback The callback function to remove
     */
    removeListener(callback: (event: any, sender?: chrome.runtime.MessageSender) => any): void;
}

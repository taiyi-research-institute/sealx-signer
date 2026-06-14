import { MessageChannel } from '../enums';
import ExtensionMessager from './extension-messager';
import ContentMessager from './content-messager';
import BackgroundMessager from './background-messager';
import WindowMessager from './window-messager';
import { type Messager } from '../contracts';

/**
 * Manages creation of appropriate message channels based on the current execution environment.
 * This is a factory class that determines which type of messager implementation to use
 * based on where the code is running (extension, content script, background, or window context).
 */
export default class MessagerManager {
    /**
     * Detects the current execution environment.
     * @returns {'extension' | 'content' | 'background' | 'window'} The detected environment type
     */
    private static detectEnvironment(): 'extension' | 'content' | 'background' | 'window' {
        // If window is undefined, we're in a service worker/background script
        if (typeof window === 'undefined') {
            return 'background';
        }

        // Check for Chrome extension context
        if (window.chrome?.runtime?.id) {
            // If window === window.parent, we're in an extension page (popup/options)
            // Otherwise we're in a content script injected into a web page
            // If window.location.protocol starts with 'chrome-extension:', it's an extension page
            if (window.location.protocol.startsWith('chrome-extension:')) {
                return 'extension';
            }
            // Otherwise, it's a content script injected into a web page
            return 'content';
        }

        // Default to window context (regular web page)
        return 'window';
    }

    /**
     * Gets the appropriate message channel implementation for the current environment.
     * @returns {ExtensionMessager | ContentMessager | BackgroundMessager | WindowMessager} 
     *          The appropriate messager instance
     * @throws {Error} If the environment is not supported
     */
    public static getMessager(): Messager {
        const env = this.detectEnvironment();
        switch (env) {
            case 'extension':
                // For extension pages, check meta tag to determine specific context
                const meta = document.querySelector('meta[name="extension-context"]') as HTMLMetaElement | null;
                const context = meta?.content;
                const validChannels = [
                    MessageChannel.POPUP,
                    MessageChannel.OPTIONS,
                    MessageChannel.SIDEBAR,
                    MessageChannel.EXTENSION
                ];
                // Validate the channel from meta tag or fallback to EXTENSION
                const channel = validChannels.includes(context as MessageChannel)
                    ? context as MessageChannel.OPTIONS | MessageChannel.POPUP | MessageChannel.SIDEBAR
                    : MessageChannel.EXTENSION;
                return new ExtensionMessager(channel);
            case 'content':
                // Content script running in a web page
                return new ContentMessager();
            case 'background':
                // Background script/service worker
                return new BackgroundMessager();
            case 'window':
                // Regular web page (non-extension context)
                return new WindowMessager();
            default:
                throw new Error(`Unsupported environment: ${env}`);
        }
    }
}

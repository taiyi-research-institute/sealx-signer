import ExtensionMessager from './extension-messager';
import ContentMessager from './content-messager';
import BackgroundMessager from './background-messager';
import WindowMessager from './window-messager';
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
    private static detectEnvironment;
    /**
     * Gets the appropriate message channel implementation for the current environment.
     * @returns {ExtensionMessager | ContentMessager | BackgroundMessager | WindowMessager}
     *          The appropriate messager instance
     * @throws {Error} If the environment is not supported
     */
    static getMessager(): ExtensionMessager | ContentMessager | BackgroundMessager | WindowMessager;
}

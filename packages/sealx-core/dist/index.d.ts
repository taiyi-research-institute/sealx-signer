interface ITabManager {
    tabs: chrome.tabs.Tab[];
    currentTab: chrome.tabs.Tab;
    currentTabId?: number;
}
declare class TabManager implements ITabManager {
    tabs: chrome.tabs.Tab[];
    currentTab: chrome.tabs.Tab;
    static instance: TabManager;
    private constructor();
    static getInstance(): TabManager;
    get currentTabId(): number | undefined;
    updateActiveTab(): Promise<void>;
}

interface StorageLike {
    getItem<T = any>(key: string): Promise<T | null>;
    setItem<T = any>(key: string, value: T): Promise<T>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
    listen<TValue = unknown>(key: string, callback: (newValue: TValue, oldValue: TValue) => void): () => void;
}

/**
 * Mapping between display keys and original message keys
 * @example
 * {
 *   "User Name": { originKey: "userName" },
 *   "Address": {
 *     originKey: "address",
 *     children: {
 *       "Street": { originKey: "street" }
 *     }
 *   }
 * }
 */
type KeyMap = Record<string, KeyReflection>;
type OrigionType = 'value' | 'struct' | 'array' | 'time';
/**
 * Defines how a key from the message maps to its display representation
 */
interface KeyReflection {
    /** Original key name in the message object */
    originKey: string;
    /** Nested key mappings for object/array values */
    children: KeyMap | Record<string, KeyMap>;
    originType: OrigionType;
}
/**
 * Defines the layout structure for rendering signed content
 */
interface SignContentLayout {
    /**
     * JSON string of KeyMap to preserve property order consistency
     * @see KeyMap
     */
    keysMapStr: string;
    /**
     * HTML template for rendering the signed content
     * @example
     * `<div style="font-size:12px">
     *    <span style="color:red">{user.name.label}</span>
     *    <span style="color:red">{user.name.value}</span>
     * </div>`
     *
     * Supports both direct references and array references:
     * - Direct: user.address.street.value
     * - Array: users[i].address.value
     */
    template: string;
}
interface Eip712Struct {
    /**
 * The EIP-712 domain separator fields
 */
    readonly domain: {
        /** The name of the signing domain (e.g. "MyDApp") */
        readonly name: string;
        /** Current version of the domain (e.g. "1") */
        readonly version: string;
        /** The chainId where the verifying contract is deployed */
        readonly chainId: number;
        /** The address of the verifying contract */
        readonly verifyingContract: string;
        readonly salt: string;
    };
    /**
     * Type definitions for the message
     * @example {
     *   Person: [
     *     { name: 'name', type: 'string' },
     *     { name: 'wallet', type: 'address' }
     *   ]
     * }
     */
    readonly types: Record<string, Array<{
        name: string;
        type: string;
    }>>;
    /** The primary type of the message being signed */
    readonly primaryType: string;
    /** The message content to be signed */
    readonly message: Record<string, unknown>;
}
/**
 * EIP-712 Typed Structured Data for signing
 * @see https://eips.ethereum.org/EIPS/eip-712
 */
interface SignContent extends Eip712Struct {
    readonly layout: SignContentLayout;
    readonly validUntilTime: string;
}
interface SignContextItem {
    label: string;
    value: Record<string, SignContextItem> | string | number | boolean | SignLayoutContext[];
}
type SignLayoutContext = Record<string, SignContextItem>;
interface SignLayoutRender {
    readonly signData: Eip712Struct;
    readonly render: string;
    readonly context: SignLayoutContext | null;
}

interface SealxSession {
    /**
     * Unique identifier for the session.
     */
    sessionId: string;
    /**
     * Optional user identifier from authentication system.
     * Used when session needs to be associated with a specific user account.
     * Example: "auth0|123456"
     */
    userId?: string;
    /**
     * Address associated with the session.
     */
    address: string;
    /**
     * Expiration time of the session in milliseconds since epoch.
     */
    expire: number;
    host?: string;
    /**
     * Cryptographic public key associated with the session.
     * Used for signing operations when no account is specified.
     * Can be any key format supported by the implementation.
     */
    pk?: any;
}
/**
 * Represents a SealX account with all required user information
 */
interface SealxAccount {
    /**
     * Unique database identifier for the account record
     */
    id?: string;
    /**
     * Unique user identifier from authentication system
     */
    userId?: string | number;
    /**
     * User's email address for communication
     */
    email?: string;
    /**
     * Display name for the user account
     */
    userName?: string;
    /**
     * Public key associated with the SealX address
     * Used for cryptographic operations and verification
     */
    pk?: string;
    newPk?: string;
}
/**
 * Represents a signing task to be processed by SealX.
 * Contains all information needed to generate and validate a signature.
 */
interface SealxSignTask {
    /**
     * Unique identifier for the signing task.
     * Used to track task status and results.
     * Example: "task_xyz789"
     */
    taskId: string;
    /**
     * Type/category of the signing task.
     * Determines how the content should be processed.
     * Example: "eip712" or "raw"
     */
    taskType: string;
    /**
     * The signing command/operation to perform.
     * Example: "signPersonal" or "signTypedData"
     */
    command: string;
    /**
     * The content to be signed, formatted according to taskType.
     */
    signContent: SignContent | {
        taskId: string;
        signContent: SignContent;
    }[];
    /**
     * Time unit for signature validity period.
     * Example: "seconds", "minutes", or "hours"
     */
    validUntilTime: string;
    /** Optional: Third-party provided task preview page */
    preViewUrl?: string;
    /**(Optional) Additional external data or context for the task, provided as a key-value map. */
    extenals?: Record<string, unknown>;
}

interface AutoCheckSealxCallback {
    (signer: SealxSigner): Promise<boolean>;
}
/**
 * The SealxSigner class provides functionality for managing the Sealx plugin state,
 * including installation, connection management, and signing operations.
 *
 * Key Features:
 * - Tracks plugin installation state
 * - Manages plugin open/close state via DOM attributes
 * - Handles session connections for signing operations
 * - Provides cryptographic signing capabilities
 */
declare class SealxSigner {
    id: string;
    /** Whether the plugin has been installed */
    installed: boolean;
    /** Whether the plugin UI is currently active */
    active: boolean;
    /** Whether a session is currently connected */
    connected: boolean;
    /** Current active session, if connected */
    session: SealxSession | null;
    /** Current account information, if available */
    account: SealxAccount | null;
    autoConnectCallback: (() => void) | null;
    autoClearTimer: any;
    /** Storage wrapper for persisting plugin state */
    storageWrapper: StorageLike;
    constructor();
    initializeAccount(account: SealxAccount): Promise<void>;
    initializeSession(session: SealxSession): Promise<void>;
    setAutoClearTimer(): void;
    /**
     * Synchronizes the plugin's active state with the DOM attribute.
     * Called by the MutationObserver when the data-sealx-signer-active attribute changes.
     */
    activeStateInitialize(): void;
    /**
     * Initializes the plugin state:
     * - Loads installation status from storage
     * - Sets up MutationObserver to track plugin active state changes
     * - Initializes current active state
     */
    initialize(): Promise<void>;
    /**
     * Marks the plugin as installed and persists this state.
     * Can only be called once - subsequent calls will warn.
     */
    install(): void;
    /**
     * Activates the plugin UI by setting the DOM attribute.
     * Updates internal state and logs the operation.
     */
    activate(): void;
    /**
     * Deactivates the plugin UI by clearing the DOM attribute.
     * Updates internal state and logs the operation.
     */
    deactivate(): void;
    autoCheckTimer: any;
    autoCheck(checker: AutoCheckSealxCallback): Promise<void>;
}

declare global {
    interface Window {
        sealxSigner: SealxSigner;
    }
}
declare class SealxProvider {
    static register(): void;
}

/**
 * Converts various time formats to human-readable format with current computer's timezone
 * @param timeValue - The time value to convert (can be timestamp, Date object, or ISO string)
 * @returns {string} Human-readable formatted time string with current timezone information
 * @example
 * // Returns "2025-10-17 18:01:15 UTC+8" (current timezone: UTC+8)
 * convertToISOFormat(1729152075000)
 * // Returns "2025-10-17 18:01:15 UTC+8" (current timezone: UTC+8)
 * convertToISOFormat("2025-10-17T10:01:15.000Z")
 * // Returns "2025-10-17 18:01:15 UTC+8" (current timezone: UTC+8)
 * convertToISOFormat(new Date("2025-10-17T10:01:15.000Z"))
 */
declare function convertToISOFormat(timeValue: any): string;
/**
 * Parses EIP-712 signing content into a renderable format by:
 * 1. Validating the template using a cryptographic salt check
 * 2. Building a rendering context from the message data
 * 3. Applying the template to the context if valid
 *
 * @param signContent - Complete EIP-712 structured data including:
 *   - layout: Contains template and key mappings
 *   - message: The actual data to be signed
 *   - domain: Contains validation salt
 *   - validUntilTime: Timestamp for template validation
 * @returns {SignLayoutRender} Object containing:
 *   - signData: Original EIP-712 data structure
 *   - render: Rendered template string (empty if validation failed)
 *   - context: Processed context data (null if validation failed)
 * @throws {Error} If template validation fails
 */
declare const parseSignContent: (signContent: SignContent) => SignLayoutRender;
/**
 * Validates that a template contains all required references for a given key mapping structure.
 * Recursively checks nested key mappings to ensure template completeness.
 *
 * @param keyMap - Key mapping structure to validate against template
 * @param template - Template string to validate
 * @param parentKey - Parent key path for nested validations (used internally)
 * @returns {boolean} True if template contains all required key references, false otherwise
 * @example
 * // Returns true if template contains 'user.name.label' and 'user.name.value'
 * checkTemplateArgValid(
 *   { '用户列表': { originKey: 'users', children:[{
 *      "用户名":{
 *          originKey:'name'
 *       }
 *      }] } },
 *   'Hello <%= users[i].name.value %>!'
 * )
 */
declare const checkTemplateArgValid: (keyMap: KeyMap, template: string, parentKey?: string) => boolean;
/**
 * Builds a hierarchical rendering context from key mappings and message data.
 * Handles both single objects and arrays recursively.
 *
 * @param keyMap - Mapping configuration that defines:
 *   - originKey: Source field in message
 *   - children: Nested mappings (optional)
 * Can be single mapping or array of mappings
 * @param message - Source data to process. Can be:
 *   - Single object with key-value pairs
 *   - Array of objects
 * @returns {SignLayoutContext} Structured context with:
 *   - label: Display label from keyMap
 *   - value: Processed value (recursively handled if object/array)
 * @example
 * // Returns { name: { label: 'Full Name', value: 'John Doe' } }
 * buildSignRenderContext(
 *   { name: { originKey: 'userName' } },
 *   { userName: 'John Doe' }
 * )
 */
declare const buildSignRenderContext: (keyMap: KeyMap, message: Record<string, any>) => SignLayoutContext;
/**
 * Synchronously renders a template string using lodash template syntax
 *
 * @param template - Template string with lodash interpolation tags:
 *   - <%= value %> for HTML-escaped output
 *   - <%- value %> for raw output
 * @param context - Data object containing values referenced in template
 * @returns {string} Rendered output
 * @example
 * // Returns "Hello, John!"
 * layoutRender("Hello, <%= user.value.name.value %>!", { user: { value:{ name: {value: "Json"} } } })
 */
declare const layoutRender: (template: string, context: Record<string, any>) => string;

declare const pinGenerator: () => string;
declare const slatGenerator: () => string;
declare const deriveKeyFromPin: (pin: string, slat: string) => Promise<CryptoKey>;
declare const encryptPrivateKey: (privateKey: string, pin: string, slat: string) => Promise<{
    iv: string;
    encrypted: string;
}>;
declare const decryptPrivateKey: (pin: string, encodePrivateKey: string, iv: string, slat: string) => Promise<string>;

declare const wait: (delay: number) => Promise<unknown>;
declare function isViewportFullscreenBySize(): boolean;
declare function isNativeFullscreen(): boolean;

declare class IndexedDBWrapper implements StorageLike {
    private dbName;
    private storeName;
    private dbPromise;
    private listeners;
    constructor(dbName?: string, storeName?: string);
    private notifyListeners;
    listen<TValue = unknown>(key: string, callback: (newValue: TValue, oldValue: TValue) => void): () => void;
    private openDB;
    private withStore;
    getItem<T = any>(key: string): Promise<T | null>;
    setItem<T = any>(key: string, value: T): Promise<T>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
    close(): Promise<void>;
}

declare class LocalStorageWrapper implements StorageLike {
    private db;
    private table;
    private readonly isChromeExtension;
    constructor(db?: string, table?: string);
    listen<TValue = unknown>(key: string, callback: (newValue: TValue, oldValue: TValue) => void): () => void;
    get namespace(): string;
    private getNamespacedKey;
    getItem<T = any>(key: string): Promise<T | null>;
    setItem<T = any>(key: string, value: T): Promise<T>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
}

declare const localStorageWrapper: (db: string, table: string) => LocalStorageWrapper;
declare const dbStorageWrapper: (db: string, table: string) => IndexedDBWrapper;

export { SealxProvider, SealxSigner, TabManager, buildSignRenderContext, checkTemplateArgValid, convertToISOFormat, dbStorageWrapper, decryptPrivateKey, deriveKeyFromPin, encryptPrivateKey, isNativeFullscreen, isViewportFullscreenBySize, layoutRender, localStorageWrapper, parseSignContent, pinGenerator, slatGenerator, wait };
export type { AutoCheckSealxCallback, Eip712Struct, ITabManager, KeyMap, KeyReflection, OrigionType, SealxAccount, SealxSession, SealxSignTask, SignContent, SignContentLayout, SignContextItem, SignLayoutContext, SignLayoutRender };

import { SignContent, SealxSession } from 'sealx-core';

type Topic = string;
/**
 * Defines the header structure for Sealx messages.
 *
 * @template Action - The type of action, defaults to SealxRequestAction.
 * @property host - The originating website host.
 * @property requestId - Unique identifier for the request.
 * @property sessionId - Identifier for the session associated with the request.
 * @property action - The action to be performed, of type Action.
 */
interface SealxHeader {
    host: string;
    userId?: string;
    requestId: string;
    sessionId: string;
    messagerId: string;
    tabId?: number;
    fullscreen?: boolean;
}
interface SealxTopicEvent<T = Topic> {
    topic: T;
}
/**
 * Represents a signing task with associated content and metadata.
 *
 * @property taskId - Unique identifier for the signing task.
 * @property signContent - The content that needs to be signed.
 * @property taskType - The type/category of the signing task.
 * @property expireTime - The expiration time of the task, represented as a timestamp (in milliseconds).
 */
interface SignTask {
    taskId: string;
    signContent: SignContent;
    taskType: string;
    expireTime: number;
}
/**
 * Represents a message for a sign task request.
 *
 * @remarks
 *
 * @property data - A single {@link SignTask} object or an array of {@link SignTask} objects to be processed.
 * @property taskTypes - An array of strings specifying the types of tasks included in the message.
 * @property callback - A string representing the callback URL or identifier to be used after processing the tasks.
 */
interface SignTaskMessage {
    data: SignTask | SignTask[];
    taskTypes: string[];
    callback: string;
}
/**
 * Represents a connection request message.
 *
 * @extends RequestMessage
 * @property host - The host address initiating the connection request.
 */
interface ConnectionRequestMessage {
    host: string;
    userId?: string;
    email?: string;
    userName?: string;
}
/**
 * Represents the result of a signing operation.
 *
 * @property taskId - The unique identifier of the signing task.
 * @property signature - The generated signature string.
 */
interface SignResult {
    taskId: string;
    signature: string;
}
/**
 * Represents a response message for a signing operation.
 *
 * @property {SignResult} result - The result of the sign operation.
 */
interface SignResponseMessage {
    result: {
        taskId: string;
        signature: string;
    };
}
/**
 * Represents a connection session with a unique session ID and expiration time.
 *
 * @property sessionId - The unique identifier for the session.
 * @property expire - The expiration timestamp (in milliseconds since epoch) for the session.
 */
interface ConnectionSession {
    sessionId: string;
    address: string;
    expire: number;
}
/**
 * Represents a response message for a connection request.
 *
 * @property result - The session information associated with the connection.
 */
interface ConnectionResponseMessage {
    result: ConnectionSession;
}
/**
 * Represents a message for locating an element in the page.
 *
 * @property key - The data-key attribute value to locate.
 * @property value - Optional value of the element for matching.
 */
interface LocateElementMessage {
    key: string;
    value?: string;
}

/**
 * Actions that can be requested from the SealX service
 */
declare enum SealxTopic {
    /** Request to connect to a wallet/account */
    CONNECT = "connect",
    /** Check if the plugin is activated */
    CHECK_ACTIVED = "check-actived",
    /** Connection established */
    CONNECTED = "connected",
    /** Request to disconnect from current wallet/account */
    DISCONNECT = "disconnect",
    /** Request to sign a single message/transaction */
    SIGN = "sign",
    REMOTE_SIGN = "remote-sign",
    SIGN_RESPONSE = "sign-response",
    /** Request to sign multiple messages/transactions in batch */
    BATCH_SIGN = "batch-sign",
    /** Request to delete/revoke a signature */
    DEL_SIGN = "del-sign",
    /** Request to get the current tab ID */
    GET_TAB_ID = "get-tab-id",
    /** Request to get the current extension ID */
    GET_EXTENSION_ID = "get-extension-id",
    /** Request to get the current account information */
    GET_ACCOUNT = "get-account",
    /** Check initialized */
    CHECK_INITIALIZED = "check-initialized",
    /** Check if the current session has expired */
    CHECK_SESSION_EXPIRED = "check-session-expired",
    /** Verify the provided PIN code */
    CHECK_PIN = "check-pin",
    /** Initialize the SealX service */
    INITIALIZE = "initialize",
    GET_SCREEN_OFF_TIMER = "get-screen-off-timer",
    SET_SCREEN_OFF_TIMER = "set-screen-off-timer",
    RESET_PIN = "reset-pin",
    LOGIN = "login",
    CHECK_ACTIVE = "check-active",
    BIND_PK = "bind-pk",
    IMPORT_KEY = "import-key",
    /** Export private key as hex */
    PK_HEX = "pk-hex",
    CLOSE = "close",
    /** Verify temporary code for import */
    VERIFY_TEMP_CODE = "verify-temp-code",
    /** Locate element in the page by data-key attribute */
    LOCATE_ELEMENT = "locate-element",
    /** All topics */
    ALL = "*"
}
/**
 * Communication channels used in the SealX extension
 */
declare enum MessageChannel {
    /** Background script communication */
    BACKGROUND = "background",
    /** Popup window communication */
    POPUP = "popup",
    /** Options page communication */
    OPTIONS = "options",
    /** Sidebar panel communication */
    SIDEBAR = "sidebar",
    /** Extension-level communication */
    EXTENSION = "extension",
    /** Content script communication */
    CONTENT = "content",
    /** In-page script communication */
    INPAGE = "inpage",
    /** Iframe communication */
    IFRAME = "iframe",
    /** All channels */
    ALL = "*"
}

interface SealxResponse<M = any, T = SealxTopic> extends SealxRequest<M, T> {
    responseId: string;
    session?: SealxSession;
    error?: string;
    end: boolean;
}

type ReplyType = string | number | Object | Boolean | Record<string, any>;
interface ReplyFunc<R = ReplyType> {
    (res: R, end?: boolean): void;
}
/**
 * Handler function for processing incoming messages
 * @param request - The incoming message request
 * @param reply - Optional callback function to send a reply
 * @returns Promise that resolves when handling is complete
 */
interface MessageHandle {
    (request: SealxRequest, reply?: ReplyFunc): Promise<any>;
}
/**
 * Interface for sending messages and receiving multiple responses via streaming
 * @typeParam T - Type of the message payload
 * @param message - The payload to send
 * @param topic - The topic to send on
 * @param receiver - Optional specific receiver channel
 * @returns AsyncGenerator that yields response payloads
 *
 * @remarks
 * Useful for long-running operations or when expecting multiple responses.
 * The generator will yield responses as they arrive until the stream ends.
 *
 * @example
 * ```typescript
 * const stream = messager.sendStream(data, 'stream-topic');
 * for await (const response of stream) {
 *   console.log('Received response:', response);
 * }
 * ```
 */
interface MessageSendStream {
    <T = any>(message: T, topic: SealxTopic, receiver?: MessageChannel): AsyncGenerator<SealxResponse, void, unknown>;
}
/**
 * Interface for sending messages and awaiting a response
 * @typeParam T - Type of the message payload
 * @param message - The payload to send
 * @param topic - The topic to send on
 * @param receiver - Optional specific receiver channel
 * @param requestId - Optional request ID for correlation
 * @returns Promise that resolves with the response
 */
interface MessageSend {
    <T = any>(message: T, topic: SealxTopic, receiver?: MessageChannel, requestId?: string): Promise<SealxResponse>;
}
/**
 * Interface for sending reply messages
 * @typeParam T - Type of the reply payload
 * @param message - The reply payload to send
 * @param request - The original request being replied to
 * @param end - Optional flag indicating if this is the final reply
 * @returns Promise that resolves when reply is sent
 */
interface MessageReply {
    <T = any>(message: T, request: SealxRequest, end?: boolean): Promise<SealxResponse<T>>;
}
/**
 * Interface for registering message listeners
 * @param topic - The topic to listen on
 * @param callback - Handler function to process messages
 * @param channel - Optional channel filter for messages
 * @returns Unsubscribe function to remove the listener
 */
interface MessageListener {
    (topic: SealxTopic, callback: MessageHandle, channel?: MessageChannel): () => void;
}
/**
 * Unsubscribe function to remove the listener
 * @param topic - The topic to listen on
 * @param callback - Handler function to process messages
 * @param channel - Optional channel filter for messages
 */
interface OffMessageListener {
    (topic: SealxTopic, callback: MessageHandle, channel?: MessageChannel): void;
}
/**
 * Represents a messaging system interface for handling communication
 * between different parts of an application.
 */
interface Messager {
    /**
     * The communication channel used for sending and receiving messages.
     */
    channel: MessageChannel;
    /**
     * A collection of message handlers grouped by topic.
     * Each topic is associated with an array of message handling functions.
     */
    handlers: Record<Topic, MessageHandle[]>;
    /**
     * Sends a message to the specified recipient or channel.
     */
    send: MessageSend;
    /**
     * Interface for sending messages and receiving multiple responses via streaming
     */
    sendStream: MessageSendStream;
    /**
     * Sends a reply message in response to a received message.
     */
    reply: MessageReply;
    replyError: MessageReply;
    /**
     * Registers a listener for a specific topic to handle incoming messages.
     */
    on: MessageListener;
    /**
     * Unregisters a listener for a specific topic to stop handling incoming messages
     * @param topic - The topic to stop listening on
     * @param callback - Handler function to remove
     * @param channel - Optional channel filter for messages
     */
    off: OffMessageListener;
}
/**
 * Standard prefix for all message topics
 * @remarks
 * Used to namespace topics and prevent collisions
 */
declare const TOPIC_PREFIX = "sealx-signer";

/**
 * Base interface for all Sealx request types
 * @template T - Type of the payload (defaults to RequestMessage)
 * @template Action - Type of the action (defaults to SealxTopic)
 */
interface SealxRequest<M = any, T = SealxTopic, R = never> extends SealxTopicEvent<T> {
    header: SealxHeader;
    receiver: MessageChannel;
    sender: MessageChannel;
    once?: boolean;
    payload: M;
    reply?: ReplyFunc;
}
/**
 * Request type for signing operations
 * @remarks Can be used for both single and batch signing operations
 */
type SignRequest = SealxRequest<SignTaskMessage, SealxTopic, SignResponseMessage>;
/**
 * Request type for establishing a new connection
 */
type ConnectionRequest = SealxRequest<ConnectionRequestMessage, SealxTopic>;
/**
 * Request type for deleting existing signatures
 * @remarks Payload is an array of signature IDs to delete
 */
type DelSignRequest = SealxRequest<string[], SealxTopic>;
/**
 * Request type for disconnecting an active session
 * @remarks Payload is the session ID to disconnect
 */
type DisconnectRequest = SealxRequest<string, SealxTopic>;

/**
 * Abstract base class for message communication between channels.
 *
 * `MessagerBase` provides a framework for sending, receiving, and handling messages
 * across different contexts (content scripts, background, etc.) with these features:
 *
 * - Topic-based message handling with wildcard support
 * - Request/response and streaming message patterns
 * - Cross-channel communication with security considerations
 * - Automatic message correlation and response routing
 *
 * @typeParam T - Type of message payload (defaults to any)
 *
 * @property {Record<string, MessageHandle[]>} handlers - Topic to handlers mapping
 * @property {MessageChannel} channel - Communication channel for this instance
 * @property {string} id - Unique messager identifier
 * @property {SealxSession} [session] - Optional session context
 *
 * @constructor
 * @param channel - The message channel this instance will use for communication
 * @param session - Optional session information containing host and sessionId
 *
 * @example Basic implementation:
 * ```typescript
 * class MyMessager extends MessagerBase {
 *   onMessage() {
 *     // Implement message handling
 *   }
 *   postMessage(message) {
 *     // Implement message sending
 *   }
 *   // ... other abstract methods
 * }
 * ```
 *
 * @see {@link MessageChannel} for available communication channels
 * @see {@link SealxRequest} for message request structure
 * @see {@link SealxResponse} for response structure
 * @see {@link SealxSession} for session context details
 */
declare abstract class MessagerBase implements Messager {
    /**
     * Map of topic strings to arrays of handler functions
     * @remarks
     * Keys are full topic names including prefix
     * Values are arrays of handler functions to be called when messages arrive
     */
    handlers: Record<string, MessageHandle[]>;
    /** The message channel this instance communicates through */
    channel: MessageChannel;
    /** Unique identifier for this messager instance */
    id: string;
    /** Optional session information including host and session ID */
    session?: SealxSession;
    forwardHandlers: Record<string, MessageHandle>;
    /**
     * Creates a new MessagerBase instance
     * @param channel - The message channel this instance will use for communication
     * @param session - Optional session information containing host and sessionId
     */
    constructor(channel: MessageChannel, session?: SealxSession);
    /**
     * Abstract method to handle incoming messages.
     * Implementations should define how messages are processed.
     */
    abstract onMessage(): void;
    /**
     * Abstract method to send a message.
     * Implementations should define how messages are posted to the channel.
     *
     * @param message - The message to send.
     */
    abstract postMessage(message: SealxRequest): void;
    /**
     * Abstract method to add a listener for incoming messages.
     *
     * @param callback - The function to invoke when a message is received.
     */
    abstract addListener(callback: (event: any) => any): void;
    /**
     * Abstract method to remove a listener for incoming messages.
     *
     * @param callback - The function to remove from the listener list.
     */
    abstract removeListener(callback: (event: any) => any): void;
    /**
     * Formats a topic with the standard prefix
     * @param topic - The base topic name
     * @returns Formatted topic string with prefix
     * @example
     * ```typescript
     * const fullTopic = messager.topic('data-update');
     * // Returns: 'sealx:data-update'
     * ```
     */
    protected topic(channel: MessageChannel, topic: Topic): string;
    /**
     * Handles incoming messages by routing them to registered handlers
     * @param message - The received message to process
     * @remarks
     * Only processes messages that:
     * - Are addressed to this channel or ALL channels
     * - Have registered handlers for their topic
     */
    protected receiveMessage(message: SealxRequest): Promise<any[]>;
    /**
     * Generates a response topic name from a base topic
     * @param topic - The base topic name
     * @returns Response topic string with ':response' suffix
     * @example
     * ```typescript
     * const responseTopic = messager.responseTopic('data-update');
     * // Returns: 'data-update:response'
     * ```
     */
    protected responseTopic(topic: Topic): string;
    /**
     * Generates a unique message ID with QN prefix
     * @returns Unique message ID string combining:
     * - QN prefix
     * - Current timestamp
     * - Random number suffix
     *
     * @example
     * ```typescript
     * const id = messager.messageId();
     * // Returns: "QN-1624798800000-123"
     * ```
     */
    protected messageId(): string;
    /**
     * Sends a reply message in response to a received message
     * @param message - The payload to send
     * @param topic - The topic to reply on
     * @param receiver - Optional specific receiver channel (defaults to ALL)
     * @param messageId - Optional message ID to reply to (if replying to specific message)
     * @param end - Indicates whether this is the final response in a message chain. If `true`, marks the end of the response sequence. Defaults to `true`.
     * @returns Promise that resolves when message is sent
     *
     * @note Subclasses must implement the actual message posting logic in postMessage()
     */
    reply: MessageReply;
    /**
     * Sends a reply message in response to a received message
     * @param message - The payload to send
     * @param topic - The topic to reply on
     * @param receiver - Optional specific receiver channel (defaults to ALL)
     * @param messageId - Optional message ID to reply to (if replying to specific message)
     * @param end - Indicates whether this is the final response in a message chain. If `true`, marks the end of the response sequence. Defaults to `true`.
     * @returns Promise that resolves when message is sent
     *
     * @note Subclasses must implement the actual message posting logic in postMessage()
     */
    replyError: MessageReply;
    get host(): string;
    get header(): SealxHeader;
    /**
     * Sends a message and waits for a single response
     *
     * @remarks
     * This method:
     * - Automatically adds and removes a temporary listener for the response
     * - Uses the message's requestId to correlate requests and responses
     * - Handles both success and error responses
     * - Cleans up listeners when complete
     *
     * @throws Will reject the promise if:
     * - The message cannot be sent
     * - The receiver returns an error response
     * - The request times out (implementation dependent)
     *
     * @typeParam T - The type of the message payload
     * @param message - The payload to send
     * @param topic - The topic to send on
     * @param receiver - Optional specific receiver channel (defaults to ALL)
     * @returns Promise that resolves with the response payload or rejects on error
     */
    send: MessageSend;
    /**
     * Sends a message and returns an async generator that yields multiple responses
     * Useful for streaming or long-running operations that return multiple chunks
     *
     * @typeParam T - The type of the message payload
     * @param message - The initial payload to send
     * @param topic - The topic to send on
     * @param receiver - Optional specific receiver channel (defaults to ALL)
     * @returns AsyncGenerator that yields response payloads
     *
     * @example
     * ```typescript
     * // Using the stream
     * const stream = messager.sendStream(data, 'stream-topic');
     * for await (const chunk of stream) {
     *   console.log('Received chunk:', chunk);
     * }
     * ```
     */
    sendStream<T = any>(message: T, topic: SealxTopic, receiver?: MessageChannel): AsyncGenerator<SealxResponse, void, unknown>;
    /**
     * Registers a handler for messages on a specific topic
     * @param topic - The topic to listen on (supports wildcards via SealxTopic.ALL)
     * @param handler - Function to handle incoming messages
     * @param channel - Optional specific channel to filter messages by (defaults to ALL)
     * @returns Function to unsubscribe the handler
     *
     * @remarks
     * The handler receives two arguments:
     * 1. The incoming message
     * 2. A reply function that can be used to send a response
     *
     * @example Basic usage
     * ```typescript
     * // Register handler
     * const unsubscribe = messager.on('data-update', (message, reply) => {
     *   console.log('Received update:', message);
     *   reply({ status: 'acknowledged' });
     * });
     *
     * // Later, to unsubscribe:
     * unsubscribe();
     * ```
     *
     * @example Wildcard handler
     * ```typescript
     * // Handle all messages regardless of topic
     * messager.on(SealxTopic.ALL, (message) => {
     *   console.log('Received message:', message);
     * });
     * ```
     */
    on: MessageListener;
    /**
     * Unregisters a message handler for a specific topic
     * @param topic - The topic to stop listening on
     * @param callback - Handler function to remove
     * @param channel - Optional channel filter for messages
     * @returns Function that can be used to re-register the handler
     *
     *
     * @example
     * ```typescript
     * // Remove a specific handler
     * messager.off('data-update', handler);
     * ```
     */
    off: OffMessageListener;
    onForward(receiver: MessageChannel, handle: MessageHandle): void;
}

/**
 * Handles message communication for content scripts in browser extensions.
 * Manages message passing between:
 * - Content scripts and background pages
 * - Content scripts and iframes
 * - Content scripts and inpage scripts
 */
declare class ContentMessager extends MessagerBase {
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
declare class ExtensionMessager extends MessagerBase {
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
declare class BackgroundMessager extends MessagerBase {
    /** Manages tab information for message routing */
    private tabManager;
    /**
     * Creates a new ExtensionMessager instance
     * @remarks
     * Initializes with BACKGROUND channel and gets TabManager instance
     */
    constructor();
    /**
     * Gets the current active tab ID
     * @returns Current tab ID or undefined if no active tab
     */
    get tabId(): number | undefined;
    get host(): string;
    /**
     * Sets up message listener for incoming messages
     * @remarks
     * Forwards valid messages to receiveMessage handler
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
declare class WindowMessager extends MessagerBase {
    /**
     * Creates a new WindowMessager instance
     */
    constructor();
    get fullscreen(): boolean;
    get header(): SealxHeader;
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

/**
 * Manages creation of appropriate message channels based on the current execution environment.
 * This is a factory class that determines which type of messager implementation to use
 * based on where the code is running (extension, content script, background, or window context).
 */
declare class MessagerManager {
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
    static getMessager(): ContentMessager | ExtensionMessager | BackgroundMessager | WindowMessager;
}

/**
 * Periodically checks if the SealxSigner extension is still active
 * @param messager - The messaging interface used to communicate with the extension
 */
declare const checkSealxSignerActive: (messager: Messager) => void;

export { BackgroundMessager, ContentMessager, ExtensionMessager, MessageChannel, MessagerManager, SealxTopic, TOPIC_PREFIX, WindowMessager, checkSealxSignerActive };
export type { ConnectionRequest, ConnectionRequestMessage, ConnectionResponseMessage, ConnectionSession, DelSignRequest, DisconnectRequest, LocateElementMessage, MessageHandle, MessageListener, MessageReply, MessageSend, MessageSendStream, Messager, OffMessageListener, ReplyFunc, SealxHeader, SealxRequest, SealxTopicEvent, SignRequest, SignResponseMessage, SignResult, SignTask, SignTaskMessage, Topic };

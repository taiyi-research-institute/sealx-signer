import { Topic, MessageHandle, MessageListener, Messager, MessageSend, SealxRequest, MessageReply, OffMessageListener } from "../contracts";
import { SealxResponse } from "../contracts/response";
import { MessageChannel, SealxTopic } from "../enums";
import type { SealxSession } from "sealx-core";
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
export default abstract class MessagerBase implements Messager {
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
    get header(): {
        host: string;
        requestId: string;
        sessionId: any;
        messagerId: string;
    };
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

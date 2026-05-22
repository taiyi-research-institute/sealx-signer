import { MessageChannel, SealxTopic } from "../enums";
import type { SealxHeader, Topic } from "./message";
import { SealxRequest } from "./request";
import { SealxResponse } from "./response";
type ReplyType = string | number | Object | Boolean | Record<string, any>
export interface ReplyFunc<R = ReplyType> {
    (res: R, end?: boolean): void
}
/**
 * Handler function for processing incoming messages
 * @param request - The incoming message request
 * @param reply - Optional callback function to send a reply
 * @returns Promise that resolves when handling is complete
 */
export interface MessageHandle {
    (request: SealxRequest, reply?: ReplyFunc): Promise<any>
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
export interface MessageSendStream {
    <T = any>(message: T, topic: SealxTopic, receiver?: MessageChannel): AsyncGenerator<SealxResponse, void, unknown>
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
export interface MessageSend {
    <T = any>(message: T, topic: SealxTopic, receiver?: MessageChannel, requestId?: string, header?: Partial<SealxHeader>): Promise<SealxResponse>
}

/**
 * Interface for sending reply messages
 * @typeParam T - Type of the reply payload
 * @param message - The reply payload to send
 * @param request - The original request being replied to
 * @param end - Optional flag indicating if this is the final reply
 * @returns Promise that resolves when reply is sent
 */
export interface MessageReply {
    <T = any>(message: T, request: SealxRequest, end?: boolean): Promise<SealxResponse<T>>
}

/**
 * Interface for registering message listeners
 * @param topic - The topic to listen on
 * @param callback - Handler function to process messages
 * @param channel - Optional channel filter for messages
 * @returns Unsubscribe function to remove the listener
 */
export interface MessageListener {
    (topic: SealxTopic, callback: MessageHandle, channel?: MessageChannel): () => void
}

/**
 * Unsubscribe function to remove the listener
 * @param topic - The topic to listen on
 * @param callback - Handler function to process messages
 * @param channel - Optional channel filter for messages
 */
export interface OffMessageListener {
    (topic: SealxTopic, callback: MessageHandle, channel?: MessageChannel): void
}
/**
 * Represents a messaging system interface for handling communication
 * between different parts of an application.
 */
export interface Messager {
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
export const TOPIC_PREFIX = 'sealx-signer'

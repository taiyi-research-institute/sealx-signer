import { Topic, MessageHandle, MessageListener, Messager, MessageSend, TOPIC_PREFIX, SealxRequest, MessageReply, MessageSendStream, OffMessageListener, SealxHeader } from "../contracts";
// import { Message } from "../contracts/message";
import { SealxResponse } from "../contracts/response";
import { MessageChannel, SealxTopic } from "../enums";
import { TabManager, type SealxSession, type SealxSigner } from "sealx-core";

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
    id: string = 'messager-base';

    /** Optional session information including host and session ID */
    session?: SealxSession;

    // 跳转处理
    forwardHandlers: Record<string, MessageHandle>;

    /**
     * Creates a new MessagerBase instance
     * @param channel - The message channel this instance will use for communication
     * @param session - Optional session information containing host and sessionId
     */
    constructor(channel: MessageChannel, session?: SealxSession) {
        this.channel = channel;
        this.forwardHandlers = {}
        this.handlers = {};
        this.onMessage()
        this.session = session
        this.id = `messager-${channel}-${Date.now()}-${(Math.random() * 1000).toFixed(0)}`;
    }

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
    protected topic(channel: MessageChannel, topic: Topic) {
        return `${TOPIC_PREFIX}-${channel}-${topic}`
    }

    /**
     * Handles incoming messages by routing them to registered handlers
     * @param message - The received message to process
     * @remarks
     * Only processes messages that:
     * - Are addressed to this channel or ALL channels
     * - Have registered handlers for their topic
     */
    protected async receiveMessage(message: SealxRequest) {

        const channelTopicKey = this.topic(message.sender, message.topic)
        const channelAllTopicKey = this.topic(message.sender, SealxTopic.ALL)
        const allChannelAllTopicKey = this.topic(MessageChannel.ALL, SealxTopic.ALL)
        const allChannelTopicKey = this.topic(MessageChannel.ALL, message.topic)

        const topicKeys = [channelAllTopicKey, allChannelTopicKey,
            channelTopicKey, allChannelAllTopicKey]
        const response: any[] = []
        for (const topicKey of topicKeys) {
            const handles = this.handlers[topicKey] ?? []
            for (const handle of handles) {
                if (!('responseId' in message)) response.push(await handle(message))
            }
        }
        return response
    }

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
    protected responseTopic(topic: Topic) {
        return `${topic}:response`
    }

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
    protected messageId() {
        return `QN-${Date.now()}-${(Math.random() * 1000).toFixed(0)}`
    }

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
    reply: MessageReply = async <T = any>(message: T, request: SealxRequest, end: boolean = true): Promise<SealxResponse<T>> => {
        const id = this.messageId()
        const header = {
            ...request.header,
            messagerId: this.id
        }
        const response: SealxResponse<T> = {
            ...request,
            header,
            payload: message,
            receiver: request.sender,
            sender: request.receiver,
            responseId: id,
            end: end ? end : (request.once ?? false)
        }
        if (this.session) {
            response.session = this.session
        }
        this.postMessage(response)
        return Promise.resolve(response)
    };
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
    replyError: MessageReply = async <T = any>(error: T, request: SealxRequest, end: boolean = true): Promise<SealxResponse<T>> => {
        const id = this.messageId()
        const header = {
            ...request.header,
            messagerId: this.id
        }
        const response: SealxResponse<T> = {
            ...request,
            header,
            error: error as string,
            receiver: request.sender,
            sender: request.receiver,
            responseId: id,
            end: end ? end : (request.once ?? false)
        }
        if (this.session) {
            response.session = this.session
        }
        this.postMessage(response)
        return Promise.resolve(response)
    };
    get host() {
        return window.location.host
    }
    get header(): SealxHeader {
        const id = this.messageId()
        return {
            host: this.host,
            requestId: id,
            sessionId: this.session?.sessionId ?? '',
            messagerId: this.id,
            userId: this.session?.userId
        }
    }

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
    send: MessageSend = async <T = any>(message: T, topic: SealxTopic, receiver?: MessageChannel): Promise<SealxResponse> => {
        // const id = this.messageId()
        const sendMsg: SealxRequest<T> = {
            header: this.header,
            payload: message,
            receiver: receiver ?? MessageChannel.ALL,
            sender: this.channel,
            topic: topic,
            once: true,
        }
        // if (chrome.tabs) {
        //     await (TabManager.getInstance().updateActiveTab())
        // }
        // this.postMessage(sendMsg)
        return new Promise((resolve, rejected) => {
            try {
                this.postMessage(sendMsg)
            } catch (e) {
                rejected(e)
            }
            const handle = (event: MessageEvent<SealxResponse> | SealxResponse) => {
                const message = event instanceof MessageEvent ? event.data : event
                if (message && message.header && message.header.messagerId !== this.id && message.header.requestId === sendMsg.header.requestId) {
                    this.removeListener(handle)
                    if (message.error) {
                        rejected(message.error)
                    } else {
                        resolve(message)
                    }
                }
            }
            this.addListener(handle)
        })
    };

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
    async *sendStream<T = any>(message: T, topic: SealxTopic, receiver?: MessageChannel): AsyncGenerator<SealxResponse, void, unknown> {
        // const id = this.messageId()
        const sendMsg: SealxRequest<T> = {
            header: this.header,
            payload: message,
            receiver: receiver ?? MessageChannel.ALL,
            sender: this.channel,
            topic: topic,
            once: false
        }

        this.postMessage(sendMsg)

        // Internal queue for buffering incoming messages
        const queue: SealxResponse[] = []
        // Callbacks for resolving/rejecting the next promise
        let resolveNext: ((value: SealxResponse) => void) | null = null
        let rejectNext: ((reason: any) => void) | null = null
        // Flag indicating if the stream has completed
        let done = false

        /**
         * Handles incoming stream messages
         * @param event - Message event containing the response
         */
        const handle = (event: MessageEvent<SealxResponse<T>>) => {
            const data = event.data
            if (!data.header) {
                return
            }
            if (data.header.requestId !== sendMsg.header.requestId) return

            if (data.header.messagerId === sendMsg.header.messagerId) {
                return
            }

            if (data.error) {
                done = true
                this.removeListener(handle)
                rejectNext?.(data.error)
            } else {
                queue.push(data)
                resolveNext?.(queue.shift()!)
                resolveNext = null
                rejectNext = null
            }

            if (data.end) {
                done = true
                this.removeListener(handle)
            }
        }

        this.addListener(handle)

        try {
            while (!done || queue.length) {
                if (queue.length) {
                    yield queue.shift()!
                } else {
                    // Yield control and wait for next message
                    yield await new Promise<SealxResponse>((resolve, reject) => {
                        resolveNext = resolve
                        rejectNext = reject
                    })
                }
            }
        } finally {
            this.removeListener(handle)
        }
        return
    }



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
    on: MessageListener = (topic: SealxTopic, handler: MessageHandle, channel?: MessageChannel) => {
        channel = channel ?? MessageChannel.ALL
        const topicKey = this.topic(channel ?? MessageChannel.ALL, topic)
        if (!this.handlers[topicKey]) {
            this.handlers[topicKey] = [];
        }
        // TODO: Implement full handler logic including:
        // - Better error handling
        // - Message validation
        // - Reply timeout handling
        const handler1 = async (message: SealxRequest) => {
            // console.log(message, '----------- message sealx request -----', this.id)
            if ((message.topic === topic || topic === SealxTopic.ALL) && (channel === MessageChannel.ALL || channel === message.sender)) {
                try {
                    return await handler(message, (res: any, end: boolean = false) => {
                        this.reply(res, message, end)
                    })

                } catch (e) {
                    this.replyError(e, message)
                }
            }
        }
        this.handlers[topicKey].push(handler1);
        // 返回取消订阅函数
        return () => {
            this.handlers[topicKey] = this.handlers[topicKey].filter((h) => h !== handler1);
        };
    };

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
    off: OffMessageListener = (topic: SealxTopic, callback: MessageHandle, channel?: MessageChannel) => {
        channel = channel ?? MessageChannel.ALL;
        const topicKey = this.topic(channel, topic);

        if (!this.handlers[topicKey]) {
            return;
        }

        // Remove the handler
        this.handlers[topicKey] = this.handlers[topicKey].filter(h => h !== callback);
    };

    public onForward(receiver: MessageChannel, handle: MessageHandle) {
        this.forwardHandlers[receiver] = handle
    }
}

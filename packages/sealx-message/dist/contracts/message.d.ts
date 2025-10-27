import { SignContent } from 'sealx-core';
export type Topic = string;
/**
 * Defines the header structure for Sealx messages.
 *
 * @template Action - The type of action, defaults to SealxRequestAction.
 * @property host - The originating website host.
 * @property requestId - Unique identifier for the request.
 * @property sessionId - Identifier for the session associated with the request.
 * @property action - The action to be performed, of type Action.
 */
export interface SealxHeader {
    host: string;
    userId?: string;
    requestId: string;
    sessionId: string;
    messagerId: string;
    tabId?: number;
}
export interface SealxTopicEvent<T = Topic> {
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
export interface SignTask {
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
export interface SignTaskMessage {
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
export interface ConnectionRequestMessage {
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
export interface SignResult {
    taskId: string;
    signature: string;
}
/**
 * Represents a response message for a signing operation.
 *
 * @property {SignResult} result - The result of the sign operation.
 */
export interface SignResponseMessage {
    result: SignResult;
}
/**
 * Represents a connection session with a unique session ID and expiration time.
 *
 * @property sessionId - The unique identifier for the session.
 * @property expire - The expiration timestamp (in milliseconds since epoch) for the session.
 */
export interface ConnectionSession {
    sessionId: string;
    address: string;
    expire: number;
}
/**
 * Represents a response message for a connection request.
 *
 * @property result - The session information associated with the connection.
 */
export interface ConnectionResponseMessage {
    result: ConnectionSession;
}

import { MessageChannel, SealxTopic } from "../enums";
import { ConnectionRequestMessage, SealxHeader, SealxTopicEvent, SignTaskMessage, SignResponseMessage } from "./message";
/**
 * Base interface for all Sealx request types
 * @template T - Type of the payload (defaults to RequestMessage)
 * @template Action - Type of the action (defaults to SealxTopic)
 */
export interface SealxRequest<M = any, T = SealxTopic, R = never> extends SealxTopicEvent<T> {
    header: SealxHeader;
    receiver: MessageChannel;
    sender: MessageChannel;
    once?: boolean;
    payload: M;
    reply?: (res: R) => void;
}
/**
 * Request type for signing operations
 * @remarks Can be used for both single and batch signing operations
 */
export type SignRequest = SealxRequest<SignTaskMessage, SealxTopic, SignResponseMessage>;
/**
 * Request type for establishing a new connection
 */
export type ConnectionRequest = SealxRequest<ConnectionRequestMessage, SealxTopic>;
/**
 * Request type for deleting existing signatures
 * @remarks Payload is an array of signature IDs to delete
 */
export type DelSignRequest = SealxRequest<string[], SealxTopic>;
/**
 * Request type for disconnecting an active session
 * @remarks Payload is the session ID to disconnect
 */
export type DisconnectRequest = SealxRequest<string, SealxTopic>;

import { SealxSignTask } from 'sealx-core';
export * from 'sealx-core';
import { MessageHandle } from 'sealx-message';

/**
 * Checks if SealX extension is installed and active
 * @returns {boolean} True if extension is installed and active
 */
declare const isSealxActive: () => boolean;
/**
 * Initializes the SealX session for a user
 * @param {string} userId - The user ID to initialize the session for
 * @returns {Promise<void>}
 * @throws {SealxUnavailableException} If SealX extension is not available
 * @throws {SessionException} If session initialization fails
 */
declare const initSealx: (userId: string | number) => Promise<void>;
/**
 * Connects to SealX extension and establishes a session
 * @param {string} [uId=''] - Optional user ID if account not initialized
 * @returns {Promise<void>}
 * @throws {SessionException} If connection fails
 */
declare const connectSealx: (uId?: string | number) => Promise<void>;
/**
 * Binds a public key to the current SealX account
 * @returns {Promise<string>} The bound public key
 * @throws {SealxUnavailableException} If SealX extension is not available
 * @throws {SealxUninitializedException} If SealX plugin is not initialized
 * @throws {Error} If binding fails
 */
declare const bindSealx: (userId?: string | number) => Promise<string>;
/**
 * Signs one or more tasks using SealX service
 * @template T - Type of the expected payload
 * @param {SealxSignTask | SealxSignTask[]} task - Single task or array of tasks to sign
 * @returns {Promise<T | AsyncGenerator<T>>}
 *   - For single task: Promise resolving to the payload
 *   - For batch tasks: AsyncGenerator yielding payloads as they become available
 * @throws {Error} When signing fails or no payload is received
 */
declare const signBySealx: <T = unknown>(task: SealxSignTask | SealxSignTask[], userId?: string | number) => Promise<T | AsyncGenerator<T> | undefined>;
/**
 * Checks if a valid SealX session exists and is not expired
 * @returns {boolean} True if session is available and valid
 */
declare const isSessionAvailable: () => boolean;
declare const sealxActive: () => boolean;
/**
 * Sends a sign response message for a completed signing operation
 * @param {string} taskId - The ID of the task that was signed
 * @param {string} [error=''] - Optional error message if signing failed
 * @returns {Promise<any>} The response payload from the extension
 * @throws {SignException} If the response contains an error or no payload
 */
declare const sendSignResponse: (taskId: string, error?: string, userId?: string | number) => Promise<any>;
/**
 * Sends a remote sign command to the extension from an external page
 * @param {string | number} taskId - The ID of the task to sign or reject
 * @param {boolean} [rejected=false] - Whether to reject the signing request
 * @returns {Promise<any>} The response payload from the extension
 * @throws {SignException} If the response contains an error or no payload
 */
declare const remoteSign: (taskId: string | number, rejected?: boolean) => Promise<any>;
/**
 * Sets up an event listener for sign response messages for specific task IDs
 *
 * @remarks
 * This function allows you to listen for sign response messages from the SealX extension
 * and handle them only when they match the specified task ID(s). Useful for tracking
 * the status of specific signing operations.
 *
 * @param taskId - Single task ID or array of task IDs to listen for. Can be string, number, or array of strings/numbers
 * @param callback - Callback function to handle the sign response message
 * @returns A cleanup function that removes the event listener when called
 *
 * @example
 * ```typescript
 * // Listen for a single task ID
 * const cleanup = onSign( (request, reply) => {
 *   console.log('Sign response received:', request.payload);
 * },'task-123');
 *
 * const cleanup = onSign( (request, reply) => {
 *   console.log('Sign response received:', request.payload);
 * });
 *
 * // Listen for multiple task IDs
 * const cleanup = onSign((request, reply) => {
 *   console.log('Sign response received:', request.payload);
 * },['task-123', 'task-456']);
 *
 * // Clean up listener when no longer needed
 * cleanup();
 * ```
 */
declare const onSign: (callback: MessageHandle, taskId?: any) => () => void;
declare const closeSealx: () => void;
declare const checkSealx: () => Promise<string | null>;

export { bindSealx, checkSealx, closeSealx, connectSealx, initSealx, isSealxActive, isSessionAvailable, onSign, remoteSign, sealxActive, sendSignResponse, signBySealx };

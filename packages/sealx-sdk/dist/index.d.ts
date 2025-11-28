import { SealxSignTask } from 'sealx-core';
export * from 'sealx-core';
import { MessageHandle } from 'sealx-message';

/**
 * Checks if SealX browser extension is installed and active
 *
 * @remarks
 * This function verifies that the SealX extension is both installed in the browser
 * and currently active. It should be called before attempting any SealX operations.
 *
 * @returns {boolean} True if the SealX extension is installed and active, false otherwise
 *
 * @example
 * ```typescript
 * if (isSealxActive()) {
 *   // Proceed with SealX operations
 *   await initSealx('user-123');
 * } else {
 *   console.warn('SealX extension is not available');
 * }
 * ```
 */
declare const isSealxActive: () => Promise<boolean>;
/**
 * Initializes the SealX session for a user
 *
 * @remarks
 * This function sets up the initial session with the SealX browser extension.
 * It should be called before any other SealX operations. The function will:
 * - Check if the SealX extension is available and active
 * - Initialize the session if it doesn't exist or has expired
 * - Set up the user account with the provided user ID
 * - Configure the message session for communication
 *
 * @param {string | number} userId - The unique identifier for the user. This ID will be associated with the SealX session.
 * @returns {Promise<void>} A promise that resolves when initialization is complete
 * @throws {SealxUnavailableException} If SealX extension is not installed or not active
 * @throws {SessionException} If session initialization fails due to communication issues
 * @throws {Error} If the user ID is not provided or other unexpected errors occur
 *
 * @example
 * ```typescript
 * try {
 *   await initSealx('user-123');
 *   console.log('SealX session initialized successfully');
 * } catch (error) {
 *   console.error('Failed to initialize SealX session:', error);
 * }
 * ```
 */
declare const initSealx: (userId: string | number) => Promise<void>;
/**
 * Connects to SealX extension and establishes a session
 *
 * @remarks
 * This function establishes a connection with the SealX browser extension and creates a session.
 * It should be called when you need to re-establish a connection or when the session has expired.
 * The function will:
 * - Verify the SealX extension is active
 * - Send a connection request to the extension background
 * - Initialize the session and account with the response data
 * - Configure the message session for communication
 *
 * @param {string | number} [uId=''] - Optional user ID to use if the account is not already initialized.
 * If provided and different from the current account, it will update the account user ID.
 * @returns {Promise<void>} A promise that resolves when the connection is established
 * @throws {SealxUnavailableException} If SealX extension is not installed or not active
 * @throws {SealxUninitializedException} If SealX plugin is not properly initialized
 * @throws {SessionException} If connection fails due to communication issues or invalid response
 *
 * @example
 * ```typescript
 * try {
 *   await connectSealx('user-123');
 *   console.log('Connected to SealX extension successfully');
 * } catch (error) {
 *   console.error('Failed to connect to SealX extension:', error);
 * }
 * ```
 */
declare const connectSealx: (uId?: string | number) => Promise<void>;
/**
 * Binds a public key to the current SealX account
 *
 * @remarks
 * This function initiates the public key binding process with the SealX extension.
 * It opens the extension popup to allow the user to generate or import a public key.
 * The function will:
 * - Verify the SealX extension is active and initialized
 * - Ensure a valid session exists
 * - Send a public key binding request to the extension
 * - Store the returned public key in the account
 *
 * @param {string | number} [userId] - Optional user ID to use for binding.
 * If provided and different from the current account, it will update the account user ID.
 * @returns {Promise<string>} A promise that resolves to the bound public key string
 * @throws {SealxUnavailableException} If SealX extension is not installed or not active
 * @throws {SealxUninitializedException} If SealX plugin is not properly initialized
 * @throws {Error} If binding fails due to communication issues or no response payload
 *
 * @example
 * ```typescript
 * try {
 *   const publicKey = await bindSealx('user-123');
 *   console.log('Public key bound successfully:', publicKey);
 * } catch (error) {
 *   console.error('Failed to bind public key:', error);
 * }
 * ```
 */
declare const bindSealx: (userId?: string | number) => Promise<string>;
/**
 * Signs one or more tasks using SealX service
 *
 * @remarks
 * This is the main signing function that allows you to sign documents or data using the SealX extension.
 * It supports both single tasks and batch processing. The function will:
 * - Verify the SealX extension is active and initialized
 * - Ensure a valid session exists and is not expired
 * - Check for public key consistency
 * - Send the signing request to the extension
 * - Handle both single and batch signing operations
 *
 * @template T - The type of the expected payload returned from the signing operation
 * @param {SealxSignTask | SealxSignTask[]} task - Single task or array of tasks to sign.
 * Each task should contain the necessary data for signing, including task ID and document content.
 * @param {string | number} [userId] - Optional user ID to use for signing.
 * If provided and different from the current account, it will update the account user ID.
 * @returns {Promise<T | AsyncGenerator<T> | undefined>}
 *   - For single task: Promise resolving to the signed payload of type T
 *   - For batch tasks: AsyncGenerator that yields signed payloads as they become available
 *   - Returns undefined only in error cases where SignException is thrown
 * @throws {SealxUnavailableException} If SealX extension is not installed or not active
 * @throws {SealxUninitializedException} If SealX plugin is not properly initialized
 * @throws {PkException} If there's a public key mismatch between current and registered keys
 * @throws {SignException} If signing fails or no payload is received from the extension
 * @throws {Error} For other unexpected errors during the signing process
 *
 * @example
 * ```typescript
 * // Single task signing
 * try {
 *   const signature = await signBySealx({
 *     taskId: 'doc-123',
 *     data: 'document content to sign',
 *     type: 'text'
 *   });
 *   console.log('Document signed successfully:', signature);
 * } catch (error) {
 *   console.error('Signing failed:', error);
 * }
 *
 * // Batch task signing
 * try {
 *   const signatures = signBySealx([
 *     { taskId: 'doc-1', data: 'document 1' },
 *     { taskId: 'doc-2', data: 'document 2' },
 *     { taskId: 'doc-3', data: 'document 3' }
 *   ]);
 *
 *   if (signatures && typeof signatures[Symbol.asyncIterator] === 'function') {
 *     for await (const signature of signatures) {
 *       console.log('Received signature:', signature);
 *     }
 *   }
 * } catch (error) {
 *   console.error('Batch signing failed:', error);
 * }
 * ```
 */
declare const signBySealx: <T = unknown>(task: SealxSignTask | SealxSignTask[], userId?: string | number) => Promise<T | AsyncGenerator<T> | undefined>;
/**
 * Checks if a valid SealX session exists and is not expired
 *
 * @remarks
 * This function verifies that a valid session exists and has not expired.
 * It's useful for checking session status without attempting to re-establish a connection.
 *
 * @returns {boolean} True if a valid session exists and is not expired, false otherwise
 *
 * @example
 * ```typescript
 * if (isSessionAvailable()) {
 *   // Session is valid, proceed with operations
 *   await signBySealx(task);
 * } else {
 *   // Session expired, need to reconnect
 *   await connectSealx();
 * }
 * ```
 */
declare const isSessionAvailable: () => boolean;
/**
 * @deprecated Use {@link isSealxActive} instead
 * @returns {boolean} True if SealX extension is installed and active
 */
declare const sealxActive: () => Promise<boolean>;
/**
 * Sends a sign response message for a completed signing operation
 *
 * @remarks
 * This function is typically used internally to send response messages back to the extension
 * after processing sign requests. It confirms that a signing operation has been completed.
 *
 * @param {string} taskId - The unique identifier of the task that was signed
 * @param {string} [error=''] - Optional error message if the signing operation failed
 * @param {string | number} [userId] - Optional user ID to use for the response
 * @returns {Promise<any>} The response payload from the extension
 * @throws {SealxUnavailableException} If SealX extension is not installed or not active
 * @throws {SealxUninitializedException} If SealX plugin is not properly initialized
 * @throws {SignException} If the response contains an error or no payload is received
 *
 * @example
 * ```typescript
 * try {
 *   const response = await sendSignResponse('task-123');
 *   console.log('Sign response sent successfully:', response);
 * } catch (error) {
 *   console.error('Failed to send sign response:', error);
 * }
 * ```
 */
declare const sendSignResponse: (taskId: string, error?: string, userId?: string | number) => Promise<any>;
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
/**
 * Closes the SealX extension connection
 *
 * @remarks
 * This function sends a close message to the SealX extension background service.
 * It can be used to clean up resources and notify the extension that the connection is ending.
 *
 * @example
 * ```typescript
 * // Clean up before page unload
 * window.addEventListener('beforeunload', () => {
 *   closeSealx();
 * });
 * ```
 */
declare const closeSealx: () => void;
/**
 * Checks if the SealX extension is initialized and ready
 *
 * @remarks
 * This function performs a health check on the SealX extension by sending a check message
 * to the background service. It attempts multiple times (with retry logic) to ensure
 * reliable detection of the extension's initialization status.
 *
 * @returns {Promise<string | null>} A promise that resolves to:
 *   - The extension status payload if initialized and ready
 *   - null if the extension is not available or not initialized
 *
 * @example
 * ```typescript
 * const status = await checkSealx();
 * if (status) {
 *   console.log('SealX extension is ready:', status);
 * } else {
 *   console.log('SealX extension is not available');
 * }
 * ```
 */
declare const checkSealx: () => Promise<string | null>;

export { bindSealx, checkSealx, closeSealx, connectSealx, initSealx, isSealxActive, isSessionAvailable, onSign, sealxActive, sendSignResponse, signBySealx };

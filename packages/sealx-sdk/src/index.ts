import { SealxProvider, SealxSignTask, wait } from 'sealx-core';
import { MessageChannel, MessagerManager, SealxTopic } from 'sealx-message';
import PkException from './exceptions/PkException';
import SignException from './exceptions/SignException';
import SessionException from './exceptions/SessionException';
import SealxUnavailableException from './exceptions/SealxUnavailableException';
import SealxUninitializedException from './exceptions/SealxUninitializedException';
import { MessageHandle } from 'sealx-message';
import { SealxRequest } from 'sealx-message';

export * from 'sealx-core';

/**
 * @file SealX SDK main module
 * @module sealx-sdk
 * @description Provides core functionality for interacting with SealX browser extension
 * including session management, account initialization, public key binding, and document signing.
 */

/**
 * Initializes the SealX SDK by registering the provider
 * and setting up the global sealxSigner and messager instances
 */
// Initialize global instances
SealxProvider.register();
const sealxSigner = window.sealxSigner;
const messager = MessagerManager.getMessager();

// Constants for better maintainability
const CHANNEL_POPUP = MessageChannel.POPUP;
const CHANNEL_BACKGROUND = MessageChannel.BACKGROUND;

/**
 * Checks if SealX extension is installed and active
 * @returns {boolean} True if extension is installed and active
 */
export const isSealxActive = () => {
    return sealxSigner?.installed && sealxSigner?.active;
};

/**
 * Initializes the SealX session for a user
 * @param {string} userId - The user ID to initialize the session for
 * @returns {Promise<void>}
 * @throws {SealxUnavailableException} If SealX extension is not available
 * @throws {SessionException} If session initialization fails
 */
export const initSealx = async (userId: string | number): Promise<void> => {
    if (!userId) {
        throw new Error(
            'User ID is required to initialize SealX session. Please provide a valid user ID.'
        );
    }
    sealxSigner.active = (await checkSealx()) !== null;
    // Check if SealX is active first
    if (!isSealxActive()) {
        throw new SealxUnavailableException(
            'SealX extension is not installed or not active. Please install the SealX browser extension.'
        );
    }

    try {
        if (
            !sealxSigner.session ||
            sealxSigner.session.expire < Date.now() ||
            !sealxSigner.account
        ) {
            await sealxSigner.initialize();
        }

        if (!sealxSigner.account || sealxSigner.account.userId != userId) {
            await sealxSigner.initializeAccount({
                userId,
                email: '',
                userName: '',
            });
        }

        if (
            sealxSigner.session &&
            sealxSigner.session.expire > Date.now() &&
            sealxSigner.session.userId
        ) {
            messager.session = sealxSigner.session;
        }
    } catch (error) {
        console.error('SealX initialization failed:', error);
        if (
            error instanceof SealxUnavailableException ||
            error instanceof SessionException
        ) {
            throw error;
        }
        throw new Error(
            `SealX initialization failed: ${error instanceof Error ? error.message : String(error)
            }`
        );
    }
};

/**
 * Connects to SealX extension and establishes a session
 * @param {string} [uId=''] - Optional user ID if account not initialized
 * @returns {Promise<void>}
 * @throws {SessionException} If connection fails
 */
export const connectSealx = async (
    uId: string | number = ''
): Promise<void> => {
    const title = document.title;
    // const userId = sealxSigner.account?.userId ?? uId;
    if (uId && uId != sealxSigner.account?.userId) {
        sealxSigner.account = {
            userId: uId,
        };
    }
    if (!isSealxActive()) {
        throw new SealxUnavailableException(
            'SealX extension is not installed or not active'
        );
    }

    // Initialize if needed
    if (!sealxSigner.account?.userId) {
        throw new SealxUninitializedException(
            'SealX plugin not initialized. Please call initSealx() or connectSealx() first.'
        );
    }

    const userId = sealxSigner.account.userId;

    if (
        !sealxSigner.session ||
        sealxSigner.session.expire < Date.now() ||
        !sealxSigner.account
    ) {
        try {
            const res = await messager.send(
                { userId, title },
                SealxTopic.CONNECT,
                CHANNEL_BACKGROUND
            );

            if (!res?.payload?.session || !res?.payload?.account) {
                throw new SessionException('Invalid connection response');
            }
            sealxSigner.connected = true;
            await sealxSigner.initializeSession(res.payload.session);
            await sealxSigner.initializeAccount(res.payload.account);
        } catch (error) {
            console.error('Connection failed:', error);
            throw new SessionException('Failed to connect to SealX extension');
        }
    }

    if (sealxSigner.session) {
        messager.session = sealxSigner.session;
    }
};

/**
 * Binds a public key to the current SealX account
 * @returns {Promise<string>} The bound public key
 * @throws {SealxUnavailableException} If SealX extension is not available
 * @throws {SealxUninitializedException} If SealX plugin is not initialized
 * @throws {Error} If binding fails
 */
export const bindSealx = async (userId?: string | number): Promise<string> => {
    // Check if SealX is active first
    if (!isSealxActive()) {
        throw new SealxUnavailableException(
            'SealX extension is not installed or not active'
        );
    }

    if (userId && userId != sealxSigner.account?.userId) {
        // await initSealx(userId)
        sealxSigner.account = {
            userId,
        };
    }

    // Initialize if needed
    if (!sealxSigner.account?.userId) {
        throw new SealxUninitializedException(
            'SealX plugin not initialized. Please call initSealx() or connectSealx() first.'
        );
    }

    if (
        !sealxSigner.session ||
        !sealxSigner.account ||
        sealxSigner.session.expire < Date.now()
    ) {
        await connectSealx();
    }

    if (sealxSigner.account) {
        try {
            const res = await messager.send(
                sealxSigner.account.userId,
                SealxTopic.BIND_PK,
                CHANNEL_POPUP
            );
            if (!res?.payload) {
                throw new Error(
                    'Failed to bind public key: No response payload received'
                );
            }
            sealxSigner.account.newPk = '';
            sealxSigner.account.pk = res.payload;
            return res.payload as string;
        } catch (error) {
            console.error('Public key binding failed:', error);
            throw new Error(
                `Failed to bind public key: ${error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    throw new Error('SealX account not available for binding');
};

/**
 * Signs one or more tasks using SealX service
 * @template T - Type of the expected payload
 * @param {SealxSignTask | SealxSignTask[]} task - Single task or array of tasks to sign
 * @returns {Promise<T | AsyncGenerator<T>>}
 *   - For single task: Promise resolving to the payload
 *   - For batch tasks: AsyncGenerator yielding payloads as they become available
 * @throws {Error} When signing fails or no payload is received
 */
export const signBySealx = async <T = unknown>(
    task: SealxSignTask | SealxSignTask[],
    userId?: string | number
): Promise<T | AsyncGenerator<T> | undefined> => {
    if (!isSealxActive()) {
        throw new SealxUnavailableException(
            'SealX extension is not installed or not active'
        );
    }
    if (userId && userId != sealxSigner.account?.userId) {
        // await initSealx(userId)
        sealxSigner.account = {
            userId,
        };
    }
    // Initialize if needed
    if (!sealxSigner.account?.userId) {
        throw new SealxUninitializedException(
            'SealX plugin not initialized. Please call initSealx() or connectSealx() first.'
        );
    }

    if (!sealxSigner.session || sealxSigner.session.expire < Date.now()) {
        await connectSealx();
    }
    if (
        sealxSigner.account?.newPk &&
        sealxSigner.account.newPk !== sealxSigner.account.pk
    ) {
        throw new PkException(
            'Public key mismatch - new key does not match registered key'
        );
    }
    try {
        if (Array.isArray(task)) {
            // For batch tasks, create an async generator that processes the stream
            const responseStream = messager.sendStream(
                task,
                SealxTopic.BATCH_SIGN,
                CHANNEL_POPUP
            );
            return (async function* () {
                for await (const response of responseStream) {
                    if (!response?.payload) {
                        throw new SignException(response?.error ?? '');
                    }
                    yield response.payload as T;
                }
            })();
        } else {
            // For single task, await the direct response
            const res = await messager.send(
                task,
                SealxTopic.SIGN,
                CHANNEL_POPUP
            );
            if (!res?.payload) {
                throw new SignException(res?.error ?? '');
            }
            // if(res.header.){}
            return res.payload as T;
        }
    } catch (error) {
        console.error('Signing failed:', error);
        if (!(error instanceof SignException))
            throw new Error(
                `Signing failed: ${error instanceof Error ? error.message : String(error)
                }`
            );
    }
};

/**
 * Checks if a valid SealX session exists and is not expired
 * @returns {boolean} True if session is available and valid
 */
export const isSessionAvailable = (): boolean => {
    return !!sealxSigner.session && sealxSigner.session.expire >= Date.now();
};

// Deprecated - use isSealxActive() instead
export const sealxActive = isSealxActive;

/**
 * Sends a sign response message for a completed signing operation
 * @param {string} taskId - The ID of the task that was signed
 * @param {string} [error=''] - Optional error message if signing failed
 * @returns {Promise<any>} The response payload from the extension
 * @throws {SignException} If the response contains an error or no payload
 */
export const sendSignResponse = async (
    taskId: string,
    error: string = '',
    userId?: string | number
): Promise<any> => {
    if (!isSealxActive()) {
        throw new SealxUnavailableException(
            'SealX extension is not installed or not active'
        );
    }

    if (userId && userId != sealxSigner.account?.userId) {
        // await initSealx(userId)
        sealxSigner.account = {
            userId,
        };
    }
    // Initialize if needed
    if (!sealxSigner.account?.userId) {
        throw new SealxUninitializedException(
            'SealX plugin not initialized. Please call initSealx() or connectSealx() first.'
        );
    }

    const res = await messager.send(
        {
            taskId,
            error,
        },
        SealxTopic.SIGN_RESPONSE,
        CHANNEL_POPUP
    );
    if (!res?.payload) {
        throw new SignException(res?.error ?? '');
    }
    return res.payload;
};

/**
 * Sends a remote sign command to the extension from an external page
 * @param {string | number} taskId - The ID of the task to sign or reject
 * @param {boolean} [rejected=false] - Whether to reject the signing request
 * @returns {Promise<any>} The response payload from the extension
 * @throws {SignException} If the response contains an error or no payload
 */
export const remoteSign = async (
    taskId: string | number,
    rejected: boolean = false
): Promise<any> => {
    const res = await messager.send(
        {
            taskId,
            rejected,
        },
        SealxTopic.REMOTE_SIGN,
        CHANNEL_POPUP
    );
    if (!res?.payload) {
        throw new SignException(res?.error ?? '');
    }
    return res.payload;
};

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
export const onSign = (callback: MessageHandle, taskId?: any) => {
    const handle: MessageHandle = async (
        request: SealxRequest<{ taskId: string; signatures: any[] }>,
        reply?: (res: any) => void
    ) => {
        const taskIds = (
            taskId instanceof Array ? taskId : !!taskId ? [taskId] : []
        ).map((t) => t + '');
        if (
            request.payload &&
            (taskIds.length === 0 ||
                taskIds.includes(request.payload.taskId + ''))
        ) {
            try {
                await callback(request, reply);
                sendSignResponse(request.payload.taskId);
            } catch (e) {
                const error = e instanceof Error ? e.message : String(e);
                sendSignResponse(request.payload.taskId, error);
            }
        }
    };
    const off = messager.on(SealxTopic.SIGN_RESPONSE, handle, CHANNEL_POPUP);
    return () => off();
};

export const closeSealx = () => {
    messager.send('', SealxTopic.CLOSE, MessageChannel.BACKGROUND);
};

export const checkSealx = async (): Promise<string | null> => {
    return new Promise<string | null>(async (resolve) => {
        try {
            let time = 3;
            let checked: any = null
            while (time > 0) {
                if (checked) {
                    return
                }
                messager
                    .send(
                        '',
                        SealxTopic.CHECK_INITIALIZED,
                        MessageChannel.BACKGROUND
                    )
                    .then((res) => {
                        resolve(res.payload);
                        checked = true
                    })
                    .catch(() => {
                        resolve(null);
                    });
                await wait(100)
                time--
            }
            resolve(null)
        } catch (e) {
            resolve(null);
        }
    });
};

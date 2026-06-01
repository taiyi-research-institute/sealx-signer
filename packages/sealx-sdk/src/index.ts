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
export * from 'sealx-message';

/**
 * @file SealX SDK main module
 * @module sealx-sdk
 * @description Provides core functionality for interacting with SealX browser extension
 * including session management, account initialization, public key binding, and document signing.
 * 
 * @example
 * ```typescript
 * import { initSealx, bindSealx, signBySealx } from 'sealx-sdk';
 * 
 * // Initialize session
 * await initSealx('user-123');
 * 
 * // Bind public key
 * const publicKey = await bindSealx();
 * 
 * // Sign a document
 * const signature = await signBySealx({
 *   taskId: 'doc-123',
 *   data: 'document content'
 * });
 * ```
 */

/**
 * Global instances for SealX SDK
 * @private
 */
// Initialize global instances
SealxProvider.register();
const sealxSigner = window.sealxSigner;
const messager = MessagerManager.getMessager();

messager.on(SealxTopic.CHECK_INITIALIZED, async (request: SealxRequest<string>) => {
    // callback(request.payload)
    if (request.payload) {
        sealxSigner.activate()
    } else {
        sealxSigner.deactivate()
    }
}, MessageChannel.BACKGROUND)

/**
 * Message channel constants for communication with SealX extension
 * @private
 */
const CHANNEL_POPUP = MessageChannel.POPUP;
const CHANNEL_BACKGROUND = MessageChannel.BACKGROUND;

/**
 * 自动扫描页面中带 sealx 属性的元素，添加 data-sealx-action="open"
 * 供 content script 的事件委托监听使用，实现点击 → sidePanel.open()
 */
const SEALX_ACTION_ATTR = 'data-sealx-action';
const SEALX_ACTION_VALUE = 'open';
const SEALX_SOURCE_ATTR = 'sealx-component';

export const setupSealxActions = () => {
    document.querySelectorAll(`[${SEALX_SOURCE_ATTR}]`).forEach((el) => {
        if (!el.hasAttribute(SEALX_ACTION_ATTR)) {
            el.setAttribute(SEALX_ACTION_ATTR, SEALX_ACTION_VALUE);
        }
    });
};

// DOMContentLoaded 时扫描已渲染的元素
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSealxActions);
} else {
    setupSealxActions();
}

const sealxId = () => {
  const time = Date.now().toString(16);
  const random = Math.floor(Math.random() * 1e6).toString(16);
  return `sealx-${time}-${random}`;
};
// MutationObserver: 监听后续动态添加的 sealx 元素
const sealxObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
                if (node.hasAttribute && node.hasAttribute(SEALX_SOURCE_ATTR)) {
                    if (!node.hasAttribute(SEALX_ACTION_ATTR)) {
                        node.setAttribute(SEALX_ACTION_ATTR, SEALX_ACTION_VALUE);
                        node.setAttribute('data-sealx-id', sealxId());
                        window.postMessage(
                          {
                            type: 'sealx-element-updated',
                            'data-sealx-id': node.getAttribute('data-sealx-id'),
                          },
                          '*',
                        );
                    }
                }
                // 同时扫描子节点
                if (node.querySelectorAll) {
                    node.querySelectorAll(`[${SEALX_SOURCE_ATTR}]`).forEach((el) => {
                        if (!el.hasAttribute(SEALX_ACTION_ATTR)) {
                            el.setAttribute(SEALX_ACTION_ATTR, SEALX_ACTION_VALUE);
                            el.setAttribute('data-sealx-id', sealxId());
                            window.postMessage(
                              {
                                type: 'sealx-element-updated',
                                'data-sealx-id':
                                  el.getAttribute('data-sealx-id'),
                              },
                              '*',
                            );
                        }
                    });
                }
            }
        });
        // 属性变更也可能添加 sealx
        if (mutation.type === 'attributes' && mutation.attributeName === SEALX_SOURCE_ATTR) {
            const el = mutation.target as HTMLElement;
            if (el.hasAttribute(SEALX_SOURCE_ATTR) && !el.hasAttribute(SEALX_ACTION_ATTR)) {
                el.setAttribute(SEALX_ACTION_ATTR, SEALX_ACTION_VALUE);
                el.setAttribute('data-sealx-id', sealxId());
                window.postMessage(
                  {
                    type: 'sealx-element-updated',
                    'data-sealx-id': el.getAttribute('data-sealx-id'),
                  },
                  '*',
                );
            }
        }
    }
});

sealxObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [SEALX_SOURCE_ATTR],
});

/**
 * Cache for SealX extension status to reduce redundant checks
 * @private
 */
let sealxStatusCache: {
    isActive: boolean;
    timestamp: number;
} | null = null;
const CACHE_TTL = 5000; // 5 seconds cache TTL

/**
 * Checks if SealX browser extension is installed and active
 * 
 * @remarks
 * This function verifies that the SealX extension is both installed in the browser
 * and currently active. It should be called before attempting any SealX operations.
 * Uses caching to reduce redundant checks (5-second TTL).
 * 
 * @returns {Promise<boolean>} True if the SealX extension is installed and active, false otherwise
 * 
 * @example
 * ```typescript
 * if (await isSealxActive()) {
 *   // Proceed with SealX operations
 *   await initSealx('user-123');
 * } else {
 *   console.warn('SealX extension is not available');
 * }
 * ```
 */
export const isSealxActive = async (): Promise<boolean> => {
    // Check cache first
    const now = Date.now();
    if (sealxStatusCache && (now - sealxStatusCache.timestamp) < CACHE_TTL) {
        return sealxStatusCache.isActive;
    }

    const isActive = (await checkSealx()) !== null;
    sealxSigner.active = isActive;
    if (isActive && !sealxSigner.installed) {
        sealxSigner.installed = true;
        void sealxSigner.storageWrapper.setItem('installed', true);
    }

    // Update cache
    sealxStatusCache = {
        isActive,
        timestamp: now
    };

    return isActive;
};

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
 *   if (error instanceof SealxUnavailableException) {
 *     console.error('Please install the SealX browser extension');
 *   } else if (error instanceof SessionException) {
 *     console.error('Failed to establish session:', error.message);
 *   } else {
 *     console.error('Unexpected error:', error);
 *   }
 * }
 * ```
 */
export const initSealx = async (userId: string | number): Promise<void> => {
    if (!userId) {
        throw new Error(
            'User ID is required to initialize SealX session. Please provide a valid user ID.'
        );
    }
    sealxSigner.active = (await checkSealx()) !== null;
    // Check if SealX is active first
    if (!(await isSealxActive())) {
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
 *   if (error instanceof SealxUnavailableException) {
 *     console.error('SealX extension is not available');
 *   } else if (error instanceof SealxUninitializedException) {
 *     console.error('Please initialize SealX first');
 *   } else if (error instanceof SessionException) {
 *     console.error('Connection failed:', error.message);
 *   }
 * }
 * ```
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
    if (!(await isSealxActive())) {
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

    console.warn('[TRACE-CONNECT:SDK] connectSealx sending', {
        payloadUserId: userId,
        headerHost: messager.host,
        title,
        hasSession: !!sealxSigner.session,
        sessionUserId: sealxSigner.session?.userId,
        sessionHost: sealxSigner.session?.host,
        sessionExpire: sealxSigner.session?.expire,
    });

    try {
            const res = await messager.send(
                { userId, title },
                SealxTopic.CONNECT,
                CHANNEL_BACKGROUND
            );

            if (!res?.payload?.session || !res?.payload?.account) {
                console.warn('[TRACE-CONNECT:SDK] connectSealx response INVALID', { payload: res?.payload })
                throw new SessionException('Invalid connection response');
            }
            console.warn('[TRACE-CONNECT:SDK] connectSealx response received', {
                sessionUserId: res.payload.session?.userId,
                sessionHost: res.payload.session?.host,
                sessionExpire: res.payload.session?.expire,
                accountUserId: res.payload.account?.userId,
                accountHost: res.payload.account?.host,
            });
            sealxSigner.connected = true;
            await sealxSigner.initializeSession(res.payload.session);
            await sealxSigner.initializeAccount(res.payload.account);
        } catch (error) {
            console.error('Connection failed:', error);
            throw new SessionException('Failed to connect to SealX extension');
        }

    if (sealxSigner.session) {
        messager.session = sealxSigner.session;
    }
};

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
 *   if (error instanceof SealxUnavailableException) {
 *     console.error('SealX extension is not available');
 *   } else if (error instanceof SealxUninitializedException) {
 *     console.error('Please initialize SealX first');
 *   } else {
 *     console.error('Failed to bind public key:', error.message);
 *   }
 * }
 * ```
 */
export const bindSealx = async (userId?: string | number): Promise<string> => {
    // Check if SealX is active first
    if (!(await isSealxActive())) {
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

    await connectSealx();
    messager.session = sealxSigner.session!;
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
            closeSealx()
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
 *   if (error instanceof SealxUnavailableException) {
 *     console.error('SealX extension is not available');
 *   } else if (error instanceof PkException) {
 *     console.error('Public key mismatch:', error.message);
 *   } else if (error instanceof SignException) {
 *     console.error('Signing failed:', error.message);
 *   } else {
 *     console.error('Unexpected error:', error);
 *   }
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
export const signBySealx = async <T = unknown>(
    task: SealxSignTask | SealxSignTask[],
    userId?: string | number
): Promise<T | AsyncGenerator<T> | undefined> => {
    if (!(await isSealxActive())) {
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

    await connectSealx();
    messager.session = sealxSigner.session!;
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
export const isSessionAvailable = (): boolean => {
    return !!sealxSigner.session && sealxSigner.session.expire >= Date.now();
};

/**
 * @deprecated Use {@link isSealxActive} instead
 * @returns {boolean} True if SealX extension is installed and active
 */
export const sealxActive = isSealxActive;

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
 *   if (error instanceof SealxUnavailableException) {
 *     console.error('SealX extension is not available');
 *   } else if (error instanceof SealxUninitializedException) {
 *     console.error('Please initialize SealX first');
 *   } else if (error instanceof SignException) {
 *     console.error('Sign response failed:', error.message);
 *   }
 * }
 * ```
 */
export const sendSignResponse = async (
    taskId: string,
    error: string = '',
    userId?: string | number
): Promise<any> => {
    if (!(await isSealxActive())) {
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

    // 签名响应已成功发送给插件，延迟发送关闭消息通知 background 关闭 popup
    // 延迟 500ms 确保 SIGN_RESPONSE 先到达 popup 处理完成
    setTimeout(() => {
        try {
            messager.send('', SealxTopic.CLOSE, CHANNEL_BACKGROUND);
        } catch (e) {
            console.warn('[SealX] Failed to send close message:', e);
        }
    }, 500);

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
            } catch (e) {
                const error = e instanceof Error ? e.message : String(e);
                try {
                    await sendSignResponse(request.payload.taskId, error);
                } catch (sendError) {
                    console.warn('[SealX] Failed to send error sign response:', sendError);
                }
                return;
            }
            // sendSignResponse 成功发送确认回插件，不阻塞主流程
            try {
                await sendSignResponse(request.payload.taskId);
            } catch (sendError) {
                // 回传失败不影响业务页面已收到的签名结果
                console.warn('[SealX] Failed to send sign response back to plugin:', sendError);
            }
        }
    };
    const off = messager.on(SealxTopic.SIGN_RESPONSE, handle, CHANNEL_POPUP);
    return () => off();
};

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
export const closeSealx = () => {
    messager.send('', SealxTopic.CLOSE, MessageChannel.BACKGROUND);
};

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
 * } else if (status === '') {
 *   console.log('SealX extension installed but not initialized');
 * } else {
 *   console.log('SealX extension is not available');
 * }
 * ```
 */
export const checkSealx = async (): Promise<string | null> => {
    const maxRetries = 3;
    const retryDelay = 100;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const res = await messager.send(
                '',
                SealxTopic.CHECK_INITIALIZED,
                MessageChannel.BACKGROUND
            );

            if (res?.payload) {
                return res.payload;
            }
        } catch {
            // Retry transient extension messaging failures.
        }

        // Wait before next retry, except on last attempt
        if (attempt < maxRetries - 1) {
            await wait(retryDelay);
        }
    }

    return null;
};

let checkTimer: any = null
/**
 * Sets up a callback to monitor SealX extension activation status
 * 
 * @remarks
 * This function registers a callback that will be invoked when the SealX extension
 * activation status changes. Useful for real-time monitoring of extension availability.
 * 
 * @param {function} callback - Function to call when activation status changes.
 * Receives the extension address/status as a string parameter.
 * 
 * @example
 * ```typescript
 * checkSealxActive((status) => {
 *   if (status) {
 *     console.log('SealX extension activated:', status);
 *   } else {
 *     console.log('SealX extension deactivated');
 *   }
 * });
 * ```
 */
export const checkSealxActive = (callback: (address: string) => void) => {
    messager.on(SealxTopic.CHECK_INITIALIZED, async (request: SealxRequest<string>) => {
        callback(request.payload)
    }, MessageChannel.BACKGROUND)
    if (checkTimer) {
        clearInterval(checkTimer)
    }
    checkTimer = setInterval(async () => {
        const res = await messager.send(
            '',
            SealxTopic.CHECK_INITIALIZED,
            MessageChannel.BACKGROUND
        );
        if (res.payload) {
            sealxSigner.activate()
        } else {
            sealxSigner.deactivate()
        }
        callback(res.payload)
    }, 2000)
}

/**
 * Highlight style for located elements
 */
const HIGHLIGHT_STYLE = {
    border: '2px solid #007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    transition: 'all 0.3s ease'
};

/**
 * Remove highlight style from element
 */
const removeHighlight = (element: HTMLElement) => {
    element.style.border = '';
    element.style.backgroundColor = '';
    element.style.transition = '';
    element.classList.remove('sealx-located-element');
};

/**
 * Add highlight style to element
 */
const addHighlight = (element: HTMLElement) => {
    Object.assign(element.style, HIGHLIGHT_STYLE);
    element.classList.add('sealx-located-element');
};

/**
 * Locate and highlight an element in the page by data-key attribute
 *
 * @param key - The data-key attribute value to locate
 * @param value - Optional value for additional matching
 * @returns true if element was found and highlighted, false otherwise
 */
const locateElementByKey = (key: string, value?: string): boolean => {
    // Find element with matching data-key attribute
    const element = document.querySelector(`[data-key="${key}"]`) as HTMLElement;

    if (!element) {
        return false;
    }

    // If value is provided, verify it matches
    if (value && element.textContent?.trim() !== value) {
        // Continue anyway - value is optional
    }

    // Remove any existing highlights first
    const existingHighlighted = document.querySelectorAll('.sealx-located-element');
    existingHighlighted.forEach(el => removeHighlight(el as HTMLElement));

    // Add highlight to the element
    addHighlight(element);

    // Scroll element into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Remove highlight after 3 seconds
    setTimeout(() => {
        removeHighlight(element);
    }, 3000);

    return true;
};

/**
 * Callback function to locate element by key and value
 * @param key - The data-key attribute value to locate
 * @param value - Optional value of the element
 * @returns The element to highlight, or null if not found
 */
export type LocateElementCallback = (key: string, value?: string) => HTMLElement | null;

/**
 * Set of registered locatable keys
 * If empty, all keys are allowed (backward compatibility)
 */
let registeredKeys: Set<string> = new Set();

/**
 * Register keys that can be located from the extension
 *
 * @param keys - Array of data-key values that can be located
 *
 * @example
 * ```typescript
 * import { registerLocatableKeys } from 'sealx-sdk';
 *
 * // Register keys that can be located
 * registerLocatableKeys(['orderId', 'message.from', 'message.to']);
 * ```
 */
export const registerLocatableKeys = (keys: string[]): void => {
    if (!keys || keys.length === 0) {
        registeredKeys.clear();
        return;
    }

    keys.forEach(key => {
        // Filter out empty strings
        if (key && key.trim()) {
            registeredKeys.add(key);
        }
    });
};

/**
 * Check if a key is registered for location
 * @param key - The key to check
 * @returns true if key is registered or no keys are registered (backward compatibility)
 */
const isKeyRegistered = (key: string): boolean => {
    // If no keys are registered, allow all keys (backward compatibility)
    if (registeredKeys.size === 0) {
        return true;
    }
    return registeredKeys.has(key);
};

/**
 * Default locate function - finds element by data-key attribute
 */
const defaultLocateCallback: LocateElementCallback = (key: string, value?: string): HTMLElement | null => {
    return document.querySelector(`[data-key="${key}"]`) as HTMLElement;
};

/**
 * Listen for LOCATE_ELEMENT messages from the extension and highlight corresponding elements
 *
 * @param locateCallback - Optional callback function to find the element to highlight
 * @returns Unsubscribe function to stop listening
 *
 * @example
 * ```typescript
 * import { onLocateElement } from 'sealx-sdk';
 *
 * // Using default element location (by data-key attribute)
 * const unsubscribe = onLocateElement();
 *
 * // Or with custom element location logic
 * const unsubscribe = onLocateElement((key, value) => {
 *   // Custom logic to find element based on key and value
 *   return document.querySelector(`[data-key="${key}"]`) as HTMLElement;
 * });
 *
 * // Later, stop listening
 * unsubscribe();
 * ```
 */
export const onLocateElement = (locateCallback?: LocateElementCallback): (() => void) => {
    const locator = locateCallback || defaultLocateCallback;

    const handleLocate = async (request: SealxRequest<{ key: string; value?: string }>) => {
        const { key, value } = request.payload;

        // Check if key is registered (if any keys are registered)
        if (!isKeyRegistered(key)) {
            return;
        }

        // Call the callback to get the element to highlight
        const element = locator(key, value);

        if (!element) {
            return;
        }

        // Remove any existing highlights first
        const existingHighlighted = document.querySelectorAll('.sealx-located-element');
        existingHighlighted.forEach(el => removeHighlight(el as HTMLElement));

        // Add highlight to the element
        addHighlight(element);

        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Remove highlight after 3 seconds
        setTimeout(() => {
            removeHighlight(element);
        }, 3000);
    };

    const off = messager.on(SealxTopic.LOCATE_ELEMENT, handleLocate, MessageChannel.POPUP);
    return off;
};

/**
 * Register a callback to be invoked when the SealX side panel closes.
 * Returns a cleanup function that deregisters the callback when called.
 *
 * @example
 * // React useEffect pattern
 * useEffect(() => sealxPanel.onPanelClose(() => setPanelOpen(false)), []);
 *
 * @example
 * // Manual cleanup
 * const cleanup = sealxPanel.onPanelClose(() => console.log('Panel closed'));
 * // later: cleanup();
 *
 * @param callback - Function to invoke when panel closes
 * @returns Cleanup function to deregister the callback
 */
export const onPanelClose = (callback: () => void): () => void => {
    const off = messager.on(SealxTopic.PANEL_CLOSE, async () => {
        try {
            callback();
        } catch (err) {
            console.warn('[SealX] onPanelClose callback error:', err);
        }
    }, MessageChannel.BACKGROUND);
    return off;
};

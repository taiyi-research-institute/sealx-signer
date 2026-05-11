import messager from '@src/core/messager';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SealxTopic, type SealxRequest } from 'sealx-message';
import { RequestContext } from '../context/requestContext';
import { useSessionStore } from '@src/core/state/session';
import { useInitializedStore } from '@src/core/state';
import { useSealXNavigate } from '@src/entries/popup/hooks/useSealXNavigate';
import { useLocation } from 'react-router-dom';
import type { ReplyFunc } from 'sealx-message';
import type { SealxSession } from 'sealx-core';
import { useRequestStore } from '@src/core/state/request';
import { clearSessionPrivateKey } from '@src/core/background';
// import { MessageChannel } from 'sealx-message';
// import { usePopupType } from '@src/hooks/usePopupType';

/**
 * Props for RequestContextProvider component
 */
interface RequestContextProps {
    /** Child components that will have access to the request context */
    children: React.ReactNode;
}

/**
 * Check if session is expired or invalid
 */
const isSessionValid = (
    session: SealxSession | null,
    host?: string,
    userId?: string
): boolean => {
    if (!session) return false;
    if (session.expire <= Date.now()) return false;
    if (host && session.host !== host) return false;
    if (userId && session.userId !== userId) return false;
    return true;
};

/**
 * Request context provider that manages:
 * - Incoming SealX requests from the messager
 * - Current active tab host information
 * - Session state for the current host
 */
export const RequestContextProvider: React.FC<RequestContextProps> = ({
    children,
}) => {
    // State management
    const [request, setRequest] = useState<SealxRequest>({} as SealxRequest);
    const [title, setTitle] = useState<string>('Sealx Sign What You See');
    const [loading, setLoading] = useState(false);

    // Use ref to track initialization status and prevent duplicate operations
    const initializedRef = useRef(false);

    // Session related state from store (single source of truth)
    const host = useSessionStore.use.host();
    const setHost = useSessionStore.use.setHost();
    const userId = useSessionStore.use.userId();
    const setUserId = useSessionStore.use.setUserId();
    const session = useSessionStore.use.session();
    const setSession = useSessionStore.use.setSession();

    // Navigation and initialization state
    const address = useInitializedStore.use.address();
    const navigate = useSealXNavigate();
    const { pathname } = useLocation();

    // Popup type detection
    // const { popupType } = usePopupType();

    /**
     * Determine target route based on request topic and session state
     */
    const getTargetRoute = useCallback(
        (
            req: SealxRequest,
            currentSession: SealxSession | null
        ): string | null => {
            const sessionValid = isSessionValid(
                currentSession,
                req.payload?.host,
                req.payload?.userId
            );

            // For CONNECT requests
            if (req.topic === SealxTopic.CONNECT) {
                // If session valid, reply with session and stay on current route
                if (currentSession && sessionValid) {
                    req.reply?.({
                        session: currentSession,
                        account: {
                            userId: currentSession.userId,
                            host: currentSession.host,
                            pk: currentSession.pk
                        }
                    });
                }
                return null;
            }

            // If session invalid, redirect to login
            if (!sessionValid) {
                return '/login';
            }

            // Handle specific routes based on current pathname and request topic
            if (
                pathname === '/task-detail' ||
                (pathname === '/task-home' &&
                    (req.topic === SealxTopic.SIGN ||
                        req.topic === SealxTopic.BATCH_SIGN))
            ) {
                return pathname;
            }

            // Determine target route based on request topic
            switch (req.topic) {
                case SealxTopic.BIND_PK:
                    return '/bind-pubkey';
                case SealxTopic.SIGN:
                case SealxTopic.BATCH_SIGN:
                    return '/task-home';
                case SealxTopic.SIGN_RESPONSE:
                    return pathname;
                default:
                    return '/';
            }
        },
        [pathname]
    );

    /**
     * Handle routing based on request
     */
    const routeByRequest = useCallback(
        (req: SealxRequest) => {
            if (loading) return;

            setLoading(true);
            const currentSession = useSessionStore.getState().session;
            const targetRoute = getTargetRoute(req, currentSession);

            if (targetRoute && targetRoute !== pathname) {
                navigate(targetRoute, { replace: true });
            }

            setLoading(false);
        },
        [pathname, getTargetRoute, navigate, loading]
    );

    /**
     * Helper function to update host and userId from request
     */
    const updateHostAndUserId = useCallback(
        (req: SealxRequest) => {
            if (req.topic === SealxTopic.CONNECT) {
                const newHost = req.payload?.host ?? '';
                const newUserId = req.payload?.userId ?? '';
                const newTitle = req.payload?.title ?? 'Sealx Sign What You See';

                setHost(newHost);
                setUserId(newUserId);
                setTitle(newTitle);
            } else if (req.header) {
                if (req.header.host) setHost(req.header.host);
                if (req.header.userId) setUserId(req.header.userId);
            }
        },
        [setHost, setUserId]
    );

    // useEffect(() => {
    //     // Tab模式下打开插件页面不用发送这个信息
    //     // Only send CHECK_ACTIVED messages when not in tab mode
    //     if (popupType === 'tab') {
    //         return;
    //     }

    //     messager.send(MessageChannel.POPUP, SealxTopic.CHECK_ACTIVED, MessageChannel.INPAGE)
    //     const timer = setInterval(() => {
    //         messager.send(MessageChannel.POPUP, SealxTopic.CHECK_ACTIVED, MessageChannel.INPAGE)
    //     }, 10000);
    //     return () => {
    //         clearInterval(timer)
    //     }
    // }, [popupType])

    /**
     * Handle incoming SealX requests
     */
    const handleRequest = useCallback(
        async (req: SealxRequest, reply?: ReplyFunc) => {
            // Skip invalid requests
            if (!req || !req.topic) {
                return;
            }

            // Handle CHECK_ACTIVE immediately
            if (req.topic === SealxTopic.CHECK_ACTIVE) {
                reply?.(true);
                return;
            }

            // Update TabManager's currentTab when receiving from content/inpage
            // This ensures that when sending messages back to the business page
            // (via createWindow popup), we use the correct tab ID
            // if (req.header?.tabId) {
            //     try {
            //         const tab = await chrome.tabs.get(req.header.tabId);
            //         if (tab) {
            //             TabManager.getInstance().currentTab = tab;
            //         }
            //     } catch (e) {
            //         // Tab may not be accessible, ignore error
            //     }
            // }



            try {
                // Bind reply function to request
                req.reply = (res, end?: boolean) => {
                    if (reply) reply(res, end);
                };

                // Update host and userId from request
                updateHostAndUserId(req);
                // Skip duplicate request IDs
                if (req.header?.requestId === request.header?.requestId) {
                    return;
                }
                // Set request state and trigger routing
                setRequest(req);
            } catch (error) {
                console.error('Error handling SealX request:', error);
                throw error;
            }
        },
        [request.header?.requestId, updateHostAndUserId]
    );

    /**
     * Initialize application based on current state
     */
    const initializeApplication = useCallback(async () => {
        if (initializedRef.current) return;

        setLoading(true);

        // Wait for store hydration
        const addressLoaded = useInitializedStore.persist.hasHydrated();
        if (!addressLoaded) {
            // Wait a bit for hydration to complete
            setTimeout(() => initializeApplication(), 100);
            return;
        }

        // Check if address exists (plugin initialization)
        const currentAddress = useInitializedStore.getState().address;
        if (!currentAddress) {
            if (pathname !== '/initialize') {
                navigate('/initialize', { replace: true });
            }
            setLoading(false);
            return;
        }

        // Check for cached request data
        const storeRequest = useRequestStore.getState().request;
        if (storeRequest) {
            // Restore request with reply function binding
            if (storeRequest.once) {
                storeRequest.reply = (res, end?: boolean) => {
                    messager.reply(res, storeRequest, end);
                };
            }
            setRequest(storeRequest);
            useRequestStore.getState().clearRequest();
            setLoading(false);
            return;
        }

        // No cached request, check session
        const currentSession = useSessionStore.getState().session;
        const sessionValid = isSessionValid(currentSession);

        if (!sessionValid) {
            setHost('')
            setUserId('')
            // Clear session if invalid
            if (currentSession) {

                clearSessionPrivateKey(currentSession.host ?? '', currentSession.userId ?? '')
                setSession(null);
            }
            // Redirect to login if not already there
            if (pathname !== '/login') {
                navigate('/login', { replace: true });
            }
        } else {
            // Session is valid
            // If on login or initialize pages, redirect to main page
            if (pathname === '/login' || pathname === '/initialize' || pathname === '/initialized') {
                navigate('/', { replace: true });
            }
            // Otherwise stay on current page
        }

        setLoading(false);
        initializedRef.current = true;
    }, [pathname, navigate, setHost, setUserId, setSession]);

    /**
     * Setup messager listener - runs once on mount
     */
    useEffect(() => {
        const off = messager.on(SealxTopic.ALL, handleRequest);
        return () => off();
    }, [handleRequest]);

    /**
     * Initialize application on mount - runs once
     */
    useEffect(() => {
        initializeApplication();
    }, [initializeApplication]);

    /**
     * Handle request-based routing
     */
    useEffect(() => {
        if (request.header) {
            routeByRequest(request);
        }
    }, [request, routeByRequest]);

    /**
     * Clear expired session and handle address changes
     */
    useEffect(() => {
        // Clear expired session
        if (session && session.expire <= Date.now()) {
            clearSessionPrivateKey(session.host ?? '', session.userId ?? '')
            setSession(null);
        }

        // Handle address changes
        if (!address && pathname !== '/initialize') {
            navigate('/initialize', { replace: true });
        }
    }, [session, setSession, address, pathname, navigate]);

    return (
        <RequestContext.Provider
            value={{
                request,
                activeTabHost: host,
                setActiveTabHost: setHost,
                setRequest,
                session,
                setSession,
                userId,
                title,
            }}>
            {children}
            {loading && <Loading />}
        </RequestContext.Provider>
    );
};

const Loading: React.FC = () => {
    return (
        <div className='fixed inset-0 z-50 flex w-full h-full items-center justify-center bg-neutral-950/10 backdrop-blur-sm'>
            <div className='relative flex flex-col items-center justify-center p-[32px]  rounded-2xl shadow-2xl min-w-[200px] min-h-[200px]'>
                {/* Spinner */}
                <div
                    className='w-[64px] h-[64px] mb-[24px] border-4 border-surface/20   rounded-full animate-spin'
                    style={{
                        borderTopColor: '#00be78',
                        animation: 'spin 1s linear infinite',
                    }}></div>

                {/* Loading text */}
                <div className='text-[24px] font-medium text-gray-800'>
                    Loading...
                </div>

                {/* Optional subtle pulsing background */}
                <div className='absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-[#00be78]/[80] to-transparent animate-pulse'></div>
            </div>
        </div>
    );
};

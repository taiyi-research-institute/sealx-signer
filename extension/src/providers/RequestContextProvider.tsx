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
// import { MessageChannel } from 'sealx-message';

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

const REQUEST_ONLY_ROUTES = new Set(['/bind-pubkey', '/task-detail', '/task-home']);
const PANEL_TRIGGER_MAX_AGE_MS = 2_000;
const BLOCKING_SYNC_MS = 800;

const normalizeRoute = (route: string) => {
    const normalizedRoute = route.replace(/^#/, '');
    if (!normalizedRoute || normalizedRoute === '/') return '/';
    return normalizedRoute.startsWith('/') ? normalizedRoute : `/${normalizedRoute}`;
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

    // Keep loading brief so it does not cover already-rendered signing details.
    const loadingStartRef = useRef(0);
    const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const MIN_LOADING_MS = 450;

    // Clear loading only after minimum duration has elapsed
    const finishLoading = useCallback(() => {
        if (loadingTimerRef.current) {
            clearTimeout(loadingTimerRef.current);
            loadingTimerRef.current = null;
        }
        const elapsed = Date.now() - loadingStartRef.current;
        const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
        if (remaining > 0) {
            loadingTimerRef.current = setTimeout(() => setLoading(false), remaining);
        } else {
            setLoading(false);
        }
    }, []);

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

    // Freeze isButtonTriggered: once set, don't unset on re-render
    const buttonTriggeredRef = useRef(false);
    const buttonTriggerCheckedRef = useRef(false);
    const [isButtonTriggered, setIsButtonTriggered] = useState(false);
    const [blockingSync, setBlockingSync] = useState(false);

    const consumePanelTriggerSource = useCallback(async () => {
        if (buttonTriggerCheckedRef.current) return buttonTriggeredRef.current;

        buttonTriggerCheckedRef.current = true;
        try {
            const res = await chrome.storage.session.get(['panelTriggerSource', 'panelTriggerSourceAt']);
            const sourceAt = typeof res.panelTriggerSourceAt === 'number' ? res.panelTriggerSourceAt : 0;
            const isFreshButtonSource =
                res.panelTriggerSource === 'button' &&
                sourceAt > 0 &&
                Date.now() - sourceAt <= PANEL_TRIGGER_MAX_AGE_MS;

            await chrome.storage.session.remove(['panelTriggerSource', 'panelTriggerSourceAt']);

            if (isFreshButtonSource) {
                buttonTriggeredRef.current = true;
                setIsButtonTriggered(true);
                setBlockingSync(true);
                setLoading(true);
                loadingStartRef.current = Date.now();
                return true;
            }
        } catch {
            // Storage can fail in non-extension test contexts; fall back to normal open.
        }
        return false;
    }, []);

    // 5s timeout fallback: unlock loading if no bind/sign request arrives in time
    useEffect(() => {
        if (!isButtonTriggered) return;
        const unblockTimer = setTimeout(() => {
            setBlockingSync(false);
        }, BLOCKING_SYNC_MS);
        const fallbackTimer = setTimeout(() => {
            if (loadingTimerRef.current) {
                clearTimeout(loadingTimerRef.current);
                loadingTimerRef.current = null;
            }
            setBlockingSync(false);
            setLoading(false);
            if (!request.topic && REQUEST_ONLY_ROUTES.has(pathname)) {
                useRequestStore.getState().clearRequest();
                setRequest({} as SealxRequest);
                navigate('/', { replace: true });
            }
        }, 5_000);
        return () => {
            clearTimeout(unblockTimer);
            clearTimeout(fallbackTimer);
        };
    }, [isButtonTriggered, navigate, pathname, request.topic]);

    // Watch request.topic: unlock loading when BIND_PK / SIGN / BATCH_SIGN arrives
    // CONNECT does NOT end loading (per spec)
    useEffect(() => {
        if (!isButtonTriggered) return;
        if (!request.topic) return;
        if (
            request.topic === SealxTopic.BIND_PK ||
            request.topic === SealxTopic.SIGN ||
            request.topic === SealxTopic.BATCH_SIGN
        ) {
            finishLoading();
        }
    }, [request.topic, isButtonTriggered, finishLoading]);

    useEffect(() => {
        if (isButtonTriggered) return;

        const clearRequestRoute = () => {
            if (request.topic) return;
            if (REQUEST_ONLY_ROUTES.has(normalizeRoute(window.location.hash || pathname))) {
                useRequestStore.getState().clearRequest();
                setRequest({} as SealxRequest);
                navigate('/', { replace: true });
            }
        };

        const handleVisible = () => {
            if (!document.hidden) {
                clearRequestRoute();
            }
        };

        window.addEventListener('focus', clearRequestRoute);
        document.addEventListener('visibilitychange', handleVisible);
        return () => {
            window.removeEventListener('focus', clearRequestRoute);
            document.removeEventListener('visibilitychange', handleVisible);
        };
    }, [isButtonTriggered, navigate, pathname, request.topic]);

    useEffect(() => {
        const clearOnPageHide = () => {
            buttonTriggeredRef.current = false;
            buttonTriggerCheckedRef.current = false;
            setIsButtonTriggered(false);
            setBlockingSync(false);
            if (!REQUEST_ONLY_ROUTES.has(normalizeRoute(window.location.hash || pathname))) return;

            useRequestStore.getState().clearRequest();
            setRequest({} as SealxRequest);
            navigate('/', { replace: true });
        };

        window.addEventListener('pagehide', clearOnPageHide);
        return () => {
            window.removeEventListener('pagehide', clearOnPageHide);
        };
    }, [navigate, pathname]);

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
                    return null;  // Valid session — stay on current route
                }
                // F3: Session invalid — redirect to login
                return '/login';
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
            const currentSession = useSessionStore.getState().session;
            const targetRoute = getTargetRoute(req, currentSession);

            if (targetRoute && targetRoute !== pathname) {
                navigate(targetRoute, { replace: true });
            }
        },
        [pathname, getTargetRoute, navigate]
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

        const openedByButton = await consumePanelTriggerSource();

        setLoading(true);
        loadingStartRef.current = Date.now();

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
            if (!buttonTriggeredRef.current) {
                finishLoading();
            }
            initializedRef.current = true;
            return;
        }

        // F2: 等待 useRequestStore hydration 完成（Zustand persist 从 chrome.storage.local 回灌）
        // background 的 setRequest() 通过 chrome.storage.local 同步到 panel，
        // 但异步写入可能有延迟。先 rehydrate，再轮询重试。
        if (!useRequestStore.persist.hasHydrated()) {
            await useRequestStore.persist.rehydrate();
        }

        if (!openedByButton) {
            useRequestStore.getState().clearRequest();
            if (REQUEST_ONLY_ROUTES.has(pathname)) {
                navigate('/', { replace: true });
            }
        } else {
            // Check for cached request data with polling retry
            // (handles race: background wrote to storage but async propagation hasn't completed)
            let storeRequest = useRequestStore.getState().request;
            for (let attempt = 0; attempt < 3 && !storeRequest; attempt++) {
                if (attempt > 0) {
                    await new Promise(r => setTimeout(r, 100));
                }
                storeRequest = useRequestStore.getState().request;
            }
            if (storeRequest) {
                // Restore request with reply function binding
                if (storeRequest.once) {
                    storeRequest.reply = (res, end?: boolean) => {
                        messager.reply(res, storeRequest, end);
                    };
                }
                setRequest(storeRequest);
                useRequestStore.getState().clearRequest();
                initializedRef.current = true;
                return;
            }
        }

        // No cached request, check session
        const currentSession = useSessionStore.getState().session;
        const sessionValid = isSessionValid(currentSession);

        if (!sessionValid) {
            setHost('')
            setUserId('')
            // Clear session if invalid
            if (currentSession) {

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
            } else if (!openedByButton && REQUEST_ONLY_ROUTES.has(pathname)) {
                navigate('/', { replace: true });
            }
            // Otherwise stay on current page
        }

        if (!openedByButton) {
            setLoading(false);
        }
        initializedRef.current = true;
    }, [consumePanelTriggerSource, pathname, navigate, setHost, setUserId, setSession, finishLoading]);

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

    // Cleanup loading timer on unmount
    useEffect(() => {
        return () => {
            if (loadingTimerRef.current) {
                clearTimeout(loadingTimerRef.current);
                loadingTimerRef.current = null;
            }
        };
    }, []);

    /**
     * Clear expired session and handle address changes
     */
    useEffect(() => {
        // Clear expired session
        if (session && session.expire <= Date.now()) {
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
            <>
                {children}
                {loading && <Loading compact={isButtonTriggered} blocking={blockingSync} />}
            </>
        </RequestContext.Provider>
    );
};

const Loading: React.FC<{ compact?: boolean; blocking?: boolean }> = ({ compact, blocking }) => {
    if (compact && blocking) {
        return (
            <div className='fixed inset-0 z-50 flex items-center justify-center bg-white'>
                <div className='flex items-center gap-[10px] rounded-[999px] border border-[var(--sx-border)] bg-white px-[14px] py-[10px] text-[12px] font-[800] text-[var(--sx-muted)] shadow-[0_10px_24px_rgba(16,24,32,0.10)]'>
                    <span className='h-[8px] w-[8px] animate-pulse rounded-full bg-[var(--sx-brand)]'></span>
                    Syncing
                </div>
            </div>
        );
    }

    return (
        <div className='pointer-events-none fixed right-[16px] top-[16px] z-50 flex items-center gap-[8px] rounded-[999px] border border-[var(--sx-border)] bg-white/92 px-[12px] py-[8px] text-[12px] font-[800] text-[var(--sx-muted)] shadow-[0_10px_24px_rgba(16,24,32,0.10)]'>
            <span className='h-[8px] w-[8px] animate-pulse rounded-full bg-[var(--sx-brand)]'></span>
            {compact ? 'Syncing' : 'Loading'}
        </div>
    );
};

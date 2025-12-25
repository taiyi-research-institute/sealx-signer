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

    // Use ref to track pending request to avoid race conditions
    const pendingRequestRef = useRef<{
        req: SealxRequest;
        reply?: ReplyFunc;
    } | null>(null);

    // Session related state from store (single source of truth)
    const host = useSessionStore.use.host();
    const setHost = useSessionStore.use.setHost();
    const userId = useSessionStore.use.userId();
    const setUserId = useSessionStore.use.setUserId();
    const session = useSessionStore.use.session();
    const setSession = useSessionStore.use.setSession();
    // const [oldPath, setOldPath] = useState('')

    // Navigation and initialization state
    const address = useInitializedStore.use.address();
    const navigate = useSealXNavigate();
    const { pathname, state: locationState } = useLocation() as {
        pathname: string;
        state: { fromInitialize?: boolean } | null;
    };

    /**
     * Clear host and userId when request has no header
     * (i.e., not triggered by page/dApp - user opened popup manually)
     */
    useEffect(() => {
        if (!request.header) {
            setHost('');
            setUserId('');
        }
    }, [request.header, setHost, setUserId]);

    useEffect(() => {
        const storeRequest = useRequestStore.getState().request;
        if (storeRequest) setRequest(storeRequest);
        if (storeRequest) useRequestStore.getState().clearRequest()
    }, [])

    /**
     * Helper function to update host and userId from request
     */
    const updateHostAndUserId = useCallback(
        (req: SealxRequest) => {
            if (req.topic === SealxTopic.CONNECT) {
                const newHost = req.payload?.host ?? '';
                const newUserId = req.payload?.userId ?? '';
                const newTitle =
                    req.payload?.title ?? 'Sealx Sign What You See';

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

    /**
     * Determine target route based on request topic and session state
     */
    const getTargetRoute = useCallback(
        (
            req: SealxRequest,
            currentSession: SealxSession | null
        ): string | null => {
            // if (!address) return '/initialize';

            // For CONNECT requests
            if (req.topic === SealxTopic.CONNECT) {
                const sessionValid = isSessionValid(
                    currentSession,
                    req.payload?.host,
                    req.payload?.userId
                );
                if (!sessionValid) return '/login';

                // If session valid, reply with session and stay on current route
                if (currentSession) {
                    req.reply?.(currentSession);
                }
                return null;
            }
            if (
                pathname === '/task-detail' &&
                (req.topic === SealxTopic.SIGN ||
                    req.topic === SealxTopic.BATCH_SIGN)
            ) {
                return '/task-detail';
            }

            // return req.topic === SealxTopic.BIND_PK ? '/bind-pubkey' : '/task-home';
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

            // return null;
        },
        [pathname]
    );

    /**
     * Handle incoming SealX requests
     */
    const handler = useCallback(
        async (req: SealxRequest, reply?: ReplyFunc) => {
            try {
                if (!req?.topic) return;
                req.reply = reply;
                // Handle CHECK_ACTIVE immediately
                if (req.topic === SealxTopic.CHECK_ACTIVE) {
                    reply?.(true);
                    return;
                }

                // Update host and userId from request
                updateHostAndUserId(req);

                // Check if this topic requires a valid session
                const requiresSession =
                    req.topic === SealxTopic.BIND_PK ||
                    req.topic === SealxTopic.SIGN ||
                    req.topic === SealxTopic.BATCH_SIGN;

                // If session required but invalid, store as pending
                if (
                    requiresSession &&
                    !session &&
                    !isSessionValid(
                        session,
                        req.header?.host,
                        req.header?.userId
                    )
                ) {
                    pendingRequestRef.current = { req, reply };
                    return;
                }

                // Determine and navigate to target route if needed
                const targetRoute = getTargetRoute(req, session);
                console.log(
                    '========= update route ======',
                    req,
                    targetRoute,
                    pathname
                );
                if (targetRoute && targetRoute !== pathname) {
                    navigate(targetRoute, { replace: true });
                }

                // Update current request
                setRequest(req);
            } catch (error) {
                console.error('Error handling SealX request:', error);
                throw error;
            }
        },
        [session, pathname, navigate, updateHostAndUserId, getTargetRoute]
    );

    /**
     * Process pending request when session becomes available
     */
    useEffect(() => {
        const pending = pendingRequestRef.current;
        console.log('------- restry request -----', pending);

        // Only process if we have a pending request and a valid session
        if (!pending || !session || !isSessionValid(session, host, userId)) {
            return;
        }
        console.log('------- restry request success -----', pending, session);
        // Attach reply function
        if (pending.reply) {
            pending.req.reply = pending.reply;
        }

        // Determine and navigate to target route if needed
        const targetRoute = getTargetRoute(pending.req, session);
        console.log(
            '------- restry request success -----',
            targetRoute,
            pathname
        );
        // Update request and clear pending
        setRequest(pending.req);
        if (targetRoute && targetRoute !== pathname) {
            navigate(targetRoute, { replace: true });
        }
    }, [session, host, userId, pathname, navigate, getTargetRoute]);

    /**
     * Setup messager listener
     */
    useEffect(() => {
        const off = messager.on(SealxTopic.ALL, handler);
        return () => off();
    }, [handler]);

    /**
     * Handle session expiration and route guards
     */
    useEffect(() => {
        // Redirect to initialize if no address
        if (!address && pathname !== '/initialize') {
            navigate('/initialize', { replace: true });
            return;
        }

        if (!address) return;

        // Skip route guards for /initialize page - it has its own flow
        if (pathname === '/initialize') {
            return;
        }
        const sessionValid = isSessionValid(session, host, userId);
        // Handle /initialized page specially
        if (pathname === '/initialized') {
            const fromInitialize = locationState?.fromInitialize;

            if (fromInitialize) {
                // Coming from initialize page, skip validation to allow session setup
                return;
            } else {
                // User refreshed or directly accessed /initialized page
                if (!sessionValid) {
                    // No valid session on refresh, redirect to login
                    navigate('/login', { replace: true });
                    return;
                }
                // Has valid session, allow staying on page
                return;
            }
        }

        // const sessionValid = isSessionValid(session, host, userId);
        // Redirect to login if session invalid and not already there
        console.log('----------- check session ----------', [pathname, session, request.topic])
        if (!sessionValid) {
            setSession(null)
            if (pathname !== '/login') navigate('/login', { replace: true });
            return;
        }
        const topic =
            request.topic ?? pendingRequestRef.current?.req?.topic ?? '';
        if (topic === SealxTopic.CONNECT && session && sessionValid) {
            request.reply?.(session);
            return;
        }
        // if(sessionValid){}
        // Redirect away from login if session is valid and no active request
        if (
            sessionValid &&
            pathname === '/login' &&
            topic !== SealxTopic.BATCH_SIGN &&
            topic !== SealxTopic.BIND_PK &&
            topic !== SealxTopic.SIGN
        ) {
            console.log('----------- enter main ---', request.topic);
            navigate('/', { replace: true });
            return
        }
        if (topic === SealxTopic.SIGN || topic === SealxTopic.BATCH_SIGN) {
            if (pathname !== '/task-home' && pathname !== '/task-detail') {
                navigate('/task-home', { replace: true })
                return
            }
        } else if (topic === SealxTopic.BIND_PK) {
            if (pathname !== '/bind-pubkey') {
                navigate('/bind-pubkey', { replace: true })
                return
            }
        }
    }, [address, session, host, userId, pathname, locationState, request.topic, navigate, request, setSession]);

    /**
     * Clear expired session
     */
    useEffect(() => {
        if (session && session.expire <= Date.now()) {
            setSession(null);
        }
    }, [session, setSession]);

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
        </RequestContext.Provider>
    );
};

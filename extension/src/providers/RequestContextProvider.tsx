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
import { requestCache, REQUEST_CACHE_KEY } from '@src/core/request-cache';
import {
  loginAnimatingRef,
  loginAnimatingMeta,
  LOGIN_ANIMATING_TIMEOUT_MS,
} from '@src/core/state/login-animating';
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
const isSessionValid = (session: SealxSession | null, host?: string, userId?: string): boolean => {
  if (!session) return false;
  if (session.expire <= Date.now()) return false;
  if (host && session.host !== host) return false;
  if (userId && session.userId !== userId) return false;
  return true;
};

const REQUEST_ONLY_ROUTES = new Set(['/bind-pubkey', '/task-detail', '/task-home']);
const PANEL_TRIGGER_MAX_AGE_MS = 10_000;
const REQUEST_CACHE_POLL_INTERVAL_MS = 300;
const REQUEST_CACHE_POLL_ATTEMPTS = 20;

const waitForRequestCacheChange = (attempt: number) => {
  return new Promise<void>((resolve) => {
    const waitStart = Date.now();
    const timer = setTimeout(() => {
      chrome.storage.onChanged.removeListener(listener);
      console.warn('[TRACE-RECOVER:PANEL] request cache wait timeout', {
        attempt,
        elapsed: Date.now() - waitStart,
      });
      resolve();
    }, REQUEST_CACHE_POLL_INTERVAL_MS);

    const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== 'session' || !changes[REQUEST_CACHE_KEY]?.newValue) return;
      clearTimeout(timer);
      chrome.storage.onChanged.removeListener(listener);
      console.warn('[TRACE-RECOVER:PANEL] request cache storage changed', {
        attempt,
        elapsed: Date.now() - waitStart,
      });
      resolve();
    };

    chrome.storage.onChanged.addListener(listener);
  });
};

const normalizeRoute = (route: string) => {
  const normalizedRoute = route.replace(/^#/, '');
  if (!normalizedRoute || normalizedRoute === '/') return '/';
  return normalizedRoute.startsWith('/') ? normalizedRoute : `/${normalizedRoute}`;
};

const getActiveTabHost = async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return '';
    const url = new URL(tab.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.host;
  } catch {
    return '';
  }
};

const providerModuleLoadedAt = Date.now();
console.warn('[TRACE-PANEL-TIMING:PROVIDER] module loaded', {
  providerModuleLoadedAt,
});

/**
 * Request context provider that manages:
 * - Incoming SealX requests from the messager
 * - Current active tab host information
 * - Session state for the current host
 */
export const RequestContextProvider: React.FC<RequestContextProps> = ({ children }) => {
  const renderAt = Date.now();
  console.warn('[TRACE-PANEL-TIMING:PROVIDER] render', {
    elapsedSinceModuleLoad: renderAt - providerModuleLoadedAt,
  });

  useEffect(() => {
    console.warn('[TRACE-PANEL-TIMING:PROVIDER] mounted', {
      elapsedSinceModuleLoad: Date.now() - providerModuleLoadedAt,
    });
  }, []);

  // State management
  const [request, setRequest] = useState<SealxRequest>({} as SealxRequest);
  const [title, setTitle] = useState<string>('Sealx Sign What You See');
  const [initializing, setInitializing] = useState(true);

  // Use ref to track initialization status and prevent duplicate operations
  const initializedRef = useRef(false);
  const initializeEffectRanRef = useRef(false);

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
  const pathnameRef = useRef(pathname);
  const requestTopicRef = useRef<SealxTopic | undefined>(undefined);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    requestTopicRef.current = request.topic;
  }, [request.topic]);

  // Freeze isButtonTriggered: once set, don't unset on re-render
  const buttonTriggeredRef = useRef(false);
  const buttonTriggerCheckedRef = useRef(false);
  const [isButtonTriggered, setIsButtonTriggered] = useState(false);

  const consumePanelTriggerSource = useCallback(async () => {
    if (buttonTriggerCheckedRef.current) return buttonTriggeredRef.current;

    buttonTriggerCheckedRef.current = true;
    try {
      const res = await chrome.storage.session.get(['panelTriggerSource', 'panelTriggerSourceAt']);
      console.warn('[TRACE-CONNECT:PANEL] consumePanelTriggerSource', {
        panelTriggerSource: res.panelTriggerSource,
        panelTriggerSourceAt: res.panelTriggerSourceAt,
      });
      const sourceAt = typeof res.panelTriggerSourceAt === 'number' ? res.panelTriggerSourceAt : 0;
      const sourceAge = sourceAt > 0 ? Date.now() - sourceAt : 0;
      const isFreshButtonSource =
        res.panelTriggerSource === 'button' &&
        sourceAt > 0 &&
        sourceAge <= PANEL_TRIGGER_MAX_AGE_MS;

      console.warn('[TRACE-CONNECT:PANEL] consumePanelTriggerSource result', {
        sourceAge,
        maxAge: PANEL_TRIGGER_MAX_AGE_MS,
        isFreshButtonSource,
      });

      await chrome.storage.session.remove(['panelTriggerSource', 'panelTriggerSourceAt']);

      if (isFreshButtonSource) {
        buttonTriggeredRef.current = true;
        setIsButtonTriggered(true);
        return true;
      }
    } catch {
      // Storage can fail in non-extension test contexts; fall back to normal open.
    }
    return false;
  }, []);

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
    (req: SealxRequest, currentSession: SealxSession | null): string | null => {
      const sessionValid = isSessionValid(currentSession, req.payload?.host, req.payload?.userId);

      // For CONNECT requests
      if (req.topic === SealxTopic.CONNECT) {
        // If session valid, reply with session and stay on current route
        if (currentSession && sessionValid) {
          req.reply?.({
            session: currentSession,
            account: {
              userId: currentSession.userId,
              host: currentSession.host,
              pk: currentSession.pk,
            },
          });
          return null; // Valid session — stay on current route
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
          (req.topic === SealxTopic.SIGN || req.topic === SealxTopic.BATCH_SIGN))
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
    [pathname],
  );

  /**
   * Handle routing based on request
   */
  const routeByRequest = useCallback(
    (req: SealxRequest) => {
      // Don't navigate during the logging-in animation — Login handles it
      if (loginAnimatingRef.current) {
        if (Date.now() - loginAnimatingMeta.setAt > LOGIN_ANIMATING_TIMEOUT_MS) {
          loginAnimatingRef.current = false;
        } else {
          return;
        }
      }

      const currentSession = useSessionStore.getState().session;
      const targetRoute = getTargetRoute(req, currentSession);

      console.warn('[TRACE-CONNECT:PANEL] routeByRequest', {
        topic: req.topic,
        pathname,
        targetRoute,
        hasSession: !!currentSession,
        sessionUserId: currentSession?.userId,
        sessionHost: currentSession?.host,
      });

      if (targetRoute && targetRoute !== pathname) {
        navigate(targetRoute, { replace: true });
      }
    },
    [pathname, getTargetRoute, navigate],
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
        console.warn('[TRACE-CONNECT:PANEL] updateHostAndUserId CONNECT', {
          newHost,
          newUserId,
          newTitle,
          payloadKeys: req.payload ? Object.keys(req.payload) : [],
        });
        setHost(newHost);
        setUserId(newUserId);
        setTitle(newTitle);
      } else if (req.header) {
        if (req.header.host) setHost(req.header.host);
        if (req.header.userId) setUserId(req.header.userId);
      }
    },
    [setHost, setUserId],
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

      try {
        // Bind reply function to request
        req.reply = (res, end?: boolean) => {
          if (reply) reply(res, end);
        };

        console.warn('[TRACE-CONNECT:PANEL] handleRequest received', {
          topic: req.topic,
          payload: req.payload,
          headerHost: req.header?.host,
          headerUserId: req.header?.userId,
          currentRequestTopic: request.topic,
        });

        // Update host and userId from request
        updateHostAndUserId(req);
        // Skip duplicate request IDs
        if (req.header?.requestId === request.header?.requestId) {
          console.warn('[TRACE-CONNECT:PANEL] handleRequest SKIP duplicate', {
            requestId: req.header?.requestId,
          });
          return;
        }
        // Set request state and trigger routing
        console.warn('[TRACE-CONNECT:PANEL] handleRequest → setRequest', {
          newTopic: req.topic,
          oldTopic: request.topic,
          payload: req.payload,
        });
        console.warn('[TRACE-RECOVER:PANEL] live request received', {
          topic: req.topic,
          requestId: req.header?.requestId,
          wasInitializing: initializing,
        });
        setRequest(req);
        setInitializing(false);
      } catch (error) {
        console.error('Error handling SealX request:', error);
        throw error;
      }
    },
    [request.header?.requestId, request.topic, updateHostAndUserId, initializing],
  );

  /**
   * Initialize application based on current state
   */
  const initializeApplication = useCallback(async () => {
    if (initializedRef.current) {
      setInitializing(false);
      return;
    }

    const initStart = Date.now();
    const currentPath = pathnameRef.current;
    console.warn('[TRACE-RECOVER:PANEL] initializeApplication START', {
      alreadyInit: initializedRef.current,
      pathname: currentPath,
      openedByButton: buttonTriggeredRef.current,
    });

    const openedByButton = await consumePanelTriggerSource();
    console.warn('[TRACE-CONNECT:PANEL] initializeApplication after consumeTrigger', {
      openedByButton,
      pathname: currentPath,
      elapsed: Date.now() - initStart,
    });

    // Wait for store hydration
    const addressLoaded = useInitializedStore.persist.hasHydrated();
    if (!addressLoaded) {
      // Wait a bit for hydration to complete
      setTimeout(() => initializeApplication(), 100);
      return;
    }

    // Wait for session store hydration before route decisions.
    if (!useSessionStore.persist.hasHydrated()) {
      const sessionHydrateStart = Date.now();
      await useSessionStore.persist.rehydrate();
      console.warn('[TRACE-RECOVER:PANEL] session store rehydrated', {
        elapsed: Date.now() - sessionHydrateStart,
        totalElapsed: Date.now() - initStart,
        hasSession: !!useSessionStore.getState().session,
      });
    } else {
      console.warn('[TRACE-RECOVER:PANEL] session store already hydrated', {
        totalElapsed: Date.now() - initStart,
        hasSession: !!useSessionStore.getState().session,
      });
    }

    // Check if address exists (plugin initialization)
    const currentAddress = useInitializedStore.getState().address;
    if (!currentAddress) {
      if (currentPath !== '/initialize') {
        navigate('/initialize', { replace: true });
      }
      setInitializing(false);
      initializedRef.current = true;
      return;
    }
    let cachedRequest: SealxRequest | null = null;
    if (!openedByButton) {
      const activeHost = await getActiveTabHost();
      if (activeHost) {
        console.warn('[TRACE-CONNECT:PANEL] initializeApplication active tab host', {
          activeHost,
        });
        setHost(activeHost);
      }
      await requestCache.clear();
      useRequestStore.getState().clearRequest();
      if (REQUEST_ONLY_ROUTES.has(currentPath)) {
        navigate('/', { replace: true });
      }
    } else {
      // Wait for the business request before rendering/routes.
      // This avoids a home-page flash while SDK SIGN/BIND_PK is still arriving.

      const requestRecoverStart = Date.now();
      for (let attempt = 0; attempt < REQUEST_CACHE_POLL_ATTEMPTS && !cachedRequest; attempt++) {
        cachedRequest = await requestCache.consume();
        console.warn('[TRACE-RECOVER:PANEL] request cache poll', {
          attempt: attempt + 1,
          hit: !!cachedRequest,
          elapsed: Date.now() - requestRecoverStart,
          totalElapsed: Date.now() - initStart,
        });
        if (!cachedRequest && attempt < REQUEST_CACHE_POLL_ATTEMPTS - 1) {
          await waitForRequestCacheChange(attempt + 1);
        }
      }

      if (cachedRequest) {
        const restoredRequest = cachedRequest;
        console.warn('[TRACE-CONNECT:PANEL] initializeApplication found cachedRequest', {
          cachedRequestTopic: restoredRequest.topic,
          cachedRequestId: restoredRequest.header?.requestId,
          elapsed: Date.now() - requestRecoverStart,
          totalElapsed: Date.now() - initStart,
        });
        // Restore request with reply function binding
        if (restoredRequest.once) {
          restoredRequest.reply = (res, end?: boolean) => {
            messager.reply(res, restoredRequest, end);
          };
        }
        setRequest(restoredRequest);
        setInitializing(false);
        initializedRef.current = true;
        const currentSession = useSessionStore.getState().session;
        const sessionValid = isSessionValid(currentSession);
        if (!sessionValid) {
          navigate('/login', { replace: true });
        } else {
          const targetRoute = getTargetRoute(restoredRequest, currentSession);
          if (targetRoute && targetRoute !== currentPath) {
            navigate(targetRoute, { replace: true });
          }
        }
        return;
      } else {
        // Button-triggered panel without a request: stop loading and return home.
        console.warn('[TRACE-RECOVER:PANEL] request cache miss fallback', {
          attempts: REQUEST_CACHE_POLL_ATTEMPTS,
          elapsed: Date.now() - requestRecoverStart,
          totalElapsed: Date.now() - initStart,
        });
        setInitializing(false);
        navigate('/', { replace: true });
        initializedRef.current = true;
        return;
      }
    }

    // No cached request, check session
    const currentSession = useSessionStore.getState().session;
    const sessionValid = isSessionValid(currentSession);

    console.warn('[TRACE-CONNECT:PANEL] initializeApplication session check', {
      hasSession: !!currentSession,
      sessionValid,
      sessionUserId: currentSession?.userId,
      sessionHost: currentSession?.host,
      pathname: currentPath,
      openedByButton,
      currentSession,
    });

    if (!sessionValid) {
      console.warn(
        '[TRACE-CONNECT:PANEL] initializeApplication → navigate /login (no valid session)',
      );
      setHost('');
      setUserId('');
      // Clear session if invalid
      if (currentSession) {
        setSession(null);
      }
      // Redirect to login if not already there
      if (currentPath !== '/login') {
        navigate('/login', { replace: true });
      }
    } else {
      // Session is valid
      // If on login or initialize pages, redirect to main page
      if (
        currentPath === '/login' ||
        currentPath === '/initialize' ||
        currentPath === '/initialized'
      ) {
        navigate('/', { replace: true });
      } else if (REQUEST_ONLY_ROUTES.has(currentPath)) {
        navigate('/', { replace: true });
      }
    }

    setInitializing(false);
    initializedRef.current = true;
  }, [consumePanelTriggerSource, navigate, setHost, setUserId, setSession]);

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
    if (initializeEffectRanRef.current) return;
    initializeEffectRanRef.current = true;
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
        initializing,
      }}
    >
      {initializing ? <Loading /> : children}
    </RequestContext.Provider>
  );
};

const Loading: React.FC = () => {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ backgroundColor: '#FFFFFF', color: 'rgba(0, 0, 0, 0.52)' }}
    >
      <span
        className="mb-3 h-[12px] w-[12px] animate-pulse rounded-full"
        style={{ backgroundColor: 'var(--sx-brand)' }}
      ></span>
      <span className="text-[0.875rem] font-[800]">Loading data...</span>
    </div>
  );
};

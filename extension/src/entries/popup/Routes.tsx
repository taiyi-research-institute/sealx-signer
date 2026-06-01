import { createHashRouter, Outlet, RouterProvider, useLocation, useRouteError } from 'react-router-dom';
import Login from './components/login';
import Layout from './components/layout';
import { RequestContextProvider } from '@src/providers/RequestContextProvider';
import React, { useCallback } from 'react';
import { ROUTES } from './urls';
import { useSealXNavigate } from './hooks/useSealXNavigate';
import { useErrorStore, useInitializedStore, useSessionStore } from '@src/core/state';
import Initialize from './components/initialize';
import { TaskHome } from './components/task';
import { GlobalConextProvider } from '@src/providers/GlobalContextProvider';
import { useGlobalContext } from '@src/hooks/useGlobalContext';
import ResetPin from './components/reset-pin';
import { SetSessionExpire } from './components/set-session-expire';
import { BindPubKey } from './components/bind-pubkey';
import { KeyManage } from './components/key-manage';
import { KeyExport } from './components/key-manage/export';
import { KeyImport } from './components/key-manage/import';
import { Initialized } from './components/initialize/Initialized';
import { TaskDetail } from './components/task/Task-detail';
import Home from './components/home';
import { useRequestContext } from '@src/hooks/useRequestContextHook';
import GlobalMessageManager from '@src/components/global-message/GlobalMessageManager';


const RootLayout = () => {
    const { pathname, state } = useLocation() as { pathname: string; state: { fromInitialize?: boolean; skipTransitionOnRoute?: string } | null };
    const navigate = useSealXNavigate();
    const { address, lockTime } = useGlobalContext()
    const { setSession } = useRequestContext()
    const checkRoute = useCallback(async () => {
        const session = useSessionStore.getState().session
        const address = useInitializedStore.getState().address
        console.warn('[TRACE-CONNECT:ROUTE] checkRoute', {
            pathname, hasAddress: !!address, lockTime,
            hasSession: !!session, sessionExpire: session?.expire,
            sessionUserId: session?.userId, sessionHost: session?.host,
        })
        if (!address) {
            if (pathname !== '/initialize' && pathname !== '/initialized')
                navigate('/initialize', { replace: true });
        } else if (lockTime > Date.now() && pathname !== '/login') {
            navigate('/login', { replace: true });
        } else {
            if (!session || session.expire < Date.now()) {
                if (pathname !== '/login') navigate('/login', { replace: true })
            } else {
                setSession(session)
            }
        }
    }, [pathname, navigate, lockTime, setSession])
    React.useLayoutEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    // // Additional effect to watch for address changes specifically
    React.useEffect(() => {
        checkRoute()
    }, [address, lockTime, checkRoute]);
    return (
        <div className="w-full h-full relative flex">
            <GlobalMessageManager />
            <Outlet
                // skip the page transition with a unique state.skipTransitionOnRoute
                // the animate presence only runs on the <Outlet /> when it's key changes
                key={state?.skipTransitionOnRoute || pathname}
            />
        </div>

    )
}

const ROUTE_DATA = [
    {
        path: '/initialize',
        element: <Initialize />
    }, {
        path: '/initialized',
        element: <Initialized />
    },
    {
        path: '/login',
        element: <Login />,
    },
    {
        path: '/',
        element: <Layout />,
        children: [
            {
                index: true,
                element: <Home />,
            },
            {
                path: 'task-home',
                element: <TaskHome></TaskHome>
            }, {
                path: 'task-detail',
                element: <TaskDetail />
            }, {
                path: 'reset-pin',
                element: <ResetPin />
            }, {
                path: 'set-screen-timer',
                element: <SetSessionExpire></SetSessionExpire>
            }, {
                path: 'bind-pubkey',
                element: <BindPubKey></BindPubKey>
            }, {
                path: 'key-manage',
                element: <KeyManage></KeyManage>
            },
            {
                path: 'key-export',
                element: <KeyExport></KeyExport>
            },
            {
                path: 'key-import',
                element: <KeyImport></KeyImport>
            }
        ]
    }
]
function Rerouter() {
    const error = useRouteError() as Error;
    const navigate = useSealXNavigate();
    const setError = useErrorStore.use.setError();
    React.useEffect(() => {
        if (error) {
            setError(error); // Set the error in your store
        }
        navigate(ROUTES.HOME, { replace: true }); // Navigate to home
    }, [error, navigate, setError]);

    return null;
}
const router = createHashRouter([
    {
        element: <RequestContextProvider>
            <RootLayout />
        </RequestContextProvider>, children: ROUTE_DATA, errorElement: <Rerouter />
    },
]);
// const router = createHashRouter(ROUTE_DATA);

export const Routes = () => {
    return (
        <GlobalConextProvider>
            <RouterProvider router={router} />
        </GlobalConextProvider>
    );
}

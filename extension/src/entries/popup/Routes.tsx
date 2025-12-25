import { createHashRouter, Outlet, RouterProvider, useLocation, useRouteError } from 'react-router-dom';
import Login from './components/login';
import Layout from './components/layout';
import { RequestContextProvider } from '@src/providers/RequestContextProvider';
import React, { useCallback, useEffect } from 'react';
import { ROUTES } from './urls';
import { useSealXNavigate } from './hooks/useSealXNavigate';
import { useErrorStore, useSessionStore, useSuccessStore } from '@src/core/state';
import Initialize from './components/initialize';
import { TaskHome } from './components/task';
import { GlobalConextProvider } from '@src/providers/GlobalContextProvider';
import { useGlobalContext } from '@src/hooks/useGlobalContext';
import Warning from '@assets/svg/warning.svg?react'
import ResetPin from './components/reset-pin';
import { SetSessionExpire } from './components/set-session-expire';
import { BindPubKey } from './components/bind-pubkey';
import { KeyManage } from './components/key-manage';
import { KeyExport } from './components/key-manage/export';
import { KeyImport } from './components/key-manage/import';
import SelectedIcon from '@assets/svg/selected.svg?react'
// import path from 'path';
import { Initialized } from './components/initialize/Initialized';
import { TaskDetail } from './components/task/Task-detail';
import Home from './components/home';
import { useRequestContext } from '@src/hooks/useRequestContextHook';
// import path from 'path';


const RootLayout = () => {
    const { pathname, state } = useLocation() as { pathname: string; state: { fromInitialize?: boolean; skipTransitionOnRoute?: string } | null };
    const navigate = useSealXNavigate();
    const { address, lockTime } = useGlobalContext()
    const { setSession } = useRequestContext()
    const error = useErrorStore.use.error()
    const setSuccess = useSuccessStore.use.setSuccess()
    const setError = useErrorStore.use.setError()
    const success = useSuccessStore.use.success()
    console.log('Current address value:', address, typeof address);
    const checkRoute = useCallback(async () => {
        console.log('checkRoute called with:', { address, pathname, lockTime });
        const session = useSessionStore.getState().session
        
        if (!address) {
            if (pathname !== '/initialize' && pathname !== '/initialized')
                navigate('/initialize', { replace: true });
        } else if (lockTime > Date.now() && pathname !== '/login') {
            console.log('Redirecting to login');
            navigate('/login', { replace: true });
        } else {
            if (!session || session.expire < Date.now()) {
                if (pathname !== '/login') navigate('/login', { replace: true })
            } else {
                setSession(session)
            }
        }
    }, [pathname, navigate, address, lockTime, setSession])
    React.useLayoutEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    // // Additional effect to watch for address changes specifically
    React.useEffect(() => {
        checkRoute()
    }, [address, lockTime, checkRoute]);
    useEffect(() => {
        if (error) {
            setTimeout(() => {
                setError(null)
            }, 5000)
        }
    }, [error, setError])

    useEffect(() => {
        if (success) {
            setTimeout(() => {
                setSuccess('')
            }, 5000)
        }
    }, [success, setSuccess])

    return (
        <div className="w-full h-full relative flex">
            {error && (
                <div className='bg-[#E0F7EE] pt-[12px] pb-[14px] text-center items-center flex justify-center absolute top-0 z-[9999] w-full font-[500] text-[21px] leading-[25px]'>
                    <Warning className='mr-[13.25px]' />
                    {typeof error === 'string' ? error : error?.message || 'An unknown error occurred'}
                </div>
            )}
            {success && (
                <div className='bg-[#E0F7EE] pt-[12px] pb-[14px] text-center items-center flex justify-center absolute top-0 z-[9999] w-full font-[500] text-[21px] leading-[25px]'>
                    <SelectedIcon className='mr-[13.25px]' />
                    {success || 'An unknown error occurred'}
                </div>
            )}
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
        element: <Home />,
    },
    {
        path: '/',
        element: <Layout />,
        children: [
            {
                path: '/task-home',
                element: <TaskHome></TaskHome>
            }, {
                path: '/task-detail',
                element: <TaskDetail />
            }, {
                path: '/reset-pin',
                element: <ResetPin />
            }, {
                path: '/set-screen-timer',
                element: <SetSessionExpire></SetSessionExpire>
            }, {
                path: '/bind-pubkey',
                element: <BindPubKey></BindPubKey>
            }, {
                path: '/key-manage',
                element: <KeyManage></KeyManage>
            },
            {
                path: '/key-export',
                element: <KeyExport></KeyExport>
            },
            {
                path: '/key-import',
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

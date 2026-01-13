import React, { useCallback, useEffect, useState } from 'react';
import { GlobalContext } from '@src/context/globalConext';
import { checkInitialed } from '@src/core/background';
import { useInitializedStore } from '@src/core/state';
import { lockLogin, loginLockExpire } from '@src/entries/popup/state/session';
import { error } from 'console';

/**
 * Props for GlobalContextProvider component
 */
interface GlobalConextProviderProps {
    /** Child components that will have access to the global context */
    children: React.ReactNode;
}

/**
 * Global context provider that manages:
 * - Authentication state (login attempts, lock time)
 * - Current wallet address
 * - Active browser tab
 * 
 * Provides these values to all child components via React context
 */
const MAX_TIME = 5; // Maximum allowed login attempts
const LOCK_TIME = 10; // Lock duration in minutes after max attempts reached
export const GlobalConextProvider: React.FC<GlobalConextProviderProps> = ({ children }) => {
    // State for tracking login attempts
    const [attempt, setAttempt] = useState<number>(MAX_TIME);
    // State for tracking lock expiration time
    const [lockTime, setLockTime] = useState<number>(0);
    // State for current active browser tab
    const [tab, setTab] = useState<chrome.tabs.Tab>({} as chrome.tabs.Tab);
    // Zustand store hooks for address management
    const setStoreAddress = useInitializedStore.use.setAddress()
    const address = useInitializedStore.use.address()

    const [messageQueueIframe, setMessageQueueIframe] = useState<HTMLIFrameElement>()
    const [messageQueueReady, setMessageQueueReady] = useState<boolean>(false)
    // const messageQueue: Array<Record<string, unknown>> = [];
    const [messageQueue, setMessageQueue] = useState<Array<Record<string, unknown>>>([])

    const setupIframe = useCallback(() => {
        const iframe = document.createElement('iframe');
        iframe.src = chrome.runtime.getURL('src/entries/sandbox/index.html');
        iframe.sandbox.add('allow-scripts');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        setMessageQueueIframe(iframe)

        iframe.addEventListener('load', () => {
            setMessageQueueReady(true)
            while (messageQueue.length) {
                console.log('------------- iframe ready -------')
                const msg = messageQueue.shift();
                setMessageQueue(messageQueue)
                iframe.contentWindow?.postMessage(msg, '*');
            }
        });
    }, [messageQueue])

    const sendToIframe = useCallback((message: Record<string, unknown>) => {
        return new Promise((resolve) => {
            const index = Math.round(Math.random() * 10000)
            const messageId = `T-${Date.now()}-${index}`
            message['messageId'] = messageId
            if (messageQueueIframe && messageQueueReady) {
                console.log('--------- send message 111 -----', message)
                messageQueueIframe?.contentWindow?.postMessage(message, '*');
                const messageHandler = (event: MessageEvent) => {
                    if (event.data && event.data.messageId === messageId) {
                        window.removeEventListener('message', messageHandler as EventListener);
                        resolve(event.data)
                    }
                };
                window.addEventListener('message', messageHandler as EventListener);
            } else {
                messageQueue.push(message);
                resolve({ type: '', output: '', error: 'not ready' })
            }
        })
    }, [messageQueue, messageQueueIframe, messageQueueReady])
    /**
     * Wrapper function for setting the wallet address
     * Handles both direct values and functional updates
     */
    const setAddress = useCallback<React.Dispatch<React.SetStateAction<string>>>(
        (value) => {
            if (typeof value === 'function') {
                setStoreAddress((value as (prevState: string) => string)(address))
            } else {
                setStoreAddress(value)
            }
        },
        [setStoreAddress, address]
    )

    /**
     * Refreshes the current wallet address from background storage
     */
    const refreshAddress = useCallback(async () => {
        const address = await checkInitialed();
        setAddress(address || '');
    }, [setAddress]);

    /**
     * Checks and updates the login lock status
     * - Verifies if account is currently locked
     * - Clears lock if expired
     * - Updates attempt count accordingly
     */
    const checkLock = useCallback(async () => {
        try {
            const storedLock = await loginLockExpire();
            if (storedLock) {
                const expire = Number(storedLock);
                const remainingTime = expire - Date.now();
                if (remainingTime > 0) {
                    setAttempt(0);
                    setLockTime(expire);
                } else {
                    await lockLogin(0);
                    setAttempt(MAX_TIME);
                    setLockTime(0);
                }
            } else {
                setAttempt(MAX_TIME);
                setLockTime(0);
            }
        } catch (e) {
            console.error('Error checking lock status:', e);
        }
    }, [setAttempt, setLockTime]);

    /**
     * Effect to load wallet address on initial render if not already loaded
     */
    useEffect(() => {
        if (!address) refreshAddress();
    }, [address, refreshAddress]);
    /**
     * Effect to check lock status on component mount
     */
    useEffect(() => {
        checkLock();
    }, [checkLock]);

    /**
     * Effect to setup the iframe for message communication
     */
    useEffect(() => {
        setupIframe();
    }, [setupIframe]);

    /**
     * Effect to get and track the current active browser tab
     */
    useEffect(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            setTab(tab)
        });
    }, [setTab])

    return (
        <GlobalContext.Provider
            value={{
                attempt,               // Current login attempt count
                maxLockTime: LOCK_TIME, // Maximum lock duration
                maxAttempt: MAX_TIME,  // Maximum allowed attempts
                address,               // Current wallet address
                setAddress,            // Function to update address
                lockTime,              // Current lock expiration time
                setAttempt,            // Function to update attempt count
                setLockTime,           // Function to update lock time
                refreshAddress,        // Function to refresh address
                tab,                   // Current active browser tab
                setTab,                // Function to update tab reference
                sendToIframe
            }}
        >
            {children}
        </GlobalContext.Provider>
    );
};

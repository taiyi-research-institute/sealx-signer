import React, { createContext } from 'react';

export type GlobalContextType = {
    lockTime: number
    attempt: number
    tab: chrome.tabs.Tab
    maxAttempt: number
    maxLockTime: number
    address: string
    setTab: React.Dispatch<React.SetStateAction<chrome.tabs.Tab>>
    setLockTime: React.Dispatch<React.SetStateAction<number>>
    setAttempt: React.Dispatch<React.SetStateAction<number>>
    setAddress: React.Dispatch<React.SetStateAction<string>>
    refreshAddress: () => Promise<void>
    sendToIframe: (message: Record<string, unknown>) => Promise<any>
};

export const GlobalContext = createContext<GlobalContextType>({} as GlobalContextType);

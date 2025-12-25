import { localStorageWrapper } from 'sealx-core';
import type { StateStorage } from 'zustand/middleware';


export const persistStorage: StateStorage = localStorageWrapper('sealx', 'state')

export const noopStorage: StateStorage = {
    getItem: async (): Promise<string | null> => null,
    setItem: async (): Promise<void> => undefined,
    removeItem: async (): Promise<void> => undefined,
};

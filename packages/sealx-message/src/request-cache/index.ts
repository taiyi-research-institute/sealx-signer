import type { SealxRequest } from '../contracts';

export interface RequestCacheStorage {
    get<T = unknown>(key: string): Promise<T | null>;
    set<T = unknown>(key: string, value: T): Promise<void>;
    remove(key: string): Promise<void>;
}

export interface RequestCacheOptions {
    key?: string;
}

export const DEFAULT_REQUEST_CACHE_KEY = 'sealx-current-request';

export const createRequestCache = (
    storage: RequestCacheStorage,
    options: RequestCacheOptions = {},
) => {
    const key = options.key ?? DEFAULT_REQUEST_CACHE_KEY;
    let memoryRequest: SealxRequest | null = null;

    return {
        set: async (request: SealxRequest) => {
            memoryRequest = request;
            await storage.set(key, request);
        },

        get: async () => {
            if (memoryRequest) return memoryRequest;
            return await storage.get<SealxRequest>(key);
        },

        consume: async () => {
            const request = await storage.get<SealxRequest>(key) ?? memoryRequest;
            memoryRequest = null;
            await storage.remove(key);
            return request;
        },

        clear: async () => {
            memoryRequest = null;
            await storage.remove(key);
        },
    };
};

export type RequestCache = ReturnType<typeof createRequestCache>;

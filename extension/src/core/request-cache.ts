import { createRequestCache, DEFAULT_REQUEST_CACHE_KEY } from 'sealx-message';

export { DEFAULT_REQUEST_CACHE_KEY as REQUEST_CACHE_KEY };

export const requestCache = createRequestCache({
    async get<T = unknown>(key: string) {
        const stored = await chrome.storage.session.get(key);
        return (stored[key] as T | undefined) ?? null;
    },

    async set<T = unknown>(key: string, value: T) {
        await chrome.storage.session.set({ [key]: value });
    },

    async remove(key: string) {
        await chrome.storage.session.remove(key);
    },
});

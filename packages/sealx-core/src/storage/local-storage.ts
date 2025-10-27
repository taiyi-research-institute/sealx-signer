import { StorageLike } from "./storage";
/// <reference types="chrome" />

export class LocalStorageWrapper implements StorageLike {
    private readonly isChromeExtension: boolean;

    constructor(private db: string = '', private table: string = '') {
        this.isChromeExtension = typeof chrome !== 'undefined' &&
            typeof chrome.storage !== 'undefined' &&
            typeof chrome.storage.local !== 'undefined';
    }
    listen<TValue = unknown>(key: string, callback: (newValue: TValue, oldValue: TValue) => void): () => void {
        key = this.getNamespacedKey(key)
        const listener = (changes: {
            [key: string]: chrome.storage.StorageChange;
        }) => {
            if (!changes[key] || changes[key]?.newValue === changes[key]?.oldValue)
                return;
            const newValue = changes[key]?.newValue;
            const oldValue = changes[key]?.oldValue;
            callback(newValue, oldValue);
        };
        chrome.storage?.local?.onChanged?.addListener(listener);
        return () => chrome.storage?.local?.onChanged?.removeListener(listener);
    }

    public get namespace() {
        if (this.db) {
            if (this.table) {
                return `${this.db}:${this.table}`;
            }
            return `${this.db}`;
        }
        return '';
    }

    private getNamespacedKey(key: string): string {
        return this.namespace ? `${this.namespace}:${key}` : key;
    }

    async getItem<T = any>(key: string): Promise<T | null> {
        const namespacedKey = this.getNamespacedKey(key);

        if (this.isChromeExtension) {
            return new Promise((resolve) => {
                chrome.storage.local.get([namespacedKey], (result) => {
                    resolve(chrome.runtime.lastError ? null : (result[namespacedKey] ?? null));
                });
            });
        }

        const value = localStorage.getItem(namespacedKey);
        return value ? JSON.parse(value) as T : null;
    }

    async setItem<T = any>(key: string, value: T): Promise<T> {
        const namespacedKey = this.getNamespacedKey(key);

        if (this.isChromeExtension) {
            return new Promise((resolve) => {
                chrome.storage.local.set({ [namespacedKey]: value }, () => resolve(value));
            });
        }

        localStorage.setItem(namespacedKey, JSON.stringify(value));
        return value
    }

    async removeItem(key: string): Promise<void> {
        const namespacedKey = this.getNamespacedKey(key);

        if (this.isChromeExtension) {
            return new Promise((resolve) => {
                chrome.storage.local.remove([namespacedKey], () => resolve());
            });
        }

        localStorage.removeItem(namespacedKey);
    }

    async clear(): Promise<void> {
        if (this.isChromeExtension) {
            if (!this.namespace) {
                return new Promise((resolve) => {
                    chrome.storage.local.clear(() => resolve());
                });
            }

            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    const keysToRemove = Object.keys(items)
                        .filter(key => key.startsWith(`${this.namespace}:`));
                    chrome.storage.local.remove(keysToRemove, () => resolve());
                });
            });
        }

        if (!this.namespace) {
            localStorage.clear();
            return;
        }

        // Remove only items with current namespace
        Object.keys(localStorage)
            .filter(key => key.startsWith(`${this.namespace}:`))
            .forEach(key => localStorage.removeItem(key));
    }
}

/// <reference types="chrome" />
class LocalStorageWrapper {
    db;
    table;
    isChromeExtension;
    constructor(db = '', table = '') {
        this.db = db;
        this.table = table;
        this.isChromeExtension = typeof chrome !== 'undefined' &&
            typeof chrome.storage !== 'undefined' &&
            typeof chrome.storage.local !== 'undefined';
    }
    listen(key, callback) {
        key = this.getNamespacedKey(key);
        const listener = (changes) => {
            if (!changes[key] || changes[key]?.newValue === changes[key]?.oldValue)
                return;
            const newValue = changes[key]?.newValue;
            const oldValue = changes[key]?.oldValue;
            callback(newValue, oldValue);
        };
        chrome.storage?.local?.onChanged?.addListener(listener);
        return () => chrome.storage?.local?.onChanged?.removeListener(listener);
    }
    get namespace() {
        if (this.db) {
            if (this.table) {
                return `${this.db}:${this.table}`;
            }
            return `${this.db}`;
        }
        return '';
    }
    getNamespacedKey(key) {
        return this.namespace ? `${this.namespace}:${key}` : key;
    }
    async getItem(key) {
        const namespacedKey = this.getNamespacedKey(key);
        if (this.isChromeExtension) {
            return new Promise((resolve) => {
                chrome.storage.local.get([namespacedKey], (result) => {
                    resolve(chrome.runtime.lastError ? null : (result[namespacedKey] ?? null));
                });
            });
        }
        const value = localStorage.getItem(namespacedKey);
        return value ? JSON.parse(value) : null;
    }
    async setItem(key, value) {
        const namespacedKey = this.getNamespacedKey(key);
        if (this.isChromeExtension) {
            return new Promise((resolve) => {
                chrome.storage.local.set({ [namespacedKey]: value }, () => resolve(value));
            });
        }
        localStorage.setItem(namespacedKey, JSON.stringify(value));
        return value;
    }
    async removeItem(key) {
        const namespacedKey = this.getNamespacedKey(key);
        if (this.isChromeExtension) {
            return new Promise((resolve) => {
                chrome.storage.local.remove([namespacedKey], () => resolve());
            });
        }
        localStorage.removeItem(namespacedKey);
    }
    async clear() {
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

export { LocalStorageWrapper };
//# sourceMappingURL=local-storage.mjs.map

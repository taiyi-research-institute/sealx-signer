import { StorageLike } from "./storage";

export class IndexedDBWrapper implements StorageLike {
    private dbName: string;
    private storeName: string;
    private dbPromise: Promise<IDBDatabase>;

    // private static version: number = 0

    private listeners = new Map<string, Set<(newValue: any, oldValue: any) => void>>();

    constructor(dbName = 'app-db', storeName = 'keyval') {
        this.dbName = dbName;
        this.storeName = storeName;
        // IndexedDBWrapper.version++
        this.dbPromise = this.openDB().then(db => {
            db.addEventListener('versionchange', () => {
                this.notifyListeners();
            });
            return db;
        });
    }

    private async notifyListeners() {
        for (const [key, callbacks] of this.listeners) {
            const oldValue = await this.getItem(key);
            const newValue = await this.getItem(key); // Get fresh value

            if (oldValue !== newValue) {
                callbacks.forEach(cb => cb(newValue, oldValue));
            }
        }
    }

    listen<TValue = unknown>(key: string, callback: (newValue: TValue, oldValue: TValue) => void): () => void {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key)?.add(callback);

        return () => {
            this.listeners.get(key)?.delete(callback);
            if (this.listeners.get(key)?.size === 0) {
                this.listeners.delete(key);
            }
        };
    }


    private openDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    private async withStore<T>(
        mode: IDBTransactionMode,
        callback: (store: IDBObjectStore) => Promise<T>
    ): Promise<T> {
        const db = await this.dbPromise;
        return new Promise<T>((resolve, reject) => {
            const tx = db.transaction(this.storeName, mode);
            const store = tx.objectStore(this.storeName);
            callback(store)
                .then(resolve)
                .catch(reject);
            tx.oncomplete = () => { };
            tx.onerror = () => reject(tx.error);
        });
    }

    async getItem<T = any>(key: string): Promise<T | null> {
        return this.withStore('readonly', store => {
            return new Promise((resolve, reject) => {
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result ?? null);
                req.onerror = () => reject(req.error);
            });
        });
    }

    async setItem<T = any>(key: string, value: T): Promise<T> {
        return this.withStore('readwrite', store => {
            return new Promise((resolve, reject) => {
                const req = store.put(value, key);
                req.onsuccess = () => resolve(value);
                req.onerror = () => reject(req.error);
            });
        });
    }

    async removeItem(key: string): Promise<void> {
        return this.withStore('readwrite', store => {
            return new Promise((resolve, reject) => {
                const req = store.delete(key);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        });
    }

    async clear(): Promise<void> {
        return this.withStore('readwrite', store => {
            return new Promise((resolve, reject) => {
                const req = store.clear();
                req.onsuccess = () => {
                    // Notify all listeners that their values have been cleared
                    this.listeners.forEach((callbacks, key) => {
                        callbacks.forEach(cb => cb(null, null));
                    });
                    resolve();
                };
                req.onerror = () => reject(req.error);
            });
        });
    }

    async close() {
        const db = await this.dbPromise
        db.close()
    }
}

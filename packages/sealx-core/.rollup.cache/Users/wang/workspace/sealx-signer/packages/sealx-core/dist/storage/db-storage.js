export class IndexedDBWrapper {
    dbName;
    storeName;
    dbPromise;
    // private static version: number = 0
    listeners = new Map();
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
    async notifyListeners() {
        for (const [key, callbacks] of this.listeners) {
            const oldValue = await this.getItem(key);
            const newValue = await this.getItem(key); // Get fresh value
            if (oldValue !== newValue) {
                callbacks.forEach(cb => cb(newValue, oldValue));
            }
        }
    }
    listen(key, callback) {
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
    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName);
            request.onupgradeneeded = () => {
                const db = request.result;
                const contains = db.objectStoreNames.contains(this.storeName);
                console.log(`-------------db open ${this.dbName} contains ${this.storeName} ${contains ? 'true' : 'false'}--------------`);
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
                console.log(`-------------db create  ${this.storeName} ${db.objectStoreNames.contains(this.storeName) ? 'true' : 'false'}--------------`);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    async withStore(mode, callback) {
        const db = await this.dbPromise;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, mode);
            const store = tx.objectStore(this.storeName);
            callback(store)
                .then(resolve)
                .catch(reject);
            tx.oncomplete = () => { };
            tx.onerror = () => reject(tx.error);
        });
    }
    async getItem(key) {
        return this.withStore('readonly', store => {
            return new Promise((resolve, reject) => {
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result ?? null);
                req.onerror = () => reject(req.error);
            });
        });
    }
    async setItem(key, value) {
        return this.withStore('readwrite', store => {
            return new Promise((resolve, reject) => {
                const req = store.put(value, key);
                req.onsuccess = () => resolve(value);
                req.onerror = () => reject(req.error);
            });
        });
    }
    async removeItem(key) {
        return this.withStore('readwrite', store => {
            return new Promise((resolve, reject) => {
                const req = store.delete(key);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        });
    }
    async clear() {
        return this.withStore('readwrite', store => {
            return new Promise((resolve, reject) => {
                const req = store.clear();
                req.onsuccess = (req) => {
                    // Notify all listeners that their values have been cleared
                    this.listeners.forEach((callbacks, key) => {
                        callbacks.forEach(cb => cb(null, null));
                    });
                    console.log('--------- clear ------', req);
                    resolve();
                };
                req.onerror = () => reject(req.error);
            });
        });
    }
    async close() {
        const db = await this.dbPromise;
        db.close();
    }
}
//# sourceMappingURL=db-storage.js.map
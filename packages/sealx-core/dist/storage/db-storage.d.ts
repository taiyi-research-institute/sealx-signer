import { StorageLike } from "./storage";
export declare class IndexedDBWrapper implements StorageLike {
    private dbName;
    private storeName;
    private dbPromise;
    private listeners;
    constructor(dbName?: string, storeName?: string);
    private notifyListeners;
    listen<TValue = unknown>(key: string, callback: (newValue: TValue, oldValue: TValue) => void): () => void;
    private openDB;
    private withStore;
    getItem<T = any>(key: string): Promise<T | null>;
    setItem<T = any>(key: string, value: T): Promise<T>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=db-storage.d.ts.map
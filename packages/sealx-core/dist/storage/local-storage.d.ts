import { StorageLike } from "./storage";
export declare class LocalStorageWrapper implements StorageLike {
    private db;
    private table;
    private readonly isChromeExtension;
    constructor(db?: string, table?: string);
    listen<TValue = unknown>(key: string, callback: (newValue: TValue, oldValue: TValue) => void): () => void;
    get namespace(): string;
    private getNamespacedKey;
    getItem<T = any>(key: string): Promise<T | null>;
    setItem<T = any>(key: string, value: T): Promise<T>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
}
//# sourceMappingURL=local-storage.d.ts.map
export interface StorageLike {
    getItem<T = any>(key: string): Promise<T | null>;
    setItem<T = any>(key: string, value: T): Promise<T>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
    listen<TValue = unknown>(key: string, callback: (newValue: TValue, oldValue: TValue) => void): () => void;
}
//# sourceMappingURL=storage.d.ts.map
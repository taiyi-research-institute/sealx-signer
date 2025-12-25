import type { PersistOptions } from "zustand/middleware";

export interface StatePersistOptions<T> extends PersistOptions<T> {
    serialize?: (state: T) => string;
    deserialize?: (str: string) => T;
}
import type { StoreApi, UseBoundStore } from 'zustand';

type WithSelectors<S> = S extends { getState: () => infer T }
    ? S & { use: { [K in keyof T]: () => T[K] } }
    : S & { use: Record<string, () => never> };
export interface StateType {
    [key: string]: unknown;
}
export function withSelectors<S extends UseBoundStore<StoreApi<object>>>(
    _store: S,
) {
    const store = _store as WithSelectors<S>;
    const state = store.getState() as StateType
    const stateKeys = Object.keys(state)
    const use: Record<string, () => never> = {}
    for (const k of stateKeys) {
        use[k] = () => store((s) => s[k as keyof typeof s]);
    }
    store.use = use
    return store;
}

import { type PersistOptions, createJSONStorage, persist } from 'zustand/middleware';
import type { Mutate, StoreApi } from 'zustand/vanilla';
import { create } from 'zustand'

import { noopStorage, persistStorage } from './persistStorage';

type Initializer<TState> = Parameters<typeof persist<TState>>[0];
export type StoreWithPersist<TState> = Mutate<
    StoreApi<TState>,
    [['zustand/persist', unknown]]
> & {
    initializer: Initializer<TState>;
};

export function createStore<TState>(
    initializer: Initializer<TState>,
    { persist: persistOptions }: { persist?: PersistOptions<TState> } = {},
) {
    const name = `zustand.${persistOptions?.name}`;
    return Object.assign(
        create(
            persist(initializer, {
                ...persistOptions,
                name,
                storage: createJSONStorage(() => persistOptions ? persistStorage : noopStorage),
            }),
        ),
        { initializer },
    );
}

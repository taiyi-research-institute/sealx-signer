// import { LocalStorage } from '~/core/storage';

import * as stores from '../index';

import type { StoreWithPersist } from './createStore';
import type { StatePersistOptions } from '../types/persist';
import { localStorageWrapper } from 'sealx-core';

async function syncStore({ store }: { store: StoreWithPersist<unknown> }) {
    if (!store.persist) return;
    const LocalStorage = localStorageWrapper('sealx', 'state')
    const persistOptions: StatePersistOptions<unknown> = {
        ...store.persist.getOptions(),
        name: store.persist.getOptions().name || 'defaultName',
    };
    const storageName = persistOptions.name || '';

    const listener = async (changedStore: StoreWithPersist<unknown>) => {
        if (changedStore === undefined) {
            // Retrieve the default state from the store initializer.
            const state = store.initializer(
                () => undefined,
                () => null,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                {} as any,
            );
            const version = persistOptions.version;
            const newStore = persistOptions.serialize?.({ state, version });
            await LocalStorage.setItem(storageName, newStore);
        }
        store.persist.rehydrate();
    };

    LocalStorage.listen(storageName, listener);
}

export function syncStores() {
    Object.values(stores).forEach((store) => {
        if (typeof store === 'function') return;
        if (typeof store === 'object' && store !== null && 'persist' in store) {
            syncStore({ store: store as StoreWithPersist<unknown> });
        }
    });
}

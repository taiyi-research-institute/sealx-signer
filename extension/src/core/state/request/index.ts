import { createStore } from '../internal/createStore';
import { withSelectors } from '../internal/withSelectors';
import type { SealxRequest } from 'sealx-message';

export interface RequestState {
    request: SealxRequest | null;
    setRequest: (request: SealxRequest) => void;
    clearRequest: () => void;
}

export const requestStore = createStore<RequestState>((set) => ({
    request: null,

    setRequest: (request: SealxRequest) => {
        set({ request });
    },

    clearRequest: () => {
        set({ request: null });
    }
}), {
    persist: {
        name: 'request'
    }
});

export const useRequestStore = withSelectors(requestStore);

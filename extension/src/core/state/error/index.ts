import { createStore } from '../internal/createStore';
import { withSelectors } from '../internal/withSelectors';

export interface ErrorState {
    error: Error | string | null;
    setError: (e: Error | string | null) => void;
}

export const errorStore = createStore<ErrorState>((set) => ({
    error: null,
    setError: (error) => {
        set({ error })
    },
}));
export const useErrorStore = withSelectors(errorStore);

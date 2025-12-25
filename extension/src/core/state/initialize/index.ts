import { createStore } from '../internal/createStore';
import { withSelectors } from '../internal/withSelectors';

export interface InitializedState {
    address: string;
    setAddress: (address: string) => void;
}

export const initializedStore = createStore<InitializedState>((set) => ({
    address: '',
    setAddress: (address: string) => {
        set({ address })
    },
}), { persist: { name: 'initialized' } });
export const useInitializedStore = withSelectors(initializedStore);
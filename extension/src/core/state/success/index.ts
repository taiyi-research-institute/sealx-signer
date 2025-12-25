import { createStore } from '../internal/createStore';
import { withSelectors } from '../internal/withSelectors';

export interface SuccessState {
    success: string;
    setSuccess: (e: string) => void;
}

export const successStore = createStore<SuccessState>((set) => ({
    success: '',
    setSuccess: (success) => {
        set({ success })
    },
}));
export const useSuccessStore = withSelectors(successStore);

import { useCallback } from 'react';
import {
    type NavigateOptions,
    type To,
    useLocation,
    useNavigate,
} from 'react-router-dom';

export function useSealXNavigate() {
    const location = useLocation();
    const navigate = useNavigate();

    return useCallback(
        (to: To | number, options?: NavigateOptions) => {
            if (typeof to === 'number') {
                navigate(to);
                return;
            }


            navigate(to as To, {
                ...(options || {}),
                state: {
                    ...options?.state,
                    from: location.pathname,
                },
            });
        },
        [location.pathname, navigate],
    );
}

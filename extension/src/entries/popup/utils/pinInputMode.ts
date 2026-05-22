import type { SealxRequest } from 'sealx-message';
import { usePopupType } from '@src/hooks/usePopupType';
import { useEffect, useState } from 'react';

type ChromeWindowState = chrome.windows.windowStateEnum | 'unknown';

export const usePinInputMode = (request?: SealxRequest | null) => {
    const { isSidePanel } = usePopupType();
    const [windowState, setWindowState] = useState<ChromeWindowState>('unknown');

    useEffect(() => {
        let mounted = true;

        const updateWindowState = async () => {
            try {
                if (typeof chrome === 'undefined' || !chrome.windows?.getCurrent) {
                    if (mounted) setWindowState('unknown');
                    return;
                }

                const currentWindow = await chrome.windows.getCurrent();
                if (mounted) setWindowState(currentWindow.state || 'unknown');
            } catch {
                if (mounted) setWindowState('unknown');
            }
        };

        const handleWindowChange = () => {
            updateWindowState();
        };

        updateWindowState();
        if (typeof chrome !== 'undefined') {
            chrome.windows?.onFocusChanged?.addListener(handleWindowChange);
        }
        window.addEventListener('resize', handleWindowChange);

        return () => {
            mounted = false;
            if (typeof chrome !== 'undefined') {
                chrome.windows?.onFocusChanged?.removeListener(handleWindowChange);
            }
            window.removeEventListener('resize', handleWindowChange);
        };
    }, []);

    return {
        clickToType: isSidePanel && windowState === 'fullscreen',
        clickToTypeKey: request?.header?.requestId || '',
    };
};

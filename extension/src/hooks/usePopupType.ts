import { useState, useEffect } from 'react';

/**
 * Hook to determine if the popup was opened via chrome.window.create, action.popup, chrome.tabs.create, or sidepanel
 * @returns {Object} Object containing popup type information
 */
export const usePopupType = () => {
    const [popupType, setPopupType] = useState<'window' | 'action' | 'tab' | 'sidepanel' | 'unknown'>('unknown');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const determinePopupType = async () => {
            try {
                // Check if we're in a Chrome extension context
                if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.windows) {
                    console.warn('Chrome API not available, assuming window popup');
                    setPopupType('window');
                    setIsLoading(false);
                    return;
                }

                const currentWindow = await chrome.windows.getCurrent();
                const currentTab = await chrome.tabs.getCurrent();

                // ===== Side Panel 检测 =====
                // Side Panel 中 chrome.tabs.getCurrent() 返回 undefined（多数情况）
                // Side Panel 中 chrome.windows.getCurrent() 返回 type: 'normal'
                // 排除 tab 模式：如果 currentTab 存在且能在 allTabs 中找到，说明是 tab 模式
                let isTabMode = false
                if (currentWindow?.type === 'normal' && currentTab) {
                    const allTabs = await chrome.tabs.query({});
                    isTabMode = allTabs.some(tab => tab.id === currentTab.id && tab.windowId === currentWindow.id);
                }

                const isLikelySidePanel = !isTabMode && (
                    (currentWindow?.type === 'normal' && !currentTab) ||
                    (currentWindow?.type === 'normal' && currentTab?.url?.includes('src/entries/popup/index.html'))
                )

                if (isLikelySidePanel) {
                    setPopupType('sidepanel');
                    setIsLoading(false);
                    return;
                }

                // URL hash 参数检测（URL 参数优先级最高）
                const urlParams = new URLSearchParams(window.location.search);
                const hashParams = new URLSearchParams(window.location.hash.substring(1));

                if (urlParams.get('popupType') === 'sidepanel' || hashParams.get('popupType') === 'sidepanel') {
                    setPopupType('sidepanel');
                    setIsLoading(false);
                    return;
                } else if (urlParams.get('popupType') === 'action' || hashParams.get('popupType') === 'action') {
                    setPopupType('action');
                    setIsLoading(false);
                    return;
                } else if (urlParams.get('popupType') === 'window' || hashParams.get('popupType') === 'window') {
                    setPopupType('window');
                    setIsLoading(false);
                    return;
                } else if (urlParams.get('popupType') === 'tab' || hashParams.get('popupType') === 'tab') {
                    setPopupType('tab');
                    setIsLoading(false);
                    return;
                }


                // Detect tab mode
                if (currentWindow.type === 'normal' && currentTab) {
                    const allTabs = await chrome.tabs.query({});
                    const isRegularTab = allTabs.some(tab => tab.id === currentTab.id && tab.windowId === currentWindow.id);

                    if (isRegularTab) {
                        setPopupType('tab');
                        setIsLoading(false);
                        return;
                    }
                }

                // Detect window popup
                if (currentWindow.type === 'popup') {
                    if (currentWindow.width && currentWindow.width >= 400 && currentWindow.width <= 800 || currentWindow.height && currentWindow.height > 600) {
                        setPopupType('window');
                        setIsLoading(false);
                        return;
                    } else {
                        setPopupType('action');
                        setIsLoading(false);
                        return;
                    }
                }

                // Check if we can access chrome.action API
                if (typeof chrome.action !== 'undefined' && chrome.action.getPopup) {
                    try {
                        const popupDetails = await chrome.action.getPopup({});
                        if (popupDetails) {
                            setPopupType('action');
                            setIsLoading(false);
                            return;
                        }
                    } catch {
                        // If getPopup fails, continue with other detection methods
                    }
                }

                // Default to action popup
                setPopupType('action');

            } catch (error) {
                console.warn('Error determining popup type:', error);
                setPopupType('unknown');
            } finally {
                setIsLoading(false);
            }
        };

        determinePopupType();
    }, []);

    return {
        popupType,
        isLoading,
        isWindowPopup: popupType === 'window',
        isActionPopup: popupType === 'action',
        isTabPopup: popupType === 'tab',
        isSidePanel: popupType === 'sidepanel',
    };
};

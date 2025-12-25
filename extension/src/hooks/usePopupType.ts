import { useState, useEffect } from 'react';

/**
 * Hook to determine if the popup was opened via chrome.window.create, action.popup, or chrome.tabs.create
 * @returns {Object} Object containing popup type information
 */
export const usePopupType = () => {
    const [popupType, setPopupType] = useState<'window' | 'action' | 'tab' | 'unknown'>('unknown');
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

                // Method 1: Check window and tab properties
                const currentWindow = await chrome.windows.getCurrent();
                const currentTab = await chrome.tabs.getCurrent();
                console.log('------- current window -----', currentWindow)
                // Method 2: Check URL parameters or hash first (highest priority)
                const urlParams = new URLSearchParams(window.location.search);
                const hashParams = new URLSearchParams(window.location.hash.substring(1));

                if (urlParams.get('popupType') === 'action' || hashParams.get('popupType') === 'action') {
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


                // Method 4: Detect tab mode
                // If we're in a normal tab (not popup window) and not an action popup, it's likely a tab
                if (currentWindow.type === 'normal' && currentTab) {
                    // Check if this is a regular browser tab
                    const allTabs = await chrome.tabs.query({});
                    const isRegularTab = allTabs.some(tab => tab.id === currentTab.id && tab.windowId === currentWindow.id);

                    if (isRegularTab) {
                        setPopupType('tab');
                        setIsLoading(false);
                        return;
                    }
                }

                // Method 5: Detect window popup
                // If window type is 'popup' and has specific dimensions, it's likely from chrome.window.create
                if (currentWindow.type === 'popup') {
                    // Check if this is a standalone popup window (created via chrome.window.create)
                    // These typically have specific dimensions and are not the browser action popup
                    if (currentWindow.width && currentWindow.width >= 400 && currentWindow.width <= 800 || currentWindow.height && currentWindow.height > 600) {
                        setPopupType('window');
                        setIsLoading(false);
                        return;
                    } else {
                        // For action popups, the window dimensions might be different or unavailable
                        setPopupType('action');
                        setIsLoading(false);
                        return;
                    }
                }

                // Method 3: Check if we can access chrome.action API (only available in action popups)
                if (typeof chrome.action !== 'undefined' && chrome.action.getPopup) {
                    try {
                        const popupDetails = await chrome.action.getPopup({});
                        console.log('------- popup --------', popupDetails)
                        if (popupDetails) {
                            setPopupType('action');
                            setIsLoading(false);
                            return;
                        }
                    } catch {
                        // If getPopup fails, continue with other detection methods
                    }
                }



                // Method 6: Default to action popup if none of the above conditions match
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
        isTabPopup: popupType === 'tab'
    };
};

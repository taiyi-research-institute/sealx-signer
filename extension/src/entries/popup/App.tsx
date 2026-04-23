import { useEffect } from 'react';
import { useRequestContext } from '@src/hooks/useRequestContextHook';
import './App.css';
import { Routes } from './Routes';
import { useMemo } from 'react';
import { usePopupType } from '@src/hooks/usePopupType';
import { TabManager } from 'sealx-core';



function App() {
    const { request } = useRequestContext()
    const isFullscreen = useMemo(() => {
        return request?.header?.fullscreen
    }, [request])


    // 使用防止全屏的钩子
    // usePreventFullscreen();

    const { popupType } = usePopupType()

    // 设置body元素的popup-mode属性
    useEffect(() => {
        if (popupType && popupType !== 'unknown') {
            document.body.setAttribute('popup-mode', popupType);
        } else {
            document.body.removeAttribute('popup-mode');
        }
        const updateTab = (_tabId: number, _changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
            TabManager.getInstance().currentTab = tab
        }
        chrome.tabs.onUpdated.addListener(updateTab)
        // document.getElementById('authBtn')?.addEventListener('click', handleGoogleDriveBackup);
        // 清理函数
        return () => {
            document.body.removeAttribute('popup-mode');
            chrome.tabs.onUpdated.removeListener(updateTab)
            // document.getElementById('authBtn')?.removeEventListener('click', handleGoogleDriveBackup);
        };
    }, [popupType]);

    return (
        <div className='sealx-container relative flex' style={isFullscreen ? { marginTop: "120px" } : {}}>
            {/* <span className=' absolute z-[1000] top-[10px] '>{popupType}</span> */}
            <Routes></Routes>
            {/* <button id="authBtn" style={{ position: 'absolute', bottom: '10px', right: '10px', zIndex: 1000 }}>Authenticate with OAuth</button> */}
        </div>
    );
}

export default App;

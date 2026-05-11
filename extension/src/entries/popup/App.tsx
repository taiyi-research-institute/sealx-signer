import { useEffect } from 'react';
import { useRequestContext } from '@src/hooks/useRequestContextHook';
import './App.css';
import { Routes } from './Routes';
import { useMemo } from 'react';
import { usePopupType } from '@src/hooks/usePopupType';
import { TabManager } from 'sealx-core';
import { ErrorBoundary } from './components/ErrorBoundary';



function App() {
    const { request } = useRequestContext()
    const isFullscreen = useMemo(() => {
        return request?.header?.fullscreen
    }, [request])

    const { popupType } = usePopupType()
    const isSidePanel = popupType === 'sidepanel'

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
        // 清理函数
        return () => {
            document.body.removeAttribute('popup-mode');
            chrome.tabs.onUpdated.removeListener(updateTab)
        };
    }, [popupType]);

    // ========== Side Panel 心跳发送 ==========
    useEffect(() => {
        // 每 3 秒向 background 发送心跳，证明自己还活着
        const heartbeatTimer = setInterval(() => {
            chrome.runtime.sendMessage({ type: 'panel-heartbeat' })
        }, 3_000)

        // 页面加载完成后立即发送就绪消息
        // 确保 React Router 已挂载
        const readyTimer = setTimeout(() => {
            chrome.runtime.sendMessage(
                { type: 'panel-ready', route: window.location.hash },
                () => {
                    if (chrome.runtime.lastError) {
                        console.warn('Failed to send panel-ready:', chrome.runtime.lastError)
                    }
                }
            )
        }, 500)  // 等 React 初始化完成

        return () => {
            clearInterval(heartbeatTimer)
            clearTimeout(readyTimer)
        };
    }, []);

    // ========== 导航消息监听 ==========
    useEffect(() => {
        const navigateHandler = (message: { type?: string; route?: string }, _sender: chrome.runtime.MessageSender, sendResponse: (response: { ok: boolean }) => void) => {
            if (message?.type === 'panel-navigate' && message?.route !== undefined) {
                const currentHash = window.location.hash
                const newHash = message.route ? `#${message.route}` : '#'
                if (currentHash !== newHash) {
                    window.history.replaceState(null, '', newHash)
                    window.dispatchEvent(new HashChangeEvent('hashchange'))
                }
                sendResponse({ ok: true })
                return true
            }
        }

        chrome.runtime.onMessage.addListener(navigateHandler)
        return () => {
            chrome.runtime.onMessage.removeListener(navigateHandler)
        };
    }, []);

    // ========== close-popup 消息监听（保留兼容） ==========
    useEffect(() => {
        const closeHandler = (message: { type?: string }, _sender: chrome.runtime.MessageSender, sendResponse: (response: { navigated: boolean }) => void) => {
            if (message?.type === 'close-popup') {
                // Side Panel 模式下不关闭，改为导航回首页
                window.location.hash = '#'
                sendResponse({ navigated: true })
            }
        }
        chrome.runtime.onMessage.addListener(closeHandler)
        return () => {
            chrome.runtime.onMessage.removeListener(closeHandler)
        };
    }, []);

    // ========== 面板关闭前清理 ==========
    useEffect(() => {
        const handleBeforeUnload = () => {
            chrome.runtime.sendMessage({
                type: 'panel-closing',
                route: window.location.hash
            });
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('pagehide', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handleBeforeUnload);
        };
    }, []);

    return (
        <ErrorBoundary>
            <div className='sealx-container w-full min-h-full relative flex' style={isFullscreen && !isSidePanel ? { marginTop: "120px" } : {}}>
                <Routes></Routes>
            </div>
        </ErrorBoundary>
    );
}

export default App;

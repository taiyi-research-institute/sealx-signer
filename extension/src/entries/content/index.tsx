import { createRoot } from 'react-dom/client';
import './style.css'
import { SealX } from './SealX';

function injectScript(file: string) {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL(file); // 如：inpage.js
    script.type = "text/javascript";
    script.async = false;
    (document.head || document.documentElement)?.appendChild(script);
    script.remove(); // 清理 DOM
}

function waitForBody(callback: () => void) {
    // 如果body已经存在，直接执行回调
    if (document.body) {
        callback();
        return;
    }

    // 检查文档加载状态
    if (document.readyState !== 'loading') {
        // 文档已经加载完成，立即执行
        callback();
        return;
    }

    // 否则等待DOMContentLoaded事件
    const onDOMContentLoaded = () => {
        callback();
        document.removeEventListener('DOMContentLoaded', onDOMContentLoaded);
    };

    document.addEventListener('DOMContentLoaded', onDOMContentLoaded);
}

function initializeSealX() {
    if (document.getElementById('sealXContainer')) {
        injectScript('inpage.js');
        return;
    }

    // 创建 Shadow DOM host 元素
    const shadowHost = document.createElement('div');
    shadowHost.id = 'sealXContainer';
    shadowHost.style.cssText = 'all: initial;'; // 隔离全局样式

    // 附加 Shadow DOM
    const shadowRoot = shadowHost.attachShadow({ mode: 'open' });

    // 将样式复制到 shadow DOM 中
    const styleElement = document.createElement('style');
    // 获取全局样式
    const globalStyles = document.querySelector('style[data-vite-dev-id*="global"]')?.textContent || '';
    const tailwindStyles = document.querySelector('style[data-vite-dev-id*="tailwind"]')?.textContent || '';
    styleElement.textContent = globalStyles + tailwindStyles;
    shadowRoot.appendChild(styleElement);

    // 在 shadow DOM 中创建 React 根容器
    const reactRoot = document.createElement('div');
    reactRoot.id = 'sealXReactRoot';
    shadowRoot.appendChild(reactRoot);

    // 将 shadow host 添加到 body
    document.body.appendChild(shadowHost);

    const rootContainer = shadowRoot.querySelector('#sealXReactRoot');
    if (!rootContainer) throw new Error("Can't find Content root element");

    const root = createRoot(rootContainer);
    root.render(<SealX />);
    injectScript('inpage.js');
}

// ===== 手势中继：事件委托监听 SealX 操作组件 =====
// 用户在 HTML 元素上定义 sealx 属性（如 <button sealx>），
// SDK 自动将其转换为 data-sealx-action="open"。
// Content script 通过事件委托，只在点击带该属性的元素时，
// 在 transient activation 窗口内发送 open-side-panel 消息。
document.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement)?.closest?.('[data-sealx-action="open"]')
    if (!target) return

    chrome.runtime.sendMessage({ type: 'open-side-panel' }).catch((err) => {
        console.warn('[SealX] Failed to send open-side-panel:', err?.message)
    })
})

// 等待body加载完成后初始化
waitForBody(initializeSealX);

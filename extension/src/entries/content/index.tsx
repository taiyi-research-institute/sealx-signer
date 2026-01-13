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
    const div = document.createElement('div');
    div.id = 'sealXContainer';
    document.body.appendChild(div);

    const rootContainer = document.querySelector('#sealXContainer');
    if (!rootContainer) throw new Error("Can't find Content root element");

    const root = createRoot(rootContainer);
    root.render(<SealX />);
    injectScript('inpage.js');
}

// 等待body加载完成后初始化
waitForBody(initializeSealX);

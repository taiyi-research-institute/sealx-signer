import { createRoot } from 'react-dom/client';
import './style.css'
import { SealX } from './SealX';

const openSidePanel = (e: MouseEvent) => {
  console.log('[SealX] Click event:', e.target);
  const target = (e.target as HTMLElement)?.closest?.(
    '[data-sealx-action="open"]',
  );
  if (!target) return;

  armPinKeyRelay();
  chrome.runtime.sendMessage({ type: 'open-side-panel' }).catch((err) => {
    stopPinKeyRelay();
    console.warn('[SealX] Failed to send open-side-panel:', err?.message);
  });
};

function injectScript(file: string) {
    if (document.documentElement.hasAttribute('data-sealx-inpage-injected')) {
        return;
    }
    document.documentElement.setAttribute('data-sealx-inpage-injected', 'true');

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(file); // 如：inpage.js
    script.type = 'text/javascript';
    script.async = false;
    (document.head || document.documentElement)?.appendChild(script);
    script.remove(); // 清理 DOM
}

injectScript('inpage.js');

const PIN_KEY_RELAY_TIMEOUT_MS = 120_000;
const PIN_KEY_RELAY_MESSAGE = 'sealx-pin-relay-keydown';

let pinKeyRelayTimer: ReturnType<typeof setTimeout> | null = null;

function stopPinKeyRelay() {
    if (pinKeyRelayTimer) {
        clearTimeout(pinKeyRelayTimer);
        pinKeyRelayTimer = null;
    }
    window.removeEventListener('keydown', handlePinKeyRelay, true);
    window.removeEventListener('pointerdown', stopPinKeyRelay, true);
}

function isPinRelayKey(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    return /^[a-zA-Z0-9]$/.test(event.key) || event.key === 'Backspace';
}

function handlePinKeyRelay(event: KeyboardEvent) {
    if (!isPinRelayKey(event)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    chrome.runtime.sendMessage({ type: PIN_KEY_RELAY_MESSAGE, key: event.key }).catch((err) => {
        console.warn('[SealX] Failed to relay PIN key:', err?.message);
    });
}

function armPinKeyRelay() {
    stopPinKeyRelay();
    window.addEventListener('keydown', handlePinKeyRelay, true);
    pinKeyRelayTimer = setTimeout(stopPinKeyRelay, PIN_KEY_RELAY_TIMEOUT_MS);

    setTimeout(() => {
        window.addEventListener('pointerdown', stopPinKeyRelay, true);
    }, 0);
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
    document.removeEventListener('click', openSidePanel); // 先移除旧监听，避免重复绑定
    // ===== 手势中继：事件委托监听 SealX 操作组件 =====
    // 用户在 HTML 元素上定义 sealx 属性（如 <button sealx>），
    // SDK 自动将其转换为 data-sealx-action="open"。
    // Content script 通过事件委托，只在点击带该属性的元素时，
    // 在 transient activation 窗口内发送 open-side-panel 消息。
    console.log('[SealX] Setting up click listener for SealX actions');
    document.addEventListener('click', openSidePanel);
    if (document.getElementById('sealXContainer')) {
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
}

// 等待body加载完成后初始化
waitForBody(initializeSealX);

//sealx-component 组件库的样式可能在页面加载后才被注入，因此我们需要监听 DOM 变化，确保在样式加载后再初始化 SealX。
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach((node) => {
      if (
        node instanceof HTMLElement &&
        node.hasAttribute &&
        (node as Element).hasAttribute('sealx-component')
      ) {
        console.log('[SealX] Detected style injection, initializing SealX');
        node.removeEventListener('click', openSidePanel); // 先移除旧监听，避免重复绑定
        node.addEventListener('click', openSidePanel);
      }
    });
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });

// ========== Key relay activation from background ==========
// When side panel opens (especially in fullscreen mode), background sends this message
// to arm the PIN key relay so keyboard events on the web page are forwarded to the panel.
chrome.runtime.onMessage.addListener((message: Record<string, unknown>) => {
    if (message?.type === 'arm-pin-key-relay') {
        armPinKeyRelay();
    }
    if (message?.type === 'stop-pin-key-relay') {
        stopPinKeyRelay();
    }
});

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type === 'sealx-element-updated') {
    console.log('[SealX] Received element update message:', event.data);
    // 这里可以根据需要处理元素更新后的逻辑，例如重新绑定事件等
    const updatedElement = document.querySelector(
      `[data-sealx-id="${event.data['data-sealx-id']}"]`,
    ) as HTMLElement | null;
    if (updatedElement && updatedElement.hasAttribute('data-sealx-action')) {
      console.log('[SealX] Updated element found:', updatedElement);
      // 例如，重新绑定事件
      updatedElement.removeEventListener('click', openSidePanel);
      updatedElement.addEventListener('click', openSidePanel);
    }
  }
});
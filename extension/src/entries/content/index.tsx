import { createRoot } from 'react-dom/client';
import './style.css'
import { SealX } from './SealX';
function injectScript(file: string) {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL(file); // 如：inpage.js
    script.type = "text/javascript";
    script.async = false;
    (document.head || document.documentElement).appendChild(script);
    script.remove(); // 清理 DOM
}

const div = document.createElement('div');
div.id = 'sealXContainer';
document.body.appendChild(div);
const rootContainer = document.querySelector('#sealXContainer');
if (!rootContainer) throw new Error("Can't find Content root element");
const root = createRoot(rootContainer);

root.render(<SealX />);
injectScript('inpage.js')


import 'ethers';
import 'lodash';
import 'crypto-js';

const wait = async (delay) => {
    return new Promise((resolve) => {
        setTimeout(() => resolve(Date.now()), delay);
    });
};
function isViewportFullscreenBySize() {
    return window.innerWidth === screen.availWidth;
}
function isNativeFullscreen() {
    // Type assertion to handle vendor-prefixed properties
    const doc = document;
    return !!(doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement);
}

export { isNativeFullscreen, isViewportFullscreenBySize, wait };
//# sourceMappingURL=index.mjs.map

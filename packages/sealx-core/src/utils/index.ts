export * from './eip712-helper'
export * from './cropto'

export const wait = async (delay: number) => {
    return new Promise((resolve) => {
        setTimeout(() => resolve(Date.now()), delay)
    })
}

export function isViewportFullscreenBySize() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const screenWidth = screen.width || screen.availWidth;
    const screenHeight = screen.height || screen.availHeight;

    return (
        Math.abs(viewportWidth - screenWidth) <= 1 &&
        Math.abs(viewportHeight - screenHeight) <= 1
    );
}

export function isNativeFullscreen() {
    // Type assertion to handle vendor-prefixed properties
    const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
        mozFullScreenElement?: Element | null;
        msFullscreenElement?: Element | null;
    };

    return !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
    );
}

export * from './eip712-helper'
export * from './cropto'

export const wait = async (delay: number) => {
    return new Promise((resolve) => {
        setTimeout(() => resolve(Date.now()), delay)
    })
}

export function isViewportFullscreenBySize() {
    return window.innerWidth === screen.availWidth && window.innerHeight === screen.availHeight;
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

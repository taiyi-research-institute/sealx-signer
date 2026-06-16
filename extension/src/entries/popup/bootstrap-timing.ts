type PanelTimingWindow = Window & {
    __sealxPanelTiming?: {
        htmlBootstrapAt: number;
        timeOrigin: number;
    };
};

const htmlBootstrapAt = Date.now();
const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

(window as PanelTimingWindow).__sealxPanelTiming = {
    htmlBootstrapAt,
    timeOrigin: performance.timeOrigin,
};

console.warn('[TRACE-PANEL-TIMING:HTML] bootstrap script executed', {
    htmlBootstrapAt,
    timeOrigin: performance.timeOrigin,
    domInteractive: navigationEntry?.domInteractive,
    domContentLoaded: navigationEntry?.domContentLoadedEventEnd,
});

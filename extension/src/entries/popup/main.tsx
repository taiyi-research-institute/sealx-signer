import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '../../global.css'
import '../../assets/main.css'
import App from './App.tsx'

const mainStartedAt = Date.now()
type PanelTimingWindow = Window & {
    __sealxPanelTiming?: {
        htmlBootstrapAt: number;
        timeOrigin: number;
    };
}
const htmlBootstrapAt = (window as PanelTimingWindow).__sealxPanelTiming?.htmlBootstrapAt
const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined

chrome.storage.session.get(['panelOpenRequestedAt', 'panelOpenSucceededAt']).then((timing) => {
    const panelOpenRequestedAt = typeof timing.panelOpenRequestedAt === 'number' ? timing.panelOpenRequestedAt : 0
    const panelOpenSucceededAt = typeof timing.panelOpenSucceededAt === 'number' ? timing.panelOpenSucceededAt : 0

    console.warn('[TRACE-PANEL-TIMING:POPUP] main module start', {
        mainStartedAt,
        sinceOpenRequested: panelOpenRequestedAt ? mainStartedAt - panelOpenRequestedAt : null,
        sinceOpenSucceeded: panelOpenSucceededAt ? mainStartedAt - panelOpenSucceededAt : null,
        sinceHtmlBootstrap: htmlBootstrapAt ? mainStartedAt - htmlBootstrapAt : null,
        htmlBootstrapAt,
        timeOrigin: performance.timeOrigin,
        domInteractive: navigationEntry?.domInteractive,
        domContentLoaded: navigationEntry?.domContentLoadedEventEnd,
    })
})

const root = createRoot(document.getElementById('root')!)
console.warn('[TRACE-PANEL-TIMING:POPUP] before React render', {
    elapsedSinceMainStart: Date.now() - mainStartedAt,
})

root.render(
    <StrictMode>
        <App />
    </StrictMode>,
)

setTimeout(() => {
    console.warn('[TRACE-PANEL-TIMING:POPUP] after React render tick', {
        elapsedSinceMainStart: Date.now() - mainStartedAt,
    })
}, 0)

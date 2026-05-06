// If using TypeScript, add this for Chrome types:
/// <reference types="chrome"/>

import { sessionStore } from "@src/core/state"
import { getSealxInfo } from "./state"
import { MessageChannel, SealxTopic } from "sealx-message"
import type { Messager } from "sealx-message"
import { TabManager } from "sealx-core"

// import { env } from "process"


export default class PopupManager {
    static popup: string = 'src/entries/popup/index.html'
    static openWindows: Map<number, chrome.windows.Window> = new Map()
    static openTabs: Map<number, chrome.tabs.Tab> = new Map()
    static callerTabId: number | null = null
    static actionPopupOpened: boolean = false
    static messager: Messager | null = null

    private static async findPopupWindow(): Promise<chrome.windows.Window | undefined> {
        const windows = await chrome.windows.getAll()
        return windows.find(w =>
            w.type === 'popup' &&
            w.id &&
            this.openWindows.has(w.id)
        )
    }

    private static setupWindowListeners(windowId: number) {
        chrome.windows.onRemoved.addListener((removedWindowId) => {
            if (removedWindowId === windowId) {
                this.openWindows.delete(windowId)
            }
        })
    }
    static setMessager(messager: Messager) {
        PopupManager.messager = messager

        chrome.alarms.onAlarm.addListener(async (alarms) => {
            if (alarms.name !== 'checkSealx') {
                return
            }
            const tab = TabManager.getInstance().currentTab
            if (tab?.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
                const sealx = await getSealxInfo()
                if (PopupManager.messager) {
                    PopupManager.messager.send(sealx?.address ?? '', SealxTopic.CHECK_INITIALIZED, MessageChannel.INPAGE)
                }
            }

        })
    }

    static setPopupWindow() {
        chrome.action.onClicked.addListener(async () => {
            await PopupManager.closeWindow()
            PopupManager.popupWindow(1) // Use normal window creation instead of action popup
        });

        // background.js (service worker)

        chrome.runtime.onStartup.addListener(() => {
            chrome.alarms.create('checkSealx', { periodInMinutes: 0.1 })
        })

        chrome.runtime.onInstalled.addListener(async () => {
            sessionStore.getState().clearAllSession()
            PopupManager.popupWindow(3, 'login')
            chrome.alarms.create('checkSealx', { periodInMinutes: 0.1 })
        })
    }

    private static async findPopupTab(): Promise<chrome.tabs.Tab | undefined> {
        const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL(PopupManager.popup) })
        return tabs.find(tab => tab.id && this.openTabs.has(tab.id))
    }

    private static async isCurrentWindowFullscreen(): Promise<boolean> {
        try {
            const currentWindow = await chrome.windows.getCurrent()
            console.log(currentWindow.state)
            return currentWindow?.state === 'fullscreen'
        } catch (error) {
            console.warn('Could not determine window state:', error)
            return false
        }
    }

    private static async useActionPopup(): Promise<boolean> {
        try {
            // Check if we're in a context where chrome.action.openPopup is available
            // and if the current window is in fullscreen mode
            const isFullscreen = await this.isCurrentWindowFullscreen()
            const manifest = chrome.runtime.getManifest()
            const hasDefaultPopup = !!manifest.action?.default_popup

            return isFullscreen && typeof chrome.action?.openPopup === 'function' && hasDefaultPopup
        } catch (error) {
            console.warn('Could not use action popup:', error)
            return false
        }
    }

    static async popupWindow(showWindow: number = 0, route: string = '') {
        // showWindow = 2
        // showWindow = import.meta.env.NODE_ENV === 'development' ? false : showWindow
        try {
            // Get current active tab before opening popup
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
            if (tabs.length > 0 && tabs[0].id) {
                this.callerTabId = tabs[0].id
            }

            // Check if we should use chrome.action.openPopup (for fullscreen mode)
            const shouldUseActionPopup = showWindow === 2
            if (shouldUseActionPopup) {
                try {
                    // Check if we have a valid tab to use for windowId
                    if (!tabs.length || !tabs[0]?.windowId) {
                        console.warn('No active tab found or tab has no windowId, using normal window creation')
                        // Fall through to normal window creation
                        await chrome.action.openPopup({
                            // windowId: tabs[0].windowId
                        })
                    } else {
                        // Check if the extension has a popup configured in the manifest
                        // If not, fall back to normal window creation immediately
                        const manifest = chrome.runtime.getManifest()
                        if (!manifest.action?.default_popup) {
                            console.warn('Extension does not have a default popup configured in manifest, using normal window creation')
                            // Fall through to normal window creation
                        } else {
                            // Popup dimensions are controlled via CSS in main.css
                            // using html[extension-context="popup"] selector
                            await chrome.action.openPopup({
                                windowId: tabs[0].windowId
                            })
                            this.actionPopupOpened = true
                            console.log('Used chrome.action.openPopup for fullscreen mode')
                            return null // action.openPopup doesn't return a window/tab object
                        }
                    }
                } catch (error) {
                    console.warn('chrome.action.openPopup failed, falling back to normal method:', error)
                    // Continue with normal window creation
                    return
                }
            }

            if (showWindow === 1) {
                const existingWindow = await this.findPopupWindow()
                if (existingWindow) {
                    if (!existingWindow.focused)
                        await chrome.windows.update(existingWindow.id!, { focused: true })
                    return existingWindow
                }
            } else {
                const existingTab = await this.findPopupTab()
                if (existingTab) {
                    if (!existingTab.active)
                        await chrome.tabs.update(existingTab.id!, { active: true })
                    return existingTab
                }
            }

            const currentWindow = await chrome.windows.getCurrent()
            if (!currentWindow?.width) {
                throw new Error('Could not get current window dimensions')
            }

            if (showWindow === 1) {
                const newWindow = await chrome.windows.create({
                    url: PopupManager.popup + '#/' + route,
                    type: 'popup',
                    width: 600,
                    height: 856,
                    top: 100,
                    left: currentWindow.width - 700,
                    state: 'normal',
                })
                // console.log(newWindow.state + '============')
                // if (newWindow.width !== 600 || newWindow.height !== 856) {
                //     await chrome.windows.update(newWindow.id!, {
                //         state: 'normal', width: 600,
                //         height: 856,
                //     })
                // }

                if (newWindow.id) {
                    this.openWindows.set(newWindow.id, newWindow)
                    this.setupWindowListeners(newWindow.id)
                }
                return newWindow
            } else {
                const newTab = await chrome.tabs.create({
                    url: PopupManager.popup + '#/' + route
                })
                if (newTab.id) {
                    this.openTabs.set(newTab.id, newTab)
                }
                return newTab
            }
        } catch (error) {
            console.error('Popup window error:', error)
            throw error
        }
    }

    private static async closePopupAlternative(): Promise<void> {
        try {
            // Alternative approach: try to find and close popup by querying tabs directly
            const popupTabs = await chrome.tabs.query({
                url: chrome.runtime.getURL(PopupManager.popup)
            })

            console.log('Found popup tabs via alternative approach:', popupTabs.length)

            for (const tab of popupTabs) {
                if (tab.id && tab.windowId) {
                    // Try to close the window containing this tab
                    try {
                        await chrome.windows.remove(tab.windowId)
                        console.log('Closed popup window via alternative approach:', tab.windowId)
                    } catch (windowError) {
                        console.warn('Failed to close window, trying to close tab directly:', windowError)
                        // If window removal fails, try to close the tab directly
                        await chrome.tabs.remove(tab.id)
                        console.log('Closed popup tab directly:', tab.id)
                    }
                }
            }
        } catch (error) {
            console.warn('Alternative popup closing approach failed:', error)
        }
    }

    static async closeWindow() {
        // Switch back to the caller tab if it exists
        if (this.callerTabId) {
            try {
                await chrome.tabs.update(this.callerTabId, { active: true })
                console.log('Switched back to caller tab:', this.callerTabId)
            } catch (error) {
                console.warn('Failed to switch back to caller tab:', error)
            }
            this.callerTabId = null
        }

        // Close popup windows opened by chrome.windows.create
        const existingWindow = await this.findPopupWindow()
        if (existingWindow && existingWindow.id) {
            this.openWindows.delete(existingWindow.id)
            chrome.windows.remove(existingWindow.id)
            return true
        }

        // Close popup opened by chrome.action.openPopup
        // chrome.action.closePopup() does NOT exist in MV3
        // The popup opened by chrome.action.openPopup() is a special UI element,
        // not a regular tab, so chrome.tabs.query() cannot find it.
        // Use chrome.runtime.sendMessage() to broadcast to all extension contexts.
        if (this.actionPopupOpened) {
            try {
                this.actionPopupOpened = false
                // Broadcast close-popup message to all extension contexts
                // The popup's App.tsx listens for this and calls window.close()
                chrome.runtime.sendMessage({ type: 'close-popup' })
                return true
            } catch (error) {
                console.warn('Failed to close action popup:', error)
                this.actionPopupOpened = false
            }
        }

        // Close tabs opened by chrome.tabs.create
        const existingTab = await this.findPopupTab()
        if (existingTab && existingTab.id) {
            chrome.tabs.remove(existingTab.id)
            this.openTabs.delete(existingTab.id)
            return true
        }
        return false
    }
}

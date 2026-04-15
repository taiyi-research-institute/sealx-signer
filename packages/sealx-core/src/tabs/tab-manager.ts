// import browser from 'webextension-polyfill';

const STORAGE_KEY = 'sealx_tab_manager';

export interface ITabManager {
    tabs: chrome.tabs.Tab[];
    currentTab: chrome.tabs.Tab;
    currentTabId?: number;
}

interface StoredTabState {
    currentTabId?: number;
    currentTab?: chrome.tabs.Tab;
    tabs?: chrome.tabs.Tab[];
    timestamp: number;
}

export class TabManager implements ITabManager {
    tabs: chrome.tabs.Tab[] = [];
    currentTab!: chrome.tabs.Tab;

    static instance: TabManager;

    id: number = 0;

    private constructor() {
        this.id = Math.floor(Math.random() * 1000000);
        this.initFromStorage();
        this.setupListeners();
    }

    /**
     * Initialize from chrome.storage to ensure consistency across contexts
     */
    private async initFromStorage(): Promise<void> {
        if (!chrome?.storage?.local) return;

        try {
            const result = await chrome.storage.local.get(STORAGE_KEY);
            const stored = result[STORAGE_KEY] as StoredTabState | undefined;

            if (stored && stored.timestamp) {
                // Use stored data if it's recent (within 30 seconds)
                const age = Date.now() - stored.timestamp;
                if (age < 30000 && stored.currentTab) {
                    this.currentTab = stored.currentTab;
                    this.tabs = stored.tabs || [];
                    console.log('TabManager: initialized from storage, tabId:', this.currentTab.id);
                    return;
                }
            }
        } catch (e) {
            console.warn('TabManager: failed to read from storage', e);
        }

        // Fallback to querying tabs directly
        this.queryTabs();
    }

    /**
     * Query tabs from Chrome API
     */
    private async queryTabs(): Promise<void> {
        if (!chrome?.tabs) return;

        try {
            const tabs = await chrome.tabs.query({});
            if (tabs.length > 0 && tabs[0].id !== undefined) {
                const tab = await chrome.tabs.get(tabs[0].id);
                this.tabs.push(tab);
                if (tab.active && tab.url?.startsWith('chrome-extension://')) {
                    this.currentTab = tab;
                }
            }
        } catch (e) {
            console.error('TabManager: failed to query tabs', e);
        }
    }

    /**
     * Setup Chrome tab event listeners
     */
    private setupListeners(): void {
        if (!chrome?.tabs) return;

        chrome.tabs.onActivated.addListener(async (tabInfo: chrome.tabs.TabActiveInfo) => {
            try {
                const tab = await chrome.tabs.get(tabInfo.tabId);
                if (this.tabs.findIndex(t => t.id === tab.id) === -1) {
                    this.tabs.push(tab);
                }
                if (tab.active && tab.url?.startsWith('chrome-extension://')) {
                    this.currentTab = tab;
                    this.persistToStorage();
                    console.log('TabManager: current tab updated to', tab.id, tab.url);
                }
            } catch (error) {
                console.error('TabManager: failed to get tab', tabInfo.tabId, error);
            }
        });

        chrome.tabs.onDetached.addListener(() => { });
        chrome.tabs.onCreated.addListener(() => { });
        chrome.tabs.onRemoved.addListener(() => { });
    }

    /**
     * Persist current state to chrome.storage for cross-context synchronization
     */
    private async persistToStorage(): Promise<void> {
        if (!chrome?.storage?.local) return;

        try {
            const state: StoredTabState = {
                currentTabId: this.currentTabId,
                currentTab: this.currentTab,
                tabs: this.tabs,
                timestamp: Date.now()
            };
            await chrome.storage.local.set({ [STORAGE_KEY]: state });
        } catch (e) {
            console.warn('TabManager: failed to persist to storage', e);
        }
    }

    static getInstance() {
        if (!TabManager.instance) {
            TabManager.instance = new TabManager();
        }
        if (!TabManager.instance.currentTabId) TabManager.instance.initFromStorage()
        return TabManager.instance;
    }

    get currentTabId() {
        return this.currentTab?.id;
    }

    async updateActiveTab(tabId?: number) {
        if (tabId) {
            const tabs = await chrome.tabs.query({
                active: true,
            })
            const tab = tabs.find(t => t.id === tabId);
            if (tab) {
                this.currentTab = tab;
                this.persistToStorage();
                return;
            }
        } else {
            const tabs = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            })
            if (tabs[0]) {
                const url = tabs[0].url || '';
                // Skip update if the active tab is an extension popup/options page
                if (url.startsWith('chrome-extension://')) {
                    return;
                }
                this.currentTab = tabs[0]
                this.persistToStorage();
            }
        }
    }
}

export interface ITabManager {
    tabs: chrome.tabs.Tab[];
    currentTab: chrome.tabs.Tab;
    currentTabId?: number;
}
export declare class TabManager implements ITabManager {
    tabs: chrome.tabs.Tab[];
    currentTab: chrome.tabs.Tab;
    static instance: TabManager;
    id: number;
    private constructor();
    /**
     * Initialize from chrome.storage to ensure consistency across contexts
     */
    private initFromStorage;
    /**
     * Query tabs from Chrome API
     */
    private queryTabs;
    /**
     * Setup Chrome tab event listeners
     */
    private setupListeners;
    /**
     * Persist current state to chrome.storage for cross-context synchronization
     */
    private persistToStorage;
    static getInstance(): TabManager;
    get currentTabId(): number | undefined;
    updateActiveTab(tabId?: number): Promise<void>;
}
//# sourceMappingURL=tab-manager.d.ts.map
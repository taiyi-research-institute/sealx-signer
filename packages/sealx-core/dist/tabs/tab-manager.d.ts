export interface ITabManager {
    tabs: chrome.tabs.Tab[];
    currentTab: chrome.tabs.Tab;
    currentTabId?: number;
}
export declare class TabManager implements ITabManager {
    tabs: chrome.tabs.Tab[];
    currentTab: chrome.tabs.Tab;
    static instance: TabManager;
    private constructor();
    static getInstance(): TabManager;
    get currentTabId(): number | undefined;
    updateActiveTab(): Promise<void>;
}

// import browser from 'webextension-polyfill';
export interface ITabManager {
    tabs: chrome.tabs.Tab[];
    currentTab: chrome.tabs.Tab;
    currentTabId?: number;
}

export class TabManager implements ITabManager {
    tabs: chrome.tabs.Tab[] = [];
    currentTab!: chrome.tabs.Tab;

    static instance: TabManager;

    private constructor() {
        if (chrome && chrome.tabs) {
            chrome.tabs.query({}).then((tabs) => {
                if (tabs.length > 0 && tabs[0].id !== undefined) {
                    chrome.tabs.get(tabs[0].id).then((tab) => {
                        this.tabs.push(tab);
                        if (tab.active) {
                            this.currentTab = tab;
                        }
                    });
                }
            });

            chrome.tabs.onActivated.addListener(
                (tabInfo: chrome.tabs.TabActiveInfo) => {
                    chrome.tabs.get(tabInfo.tabId).then((tab) => {
                        if (this.tabs.findIndex(t => t.id === tab.id) === -1) this.tabs.push(tab);
                        if (tab.active) {
                            this.currentTab = tab;
                            console.log('TabManager: current tab updated to', tab.id, tab.url);
                        }
                    }).catch((error) => {
                        console.error('TabManager: failed to get tab', tabInfo.tabId, error);
                    });
                }
            );
            // 分离
            chrome.tabs.onDetached.addListener(() => { });

            chrome.tabs.onCreated.addListener(() => { });

            chrome.tabs.onRemoved.addListener(() => { });
        }
    }

    static getInstance() {
        if (!TabManager.instance) {
            TabManager.instance = new TabManager();
        }
        return TabManager.instance;
    }

    get currentTabId() {
        return this.currentTab?.id;
    }

    async updateActiveTab() {
        const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true
        })
        if (tabs[0]) {
            this.currentTab = tabs[0]
        }
    }
}

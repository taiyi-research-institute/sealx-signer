'use strict';

var ethers = require('ethers');
var lodash = require('lodash');
var CryptoJS = require('crypto-js');

// import browser from 'webextension-polyfill';
const STORAGE_KEY = 'sealx_tab_manager';
class TabManager {
    tabs = [];
    currentTab;
    static instance;
    id = 0;
    constructor() {
        this.id = Math.floor(Math.random() * 1000000);
        this.initFromStorage();
        this.setupListeners();
    }
    /**
     * Initialize from chrome.storage to ensure consistency across contexts
     */
    async initFromStorage() {
        if (!chrome?.storage?.local)
            return;
        try {
            const result = await chrome.storage.local.get(STORAGE_KEY);
            const stored = result[STORAGE_KEY];
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
        }
        catch (e) {
            console.warn('TabManager: failed to read from storage', e);
        }
        // Fallback to querying tabs directly
        this.queryTabs();
    }
    /**
     * Query tabs from Chrome API
     */
    async queryTabs() {
        if (!chrome?.tabs)
            return;
        try {
            const tabs = await chrome.tabs.query({});
            if (tabs.length > 0 && tabs[0].id !== undefined) {
                const tab = await chrome.tabs.get(tabs[0].id);
                this.tabs.push(tab);
                if (tab.active && tab.url?.startsWith('chrome-extension://')) {
                    this.currentTab = tab;
                }
            }
        }
        catch (e) {
            console.error('TabManager: failed to query tabs', e);
        }
    }
    /**
     * Setup Chrome tab event listeners
     */
    setupListeners() {
        if (!chrome?.tabs)
            return;
        chrome.tabs.onActivated.addListener(async (tabInfo) => {
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
            }
            catch (error) {
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
    async persistToStorage() {
        if (!chrome?.storage?.local)
            return;
        try {
            const state = {
                currentTabId: this.currentTabId,
                currentTab: this.currentTab,
                tabs: this.tabs,
                timestamp: Date.now()
            };
            await chrome.storage.local.set({ [STORAGE_KEY]: state });
        }
        catch (e) {
            console.warn('TabManager: failed to persist to storage', e);
        }
    }
    static getInstance() {
        if (!TabManager.instance) {
            TabManager.instance = new TabManager();
        }
        if (!TabManager.instance.currentTabId)
            TabManager.instance.initFromStorage();
        return TabManager.instance;
    }
    get currentTabId() {
        return this.currentTab?.id;
    }
    async updateActiveTab(tabId) {
        if (tabId) {
            const tabs = await chrome.tabs.query({
                active: true,
            });
            const tab = tabs.find(t => t.id === tabId);
            if (tab) {
                this.currentTab = tab;
                this.persistToStorage();
                return;
            }
        }
        else {
            const tabs = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            });
            if (tabs[0]) {
                const url = tabs[0].url || '';
                // Skip update if the active tab is an extension popup/options page
                if (url.startsWith('chrome-extension://')) {
                    return;
                }
                this.currentTab = tabs[0];
                this.persistToStorage();
            }
        }
    }
}

class IndexedDBWrapper {
    dbName;
    storeName;
    dbPromise;
    // private static version: number = 0
    listeners = new Map();
    constructor(dbName = 'app-db', storeName = 'keyval') {
        this.dbName = dbName;
        this.storeName = storeName;
        // IndexedDBWrapper.version++
        this.dbPromise = this.openDB().then(db => {
            db.addEventListener('versionchange', () => {
                this.notifyListeners();
            });
            return db;
        });
    }
    async notifyListeners() {
        for (const [key, callbacks] of this.listeners) {
            const oldValue = await this.getItem(key);
            const newValue = await this.getItem(key); // Get fresh value
            if (oldValue !== newValue) {
                callbacks.forEach(cb => cb(newValue, oldValue));
            }
        }
    }
    listen(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key)?.add(callback);
        return () => {
            this.listeners.get(key)?.delete(callback);
            if (this.listeners.get(key)?.size === 0) {
                this.listeners.delete(key);
            }
        };
    }
    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName);
            request.onupgradeneeded = () => {
                const db = request.result;
                const contains = db.objectStoreNames.contains(this.storeName);
                console.log(`-------------db open ${this.dbName} contains ${this.storeName} ${contains ? 'true' : 'false'}--------------`);
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
                console.log(`-------------db create  ${this.storeName} ${db.objectStoreNames.contains(this.storeName) ? 'true' : 'false'}--------------`);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    async withStore(mode, callback) {
        const db = await this.dbPromise;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, mode);
            const store = tx.objectStore(this.storeName);
            callback(store)
                .then(resolve)
                .catch(reject);
            tx.oncomplete = () => { };
            tx.onerror = () => reject(tx.error);
        });
    }
    async getItem(key) {
        return this.withStore('readonly', store => {
            return new Promise((resolve, reject) => {
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result ?? null);
                req.onerror = () => reject(req.error);
            });
        });
    }
    async setItem(key, value) {
        return this.withStore('readwrite', store => {
            return new Promise((resolve, reject) => {
                const req = store.put(value, key);
                req.onsuccess = () => resolve(value);
                req.onerror = () => reject(req.error);
            });
        });
    }
    async removeItem(key) {
        return this.withStore('readwrite', store => {
            return new Promise((resolve, reject) => {
                const req = store.delete(key);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        });
    }
    async clear() {
        return this.withStore('readwrite', store => {
            return new Promise((resolve, reject) => {
                const req = store.clear();
                req.onsuccess = (req) => {
                    // Notify all listeners that their values have been cleared
                    this.listeners.forEach((callbacks, key) => {
                        callbacks.forEach(cb => cb(null, null));
                    });
                    console.log('--------- clear ------', req);
                    resolve();
                };
                req.onerror = () => reject(req.error);
            });
        });
    }
    async close() {
        const db = await this.dbPromise;
        db.close();
    }
}

/// <reference types="chrome" />
class LocalStorageWrapper {
    db;
    table;
    isChromeExtension;
    constructor(db = '', table = '') {
        this.db = db;
        this.table = table;
        this.isChromeExtension = typeof chrome !== 'undefined' &&
            typeof chrome.storage !== 'undefined' &&
            typeof chrome.storage.local !== 'undefined';
    }
    listen(key, callback) {
        key = this.getNamespacedKey(key);
        const listener = (changes) => {
            if (!changes[key] || changes[key]?.newValue === changes[key]?.oldValue)
                return;
            const newValue = changes[key]?.newValue;
            const oldValue = changes[key]?.oldValue;
            callback(newValue, oldValue);
        };
        chrome.storage?.local?.onChanged?.addListener(listener);
        return () => chrome.storage?.local?.onChanged?.removeListener(listener);
    }
    get namespace() {
        if (this.db) {
            if (this.table) {
                return `${this.db}:${this.table}`;
            }
            return `${this.db}`;
        }
        return '';
    }
    getNamespacedKey(key) {
        return this.namespace ? `${this.namespace}:${key}` : key;
    }
    async getItem(key) {
        const namespacedKey = this.getNamespacedKey(key);
        if (this.isChromeExtension) {
            return new Promise((resolve) => {
                chrome.storage.local.get([namespacedKey], (result) => {
                    resolve(chrome.runtime.lastError ? null : (result[namespacedKey] ?? null));
                });
            });
        }
        const value = localStorage.getItem(namespacedKey);
        return value ? JSON.parse(value) : null;
    }
    async setItem(key, value) {
        const namespacedKey = this.getNamespacedKey(key);
        if (this.isChromeExtension) {
            return new Promise((resolve) => {
                chrome.storage.local.set({ [namespacedKey]: value }, () => resolve(value));
            });
        }
        localStorage.setItem(namespacedKey, JSON.stringify(value));
        return value;
    }
    async removeItem(key) {
        const namespacedKey = this.getNamespacedKey(key);
        if (this.isChromeExtension) {
            return new Promise((resolve) => {
                chrome.storage.local.remove([namespacedKey], () => resolve());
            });
        }
        localStorage.removeItem(namespacedKey);
    }
    async clear() {
        if (this.isChromeExtension) {
            if (!this.namespace) {
                return new Promise((resolve) => {
                    chrome.storage.local.clear(() => resolve());
                });
            }
            return new Promise((resolve) => {
                chrome.storage.local.get(null, (items) => {
                    const keysToRemove = Object.keys(items)
                        .filter(key => key.startsWith(`${this.namespace}:`));
                    chrome.storage.local.remove(keysToRemove, () => resolve());
                });
            });
        }
        if (!this.namespace) {
            localStorage.clear();
            return;
        }
        // Remove only items with current namespace
        Object.keys(localStorage)
            .filter(key => key.startsWith(`${this.namespace}:`))
            .forEach(key => localStorage.removeItem(key));
    }
}

const localStorageWrapper = (db, table) => {
    return new LocalStorageWrapper(db, table);
};
const dbStorageWrapper = (db, table) => {
    return new IndexedDBWrapper(db, table);
};

/**
 * The SealxSigner class provides functionality for managing the Sealx plugin state,
 * including installation, connection management, and signing operations.
 *
 * Key Features:
 * - Tracks plugin installation state
 * - Manages plugin open/close state via DOM attributes
 * - Handles session connections for signing operations
 * - Provides cryptographic signing capabilities
 */
class SealxSigner {
    id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    /** Whether the plugin has been installed */
    installed = false;
    /** Whether the plugin UI is currently active */
    active = false;
    /** Whether a session is currently connected */
    connected = false;
    /** Current active session, if connected */
    session = null;
    /** Current account information, if available */
    account = null;
    autoConnectCallback = null;
    autoClearTimer = null;
    /** Storage wrapper for persisting plugin state */
    storageWrapper = localStorageWrapper('sealx', 'state');
    constructor() {
        /**
         * Initializes a new SealxSigner instance.
         * Automatically calls initialize() to set up the plugin state.
         */
        console.log("SealxSigner initialized");
        this.initialize();
    }
    async initializeAccount(account) {
        /**
         * Initializes the account information.
         * @param userId - Unique identifier for the user
         * @param userName - Name of the user
         * @param email - Email address of the user
         */
        this.account = account;
        await this.storageWrapper.setItem('account', account);
        console.log("SealxSigner account initialized:", this.account);
    }
    async initializeSession(session) {
        this.session = session;
        await this.storageWrapper.setItem('session', session);
        this.setAutoClearTimer();
    }
    setAutoClearTimer() {
        if (this.autoClearTimer) {
            clearTimeout(this.autoClearTimer);
            this.autoClearTimer = null;
        }
        if (this.session) {
            const timeUntilExpire = this.session.expire - Date.now();
            // Only set timer if session is not already expired
            if (timeUntilExpire > 0) {
                this.autoClearTimer = setTimeout(() => {
                    if (this.autoConnectCallback)
                        this.autoConnectCallback();
                    this.session = null;
                    // this.storageWrapper.removeItem('account')
                    this.storageWrapper.removeItem('session');
                    this.autoClearTimer = null;
                }, timeUntilExpire);
            }
        }
    }
    /**
     * Synchronizes the plugin's active state with the DOM attribute.
     * Called by the MutationObserver when the data-sealx-signer-active attribute changes.
     */
    activeStateInitialize() {
        const isActive = document.body.getAttribute('data-sealx-signer-active') === 'true';
        if (isActive && !this.active) {
            this.active = true;
            console.log("SealxSigner plugin activated via mutation observer");
        }
        else if (!isActive && this.active) {
            this.active = false;
            console.log("SealxSigner plugin closed via mutation observer");
        }
    }
    /**
     * Initializes the plugin state:
     * - Loads installation status from storage
     * - Sets up MutationObserver to track plugin active state changes
     * - Initializes current active state
     */
    async initialize() {
        // Load installation status from persistent storage
        this.installed = await this.storageWrapper.getItem('installed') || false;
        this.account = await this.storageWrapper.getItem('account');
        this.session = await this.storageWrapper.getItem('session');
        this.setAutoClearTimer();
        // Set up observer for DOM attribute changes
        const observe = new MutationObserver(() => {
            // this.activeStateInitialize();
        });
        observe.observe(document.body, {
            attributes: true,
            attributeFilter: ['data-sealx-signer-active']
        });
        // Initialize current state
        // this.activeStateInitialize();
    }
    /**
     * Marks the plugin as installed and persists this state.
     * Can only be called once - subsequent calls will warn.
     */
    install() {
        if (this.installed)
            return;
        this.installed = true;
        this.storageWrapper.setItem('installed', true);
        console.log("SealxSigner installed");
    }
    /**
     * Activates the plugin UI by setting the DOM attribute.
     * Updates internal state and logs the operation.
     */
    activate() {
        if (!this.active) {
            this.active = true;
            document.body.setAttribute('data-sealx-signer-active', 'true');
            console.log("SealxSigner plugin activated");
        }
    }
    /**
     * Deactivates the plugin UI by clearing the DOM attribute.
     * Updates internal state and logs the operation.
     */
    deactivate() {
        const wasActive = this.active;
        this.active = false;
        this.session = null;
        this.storageWrapper.removeItem('session');
        if (document.body.getAttribute('data-sealx-signer-active') !== 'false') {
            document.body.setAttribute('data-sealx-signer-active', 'false');
        }
        if (wasActive) {
            console.log("SealxSigner plugin deactivated");
        }
    }
    autoCheckTimer;
    async autoCheck(checker) {
        if (this.autoCheckTimer) {
            clearInterval(this.autoCheckTimer);
        }
        this.autoCheckTimer = setInterval(async () => {
            const res = await checker(this);
            if (res) {
                this.active = true;
                if (!this.session?.userId) {
                    this.session = null;
                    this.storageWrapper.removeItem('session');
                }
            }
            else {
                this.active = false;
                this.session = null;
                this.storageWrapper.removeItem('session');
            }
        }, 30000);
    }
}

class SealxProvider {
    static register() {
        if (!window.sealxSigner) {
            window.sealxSigner = new SealxSigner();
        }
        return window.sealxSigner;
    }
}

/**
 * Escapes special regex characters in a string
 * @param string - The string to escape
 * @returns The escaped string ready for regex use
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Converts various time formats to human-readable format with current computer's timezone
 * @param timeValue - The time value to convert (can be timestamp, Date object, or ISO string)
 * @returns {string} Human-readable formatted time string with current timezone information
 * @example
 * // Returns "2025-10-17 18:01:15 UTC+8" (current timezone: UTC+8)
 * convertToISOFormat(1729152075000)
 * // Returns "2025-10-17 18:01:15 UTC+8" (current timezone: UTC+8)
 * convertToISOFormat("2025-10-17T10:01:15.000Z")
 * // Returns "2025-10-17 18:01:15 UTC+8" (current timezone: UTC+8)
 * convertToISOFormat(new Date("2025-10-17T10:01:15.000Z"))
 */
function convertToISOFormat(timeValue) {
    if (!timeValue) {
        return '';
    }
    try {
        let date;
        // Handle numeric timestamps (seconds or milliseconds)
        if (typeof timeValue === 'number') {
            // Check if it's seconds (typical Unix timestamp) or milliseconds
            date = timeValue > 1e12 ? new Date(timeValue) : new Date(timeValue * 1000);
        }
        // Handle Date objects
        else if (timeValue instanceof Date) {
            date = timeValue;
        }
        // Handle string values
        else if (typeof timeValue === 'string') {
            // If it's already an ISO string with timezone, use it directly
            const isoWithTimezoneRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
            if (isoWithTimezoneRegex.test(timeValue)) {
                date = new Date(timeValue);
            }
            // Try to parse as timestamp string
            else {
                const timestamp = Number(timeValue);
                if (!isNaN(timestamp)) {
                    date = timestamp > 1e12 ? new Date(timestamp) : new Date(timestamp * 1000);
                }
                else {
                    // Attempt to parse as a human-readable date string
                    // Example: "2025-10-25 10:01:48 UTC+8.5" cannot be directly parsed into a Date object
                    const parts = timeValue.split(' ');
                    if (parts.length === 3 && parts[2].startsWith('UTC')) {
                        const timezoneOffsetMatch = parts[2].match(/UTC([+-]\d+(\.\d+)?)/);
                        if (timezoneOffsetMatch) {
                            const offset = parseFloat(timezoneOffsetMatch[1]);
                            const offsetMilliseconds = offset * 60 * 60 * 1000;
                            const baseDate = new Date(parts[0] + 'T' + parts[1] + 'Z');
                            if (!isNaN(baseDate.getTime())) {
                                date = new Date(baseDate.getTime() - offsetMilliseconds);
                            }
                            else {
                                date = new Date(timeValue);
                            }
                        }
                        else {
                            date = new Date(timeValue);
                        }
                    }
                    else {
                        date = new Date(timeValue);
                    }
                    // Try to parse as date string
                    // date = new Date(timeValue)
                }
            }
        }
        // Handle other types
        else {
            date = new Date(timeValue);
        }
        // Check if the date is valid
        if (isNaN(date.getTime())) {
            return String(timeValue);
        }
        // Format the date with current computer's timezone
        const timezoneOffset = date.getTimezoneOffset();
        const offsetHours = Math.abs(Math.floor(timezoneOffset / 60));
        const offsetMinutes = Math.abs(timezoneOffset % 60);
        const offsetSign = timezoneOffset <= 0 ? '+' : '-';
        // Format timezone as UTC+X or UTC+X.5 for half-hour offsets
        let timezoneString;
        if (offsetMinutes === 0) {
            timezoneString = `UTC${offsetSign}${offsetHours}`;
        }
        else {
            timezoneString = `UTC${offsetSign}${offsetHours}.5`;
        }
        // Get local date components
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${timezoneString}`;
    }
    catch (error) {
        // If conversion fails, return the original value as string
        return String(timeValue);
    }
}
/**
 * Parses EIP-712 signing content into a renderable format by:
 * 1. Validating the template using a cryptographic salt check
 * 2. Building a rendering context from the message data
 * 3. Applying the template to the context if valid
 *
 * @param signContent - Complete EIP-712 structured data including:
 *   - layout: Contains template and key mappings
 *   - message: The actual data to be signed
 *   - domain: Contains validation salt
 *   - validUntilTime: Timestamp for template validation
 * @returns {SignLayoutRender} Object containing:
 *   - signData: Original EIP-712 data structure
 *   - render: Rendered template string (empty if validation failed)
 *   - context: Processed context data (null if validation failed)
 * @throws {Error} If template validation fails
 */
const parseSignContent = (signContent) => {
    const contentLayout = signContent.layout;
    const signData = signContent;
    const template = contentLayout.template;
    const keyMap = JSON.parse(contentLayout.keysMapStr);
    const message = signContent.message;
    const keysHash = CryptoJS.MD5(contentLayout.keysMapStr).toString();
    // Validate template integrity using cryptographic salt check
    const validTemplate = signContent.domain.salt === ethers.ethers.id(CryptoJS.MD5(template + keysHash + signContent.validUntilTime).toString());
    // Check template contains all required key references
    const templateCompleteness = checkTemplateArgValid(keyMap, template);
    // Build rendering context from message data
    const context = buildSignRenderContext(keyMap, message);
    // Only render if all validations pass (template integrity, completeness, and context exists)
    const render = context && templateCompleteness && validTemplate
        ? layoutRender(template, context)
        : '';
    return {
        signData,
        render,
        context
    };
};
/**
 * Validates that a template contains all required references for a given key mapping structure.
 * Recursively checks nested key mappings to ensure template completeness.
 *
 * @param keyMap - Key mapping structure to validate against template
 * @param template - Template string to validate
 * @param parentKey - Parent key path for nested validations (used internally)
 * @returns {boolean} True if template contains all required key references, false otherwise
 * @example
 * // Returns true if template contains 'user.name.label' and 'user.name.value'
 * checkTemplateArgValid(
 *   { '用户列表': { originKey: 'users', children:[{
 *      "用户名":{
 *          originKey:'name'
 *       }
 *      }] } },
 *   'Hello <%= users[i].name.value %>!'
 * )
 */
const checkTemplateArgValid = (keyMap, template, parentKey = '') => {
    const keys = Object.keys(keyMap);
    for (const key of keys) {
        const originKey = keyMap[key].originKey;
        // Check for label/value paths, handling both direct and array references
        const labelPath = `${parentKey}${originKey}.label`;
        const valuePath = `${parentKey}${originKey}.value`;
        // Create regex patterns that match both direct and array references
        const labelPattern = new RegExp(escapeRegExp(labelPath));
        const valuePattern = new RegExp(escapeRegExp(valuePath));
        if (!labelPattern.test(template) || !valuePattern.test(template)) {
            return false;
        }
        // Handle nested child mappings if they exist
        if (keyMap[key].children) {
            let child = null;
            let newParentKey = parentKey;
            // For array children, use any variable name in brackets (e.g. [index], [i], [idx])
            if (Array.isArray(keyMap[key].children)) {
                child = keyMap[key].children[0];
                // Match any valid JavaScript variable name inside brackets
                newParentKey = `${parentKey}${originKey}.value[\\w\\d_]+].`;
            }
            // For object children, use dot notation
            else {
                child = keyMap[key].children;
                newParentKey = `${parentKey}${originKey}.value.`;
            }
            // Recursively validate child mappings
            const isValidChild = checkTemplateArgValid(child, template, newParentKey);
            if (!isValidChild) {
                return false;
            }
        }
    }
    return true;
};
/**
 * Builds a hierarchical rendering context from key mappings and message data.
 * Handles both single objects and arrays recursively.
 *
 * @param keyMap - Mapping configuration that defines:
 *   - originKey: Source field in message
 *   - children: Nested mappings (optional)
 * Can be single mapping or array of mappings
 * @param message - Source data to process. Can be:
 *   - Single object with key-value pairs
 *   - Array of objects
 * @returns {SignLayoutContext} Structured context with:
 *   - label: Display label from keyMap
 *   - value: Processed value (recursively handled if object/array)
 * @example
 * // Returns { name: { label: 'Full Name', value: 'John Doe' } }
 * buildSignRenderContext(
 *   { name: { originKey: 'userName' } },
 *   { userName: 'John Doe' }
 * )
 */
const buildSignRenderContext = (keyMap, message) => {
    try {
        const context = {};
        Object.keys(keyMap).forEach((key) => {
            const originKey = keyMap[key].originKey;
            const originType = keyMap[key].originType;
            let value = message[key];
            if (originType === 'struct') {
                value = buildSignRenderContext(keyMap[key].children, value);
            }
            else if (originType === 'array') {
                const keys = Object.keys(value);
                const result = [];
                for (let i = 0; i < keys.length; i++) {
                    const v = value[keys[i]];
                    if (v === Object(v)) {
                        result.push(buildSignRenderContext(keyMap[key].children[keys[i]], v));
                    }
                    else {
                        result.push({
                            label: i + 1,
                            value: v
                        });
                    }
                }
                value = result;
            }
            else if (originType === 'time' || originKey === 'valid_until_time') {
                // Convert time values to ISO format
                value = convertToISOFormat(value);
            }
            context[originKey] = {
                label: key,
                value: value,
                originKey: originKey
            };
        });
        return context;
    }
    catch (e) {
        console.error(e, keyMap);
        throw e;
    }
};
/**
 * Synchronously renders a template string using lodash template syntax
 *
 * @param template - Template string with lodash interpolation tags:
 *   - <%= value %> for HTML-escaped output
 *   - <%- value %> for raw output
 * @param context - Data object containing values referenced in template
 * @returns {string} Rendered output
 * @example
 * // Returns "Hello, John!"
 * layoutRender("Hello, <%= user.value.name.value %>!", { user: { value:{ name: {value: "Json"} } } })
 */
const layoutRender = (template, context) => {
    const render = lodash.template(template);
    return render(context);
};

class PinError extends Error {
}

class DataCorruptedError extends Error {
}

const pinGenerator = () => {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};
const slatGenerator = () => {
    const array = new Uint8Array(16); // 16 字节的随机值
    crypto.getRandomValues(array);
    return Array.from(array).map(byte => byte.toString(16).padStart(2, '0')).join('');
};
const deriveKeyFromPin = async (pin, slat) => {
    const encoder = new TextEncoder();
    // pin码加密
    const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(pin), { name: "PBKDF2" }, false, ["deriveKey"]);
    return await crypto.subtle.deriveKey({
        name: "PBKDF2",
        salt: encoder.encode(slat), // 固定盐值
        iterations: 100000,
        hash: "SHA-256"
    }, keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
};
// pin码加密私钥
const encryptPrivateKey = async (privateKey, pin, slat) => {
    const key = await deriveKeyFromPin(pin, slat);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 生成随机 IV
    const encoder = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(privateKey));
    // 将 Uint8Array 转换为 Base64 字符串
    const base64Encode = (array) => btoa(String.fromCharCode(...array));
    // 返回包含 iv 和 encrypted 的对象（作为 Base64 字符串）
    const data = {
        iv: base64Encode(iv), // 将 IV 转换为 Base64
        encrypted: base64Encode(new Uint8Array(encrypted)) // 将加密后的数据转换为 Base64
    };
    return data;
};
// pin码解密私钥
const decryptPrivateKey = async (pin, encodePrivateKey, iv, slat) => {
    // Pre-decryption format validation: distinguish data corruption from wrong PIN
    let encrypted;
    let ivBytes;
    try {
        // Validate base64 format of ciphertext
        encrypted = new Uint8Array(atob(encodePrivateKey).split('').map(c => c.charCodeAt(0)));
    }
    catch {
        throw new DataCorruptedError('Invalid base64 encoding in encrypted data');
    }
    try {
        // Validate base64 format of IV
        ivBytes = new Uint8Array(atob(iv).split('').map(c => c.charCodeAt(0)));
    }
    catch {
        throw new DataCorruptedError('Invalid base64 encoding in IV');
    }
    // Validate IV length (AES-GCM requires 12 bytes)
    if (ivBytes.length !== 12) {
        throw new DataCorruptedError(`Invalid IV length: expected 12 bytes, got ${ivBytes.length}`);
    }
    try {
        const key = await deriveKeyFromPin(pin, slat);
        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBytes }, key, encrypted);
        return new TextDecoder().decode(decrypted);
    }
    catch (e) {
        throw new PinError(e);
    }
};

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

exports.DataCorruptedError = DataCorruptedError;
exports.PinError = PinError;
exports.SealxProvider = SealxProvider;
exports.SealxSigner = SealxSigner;
exports.TabManager = TabManager;
exports.buildSignRenderContext = buildSignRenderContext;
exports.checkTemplateArgValid = checkTemplateArgValid;
exports.convertToISOFormat = convertToISOFormat;
exports.dbStorageWrapper = dbStorageWrapper;
exports.decryptPrivateKey = decryptPrivateKey;
exports.deriveKeyFromPin = deriveKeyFromPin;
exports.encryptPrivateKey = encryptPrivateKey;
exports.isNativeFullscreen = isNativeFullscreen;
exports.isViewportFullscreenBySize = isViewportFullscreenBySize;
exports.layoutRender = layoutRender;
exports.localStorageWrapper = localStorageWrapper;
exports.parseSignContent = parseSignContent;
exports.pinGenerator = pinGenerator;
exports.slatGenerator = slatGenerator;
exports.wait = wait;
//# sourceMappingURL=index.cjs.map

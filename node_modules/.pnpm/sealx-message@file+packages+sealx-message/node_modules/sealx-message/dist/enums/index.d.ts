/**
 * Actions that can be requested from the SealX service
 */
export declare enum SealxTopic {
    /** Request to connect to a wallet/account */
    CONNECT = "connect",
    /** Check if the plugin is activated */
    CHECK_ACTIVED = "check-actived",
    /** Connection established */
    CONNECTED = "connected",
    /** Request to disconnect from current wallet/account */
    DISCONNECT = "disconnect",
    /** Request to sign a single message/transaction */
    SIGN = "sign",
    SIGN_RESPONSE = "sign-response",
    /** Request to sign multiple messages/transactions in batch */
    BATCH_SIGN = "batch-sign",
    /** Request to delete/revoke a signature */
    DEL_SIGN = "del-sign",
    /** Request to get the current tab ID */
    GET_TAB_ID = "get-tab-id",
    /** Request to get the current extension ID */
    GET_EXTENSION_ID = "get-extension-id",
    /** Request to get the current account information */
    GET_ACCOUNT = "get-account",
    /** Check initialized */
    CHECK_INITIALIZED = "check-initialized",
    /** Check if the current session has expired */
    CHECK_SESSION_EXPIRED = "check-session-expired",
    /** Verify the provided PIN code */
    CHECK_PIN = "check-pin",
    /** Initialize the SealX service */
    INITIALIZE = "initialize",
    GET_SCREEN_OFF_TIMER = "get-screen-off-timer",
    SET_SCREEN_OFF_TIMER = "set-screen-off-timer",
    RESET_PIN = "reset-pin",
    LOGIN = "login",
    CHECK_ACTIVE = "check-active",
    BIND_PK = "bind-pk",
    IMPORT_KEY = "import-key",
    /** All topics */
    ALL = "*"
}
/**
 * Communication channels used in the SealX extension
 */
export declare enum MessageChannel {
    /** Background script communication */
    BACKGROUND = "background",
    /** Popup window communication */
    POPUP = "popup",
    /** Options page communication */
    OPTIONS = "options",
    /** Sidebar panel communication */
    SIDEBAR = "sidebar",
    /** Extension-level communication */
    EXTENSION = "extension",
    /** Content script communication */
    CONTENT = "content",
    /** In-page script communication */
    INPAGE = "inpage",
    /** Iframe communication */
    IFRAME = "iframe",
    /** All channels */
    ALL = "*"
}

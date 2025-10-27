/**
 * Actions that can be requested from the SealX service
 */
export var SealxTopic;
(function (SealxTopic) {
    /** Request to connect to a wallet/account */
    SealxTopic["CONNECT"] = "connect";
    /** Check if the plugin is activated */
    SealxTopic["CHECK_ACTIVED"] = "check-actived";
    /** Connection established */
    SealxTopic["CONNECTED"] = "connected";
    /** Request to disconnect from current wallet/account */
    SealxTopic["DISCONNECT"] = "disconnect";
    /** Request to sign a single message/transaction */
    SealxTopic["SIGN"] = "sign";
    SealxTopic["REMOTE_SIGN"] = "remote-sign";
    SealxTopic["SIGN_RESPONSE"] = "sign-response";
    /** Request to sign multiple messages/transactions in batch */
    SealxTopic["BATCH_SIGN"] = "batch-sign";
    /** Request to delete/revoke a signature */
    SealxTopic["DEL_SIGN"] = "del-sign";
    /** Request to get the current tab ID */
    SealxTopic["GET_TAB_ID"] = "get-tab-id";
    /** Request to get the current extension ID */
    SealxTopic["GET_EXTENSION_ID"] = "get-extension-id";
    /** Request to get the current account information */
    SealxTopic["GET_ACCOUNT"] = "get-account";
    /** Check initialized */
    SealxTopic["CHECK_INITIALIZED"] = "check-initialized";
    /** Check if the current session has expired */
    SealxTopic["CHECK_SESSION_EXPIRED"] = "check-session-expired";
    /** Verify the provided PIN code */
    SealxTopic["CHECK_PIN"] = "check-pin";
    /** Initialize the SealX service */
    SealxTopic["INITIALIZE"] = "initialize";
    SealxTopic["GET_SCREEN_OFF_TIMER"] = "get-screen-off-timer";
    SealxTopic["SET_SCREEN_OFF_TIMER"] = "set-screen-off-timer";
    SealxTopic["RESET_PIN"] = "reset-pin";
    SealxTopic["LOGIN"] = "login";
    SealxTopic["CHECK_ACTIVE"] = "check-active";
    SealxTopic["BIND_PK"] = "bind-pk";
    SealxTopic["IMPORT_KEY"] = "import-key";
    SealxTopic["CLOSE"] = "close";
    /** All topics */
    SealxTopic["ALL"] = "*";
})(SealxTopic || (SealxTopic = {}));
/**
 * Communication channels used in the SealX extension
 */
export var MessageChannel;
(function (MessageChannel) {
    /** Background script communication */
    MessageChannel["BACKGROUND"] = "background";
    /** Popup window communication */
    MessageChannel["POPUP"] = "popup";
    /** Options page communication */
    MessageChannel["OPTIONS"] = "options";
    /** Sidebar panel communication */
    MessageChannel["SIDEBAR"] = "sidebar";
    /** Extension-level communication */
    MessageChannel["EXTENSION"] = "extension";
    /** Content script communication */
    MessageChannel["CONTENT"] = "content";
    /** In-page script communication */
    MessageChannel["INPAGE"] = "inpage";
    /** Iframe communication */
    MessageChannel["IFRAME"] = "iframe";
    /** All channels */
    MessageChannel["ALL"] = "*";
})(MessageChannel || (MessageChannel = {}));
//# sourceMappingURL=index.js.map
/**
 * Message Channel — lightweight abstraction over chrome.runtime.Port
 * for persistent, bidirectional message-passing between extension contexts.
 *
 * Use case: side panel ↔ background, popup ↔ background, etc.
 * The port auto-disconnects when the sender's page closes → reliable lifecycle detection.
 *
 * Client (panel/popup):
 *   const channel = ChannelManager.connect('sealx-panel');
 *   channel.send('ping', { ts: Date.now() });
 *   channel.on('pong', (data) => { ... });
 *
 * Server (background):
 *   ChannelManager.accept('sealx-panel', (channel) => {
 *     channel.on('ping', (data) => channel.send('pong', { echo: data }));
 *     channel.onDisconnect(() => console.log('Panel closed'));
 *   });
 */
type MessageHandler = (payload: unknown) => void;
type DisconnectHandler = () => void;
/**
 * A bidirectional message channel backed by a chrome.runtime.Port.
 * Created by ChannelManager.connect() or received via ChannelManager.accept().
 */
export declare class Channel {
    readonly name: string;
    private port;
    private handlers;
    private disconnectHandlers;
    constructor(name: string, port: chrome.runtime.Port);
    /** Send a message on this channel */
    send(topic: string, payload: unknown): void;
    /** Register a handler for a specific topic. Returns cleanup function. */
    on(topic: string, handler: MessageHandler): () => void;
    /** Register a disconnect handler. Returns cleanup function. */
    onDisconnect(handler: DisconnectHandler): () => void;
    /** Manually close the channel */
    disconnect(): void;
}
/**
 * Manages Channel lifecycle — connect (client) and accept (server).
 */
export declare class ChannelManager {
    private static accepted;
    /**
     * Client side: create a persistent connection to the background.
     * Call from popup/side panel page.
     *
     * @param name - Unique channel name (e.g., 'sealx-panel')
     * @returns Channel instance
     */
    static connect(name: string): Channel;
    /**
     * Server side: accept incoming channel connections.
     * Call from background script during init.
     *
     * @param name - Channel name to accept
     * @param handler - Called for each new connection
     */
    static accept(name: string, handler: (channel: Channel) => void): void;
}
export {};

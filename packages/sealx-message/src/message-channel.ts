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

interface PortMessage {
    topic: string;
    payload: unknown;
}

/**
 * A bidirectional message channel backed by a chrome.runtime.Port.
 * Created by ChannelManager.connect() or received via ChannelManager.accept().
 */
export class Channel {
    readonly name: string;
    private port: chrome.runtime.Port;
    private handlers = new Map<string, Set<MessageHandler>>();
    private disconnectHandlers = new Set<DisconnectHandler>();

    constructor(name: string, port: chrome.runtime.Port) {
        this.name = name;
        this.port = port;
        this.port.onMessage.addListener((msg: PortMessage) => {
            if (!msg || typeof msg.topic !== 'string') return;
            const topicHandlers = this.handlers.get(msg.topic);
            if (topicHandlers) {
                topicHandlers.forEach(h => { try { h(msg.payload); } catch (err) { console.warn(`[Channel:${name}] handler error for ${msg.topic}:`, err); } });
            }
        });
        this.port.onDisconnect.addListener(() => {
            this.disconnectHandlers.forEach(h => { try { h(); } catch (err) { console.warn(`[Channel:${name}] disconnect handler error:`, err); } });
        });
    }

    /** Send a message on this channel */
    send(topic: string, payload: unknown): void {
        this.port.postMessage({ topic, payload });
    }

    /** Register a handler for a specific topic. Returns cleanup function. */
    on(topic: string, handler: MessageHandler): () => void {
        if (!this.handlers.has(topic)) {
            this.handlers.set(topic, new Set());
        }
        this.handlers.get(topic)!.add(handler);
        return () => this.handlers.get(topic)?.delete(handler);
    }

    /** Register a disconnect handler. Returns cleanup function. */
    onDisconnect(handler: DisconnectHandler): () => void {
        this.disconnectHandlers.add(handler);
        return () => this.disconnectHandlers.delete(handler);
    }

    /** Manually close the channel */
    disconnect(): void {
        this.port.disconnect();
    }
}

/**
 * Manages Channel lifecycle — connect (client) and accept (server).
 */
export class ChannelManager {
    private static accepted = new Map<string, boolean>();

    /**
     * Client side: create a persistent connection to the background.
     * Call from popup/side panel page.
     *
     * @param name - Unique channel name (e.g., 'sealx-panel')
     * @returns Channel instance
     */
    static connect(name: string): Channel {
        const port = chrome.runtime.connect({ name });
        return new Channel(name, port);
    }

    /**
     * Server side: accept incoming channel connections.
     * Call from background script during init.
     *
     * @param name - Channel name to accept
     * @param handler - Called for each new connection
     */
    static accept(name: string, handler: (channel: Channel) => void): void {
        if (this.accepted.has(name)) return; // Prevent duplicate listeners
        this.accepted.set(name, true);

        chrome.runtime.onConnect.addListener((port) => {
            if (port.name !== name) return;
            handler(new Channel(name, port));
        });
    }
}

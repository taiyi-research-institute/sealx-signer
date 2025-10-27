import { Observable } from 'rxjs';
/**
 * Represents an active user session with Sealx
 * @property pk - The public key associated with the session
 * @property sessionId - Unique identifier for the session
 * @property expiresAt - Timestamp (in milliseconds) when the session will expire
 */
export interface Session {
    pk: string;
    sessionId: string;
    expiresAt: number;
}
declare class SessionState {
    private sessionSubject;
    private expireTimer;
    private readonly STORAGE_KEY;
    constructor();
    private getStoredSession;
    private storeSession;
    /**
     * Gets an observable of the current session state
     * @returns Observable that emits the current session or null when no session exists
     */
    get session$(): Observable<Session | null>;
    /**
     * Gets the current session value synchronously
     * @returns Current session object or null if no active session
     */
    get currentSession(): Session | null;
    /**
     * Updates the current session and manages session expiration
     * @param session - New session object or null to clear session
     * Clears any existing expiration timer and sets a new one if session has future expiry
     */
    setSession(session: Session | null): void;
    /**
     * Clears the current session and any active expiration timer
     */
    clearSession(): void;
}
export declare const sessionState: SessionState;
export {};

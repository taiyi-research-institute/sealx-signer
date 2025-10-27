import { BehaviorSubject, Observable } from 'rxjs';
import { of } from 'rxjs';

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

class SessionState {
    private sessionSubject = new BehaviorSubject<Session | null>(null);
    private expireTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly STORAGE_KEY = 'sealx_session';

    constructor() {
        // Load session from localStorage on initialization
        of(null).subscribe(() => {
            const session = this.getStoredSession();
            if (session) {
                this.setSession(session);
            }
        });
    }

    private getStoredSession(): Session | null {
        try {
            const sessionStr = localStorage.getItem(this.STORAGE_KEY);
            if (sessionStr) {
                return JSON.parse(sessionStr);
            }
        } catch (e) {
            console.error('Failed to parse session from localStorage', e);
        }
        return null;
    }

    private storeSession(session: Session | null) {
        if (session) {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
        } else {
            localStorage.removeItem(this.STORAGE_KEY);
        }
    }
    /**
     * Gets an observable of the current session state
     * @returns Observable that emits the current session or null when no session exists
     */
    get session$(): Observable<Session | null> {
        return this.sessionSubject.asObservable();
    }

    /**
     * Gets the current session value synchronously
     * @returns Current session object or null if no active session
     */
    get currentSession(): Session | null {
        return this.sessionSubject.value;
    }

    /**
     * Updates the current session and manages session expiration
     * @param session - New session object or null to clear session
     * Clears any existing expiration timer and sets a new one if session has future expiry
     */
    setSession(session: Session | null) {
        if (this.expireTimer) {
            clearTimeout(this.expireTimer);
            this.expireTimer = null;
        }
        if (session && session.expiresAt > Date.now()) {
            const timeout = session.expiresAt - Date.now();
            this.expireTimer = setTimeout(() => {
                this.clearSession();
            }, timeout);
        }
        this.storeSession(session);
        this.sessionSubject.next(session);
    }

    /**
     * Clears the current session and any active expiration timer
     */
    clearSession() {
        if (this.expireTimer) {
            clearTimeout(this.expireTimer);
            this.expireTimer = null;
        }
        this.storeSession(null);
        this.sessionSubject.next(null);
    }
}

export const sessionState = new SessionState();

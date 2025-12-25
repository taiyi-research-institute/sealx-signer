import { sessionKey } from '@src/core/utils/helper';
import { type SealxSession } from 'sealx-core';
import { createStore } from '../internal/createStore';
import { withSelectors } from '../internal/withSelectors';

// export const sessionStore = () => {
//     return localStorageWrapper('sealx', 'session')
// }

// export const getSession = async (host: string = '', userId: string = '') => {
//     const key = sessionKey(host, userId)
//     return await sessionStore().getItem(key) as SealxSession
// }

// export const logout = async (host: string = '', userId: string = '') => {
//     const key = sessionKey(host, userId)
//     return await sessionStore().removeItem(key)
// }

export interface SessionState {
    host: string,
    userId: string
    sessionMap: Record<string, SealxSession>
    setHost: (host: string) => void
    setUserId: (userId: string) => void
    setSession: (session: SealxSession | null) => void
    session: SealxSession | null
    logout: () => void
    isSessionConsistent: () => boolean
    clearAllSession: () => void
}

export const sessionStore = createStore<SessionState>((set, get) => ({
    host: '',
    userId: '',
    sessionMap: {},
    session: null,
    setHost: (host: string) => {
        const state = get()
        const userId = state.userId  // Preserve current userId instead of resetting to ''
        const key = sessionKey(host, userId)
        const session = state.sessionMap[key]
        set({ host, session })
    },
    setUserId: (userId: string) => {
        const state = get()
        const host = state.host
        const key = sessionKey(host, userId)
        const session = state.sessionMap[key]
        set({ userId, session })
    },
    setSession: (session: SealxSession | null) => {
        const state = get()

        if (session) {
            // When setting a valid session, always use the session's host and userId
            // to ensure consistency between the session data and the state
            const host = session.host ?? state.host
            const userId = session.userId ?? state.userId
            const key = sessionKey(host, userId)

            // Update sessionMap
            state.sessionMap[key] = session

            // Update state with session's host/userId to maintain consistency
            set({ host, userId, session })
        } else {
            // When clearing session, use current state's host/userId
            const host = state.host
            const userId = state.userId
            const key = sessionKey(host, userId)

            // Remove from sessionMap
            delete state.sessionMap[key]

            // Clear session but keep host/userId
            set({ session: null })
        }
    },
    logout: () => {
        const state = get()
        const host = state.host ?? ''
        const userId = state.userId ?? ''
        const key = sessionKey(host, userId)
        delete state.sessionMap[key]
        set({ ...state, session: null })
    },
    isSessionConsistent: () => {
        const state = get()
        // If no session, it's consistent (nothing to validate)
        if (!state.session) return true

        // Check if session's host and userId match the current state
        const sessionMatchesState =
            state.session.host === state.host &&
            state.session.userId === state.userId

        return sessionMatchesState
    },
    clearAllSession: () => {
        // Clear all sessions from sessionMap and reset current session
        set({ sessionMap: {}, session: null })
    }
}), {
    persist: {
        name: 'sesçsion',
        onRehydrateStorage: () => (state) => {
            // This callback runs after the store is rehydrated from storage
            console.log('Session store rehydrated:', state)
        }
    }
})

export const useSessionStore = withSelectors(sessionStore)

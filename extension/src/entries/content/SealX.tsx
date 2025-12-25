import { useCallback, useEffect, useState } from 'react';
import type { SealxSession } from 'sealx-core';
import { MessagerManager, SealxTopic, type Messager } from 'sealx-message';
import type { SealxRequest } from 'sealx-message';
import { ContentMessager } from 'sealx-message';
type SessionState = SealxSession
type ReplyMessage = { success: boolean } | { error: string }
const messager: Messager = MessagerManager.getMessager();
(messager as ContentMessager).setMessageBridgeAvailable()
export const SealX = () => {
    const [session, setSession] = useState<SessionState>({ sessionId: '', expire: 0, host: '', address: '' })
    const [version, setVersion] = useState('')
    const onConnected = useCallback(async (request: SealxRequest<SealxSession>, reply?: (message: ReplyMessage) => void) => {
        try {
            const result = request.payload
            if (!result || !result.sessionId) {
                console.warn('SealX connection result is empty or invalid:', result)
                return
            }

            const sessionUpdate = {
                sessionId: result.sessionId,
                expire: result.expire,
                host: request.header.host,
                address: result.address || ''
            }
            setSession(sessionUpdate)
            document.dispatchEvent(new CustomEvent('SealXConnect', { detail: { session: result } }))

            if (reply) {
                reply({ success: true })
            }
        } catch (error) {
            console.error('SealX connection error:', error)
            if (reply) {
                reply({ error: error instanceof Error ? error.message : String(error) })
            }
        }
    }, [setSession])
    useEffect(() => {
        if (!version) {
            setVersion(chrome.runtime.getManifest().version)
        }

        const off = messager.on(SealxTopic.CONNECTED, onConnected)
        return () => {
            off()
        }
    }, [version, setVersion, onConnected])
    return (
        <>
            <span id="sealx-version" data-version={version}></span>
            <div id="sealx-session" data-session={JSON.stringify(session)}></div>
        </>
    )
}

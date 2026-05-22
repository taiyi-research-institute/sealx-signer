import { useCallback, useEffect, useRef, useState } from "react"
// import { useSealXNavigate } from "../../hooks/useSealXNavigate"
import { useGlobalContext } from "@src/hooks/useGlobalContext"
import AddressCardIcon from '@assets/svg/address-card.svg?react'
import { useRequestContext } from "@src/hooks/useRequestContextHook"
import { bindKey, closeWindow } from "@src/core/background"
import { SealxTopic, type ReplyFunc } from "sealx-message"
import messager from "@src/core/messager"
import Button from "@src/components/button"

const BIND_OVERLAY_DISMISS_MS = 800;

const BindOverlay = ({ onClose }: { onClose: () => void }) => (
    <div className='fixed inset-0 bg-[#101820]/82 flex items-center justify-center z-50' role="alert" aria-busy="true" aria-live="polite">
        <div className="flex flex-col items-center rounded-[16px] bg-white px-6 py-5 shadow-[var(--sx-shadow-raised)]">
            <div className="animate-spin rounded-full h-12 w-12 border-[3px] border-[var(--sx-brand)]/30 border-t-[var(--sx-brand)] mb-4"></div>
            <div className="text-[var(--sx-text)] text-[1rem] font-[800]">Binding...</div>
        </div>
    </div>
)

export const BindPubKey = () => {
    const { address } = useGlobalContext()
    const { request } = useRequestContext()
    const reply = useRef<ReplyFunc>(null)
    const [signing, setSigning] = useState(false)
    const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        if (request.topic === SealxTopic.BIND_PK) {
            reply.current = request.reply ?? null
        }
    }, [request])

    useEffect(() => {
        return () => {
            if (dismissTimeoutRef.current) {
                clearTimeout(dismissTimeoutRef.current)
            }
        }
    }, [])

    const onSubmit = useCallback(async () => {
        if (!request.header.userId || !request.header.host) {
            throw new Error('Connection lose')
        }
        setSigning(true)
        try {
            await bindKey(request.header.userId, request.header.host, address)
            reply.current?.(address as never)
            messager.reply(address, request)
        } finally {
            dismissTimeoutRef.current = setTimeout(() => {
                dismissTimeoutRef.current = null
                setSigning(false)
                closeWindow()
            }, BIND_OVERLAY_DISMISS_MS)
        }
    }, [address, request])

    return (
        <div className='key-manage-page'>
            <section className='key-manage-card'>
                <div className='key-pubkey-block'>
                    <div className='key-pubkey-label'>
                        <AddressCardIcon></AddressCardIcon>
                        <span>Pubkey</span>
                    </div>
                    <div className='key-pubkey-value'>
                        {address || 'Not initialized'}
                    </div>
                </div>

                <div className='key-action-grid'>
                    <Button variant='secondary' onClick={() => closeWindow()}>
                        Cancel
                    </Button>
                    <Button variant='primary' onClick={onSubmit} disabled={signing} loading={signing}>
                        {signing ? 'Binding...' : 'Bind Now'}
                    </Button>
                </div>
            </section>

            {signing && <BindOverlay onClose={() => setSigning(false)} />}
        </div>
    );
}

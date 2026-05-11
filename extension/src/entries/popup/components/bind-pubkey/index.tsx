import { useCallback, useEffect, useRef } from "react"
// import { useSealXNavigate } from "../../hooks/useSealXNavigate"
import { useGlobalContext } from "@src/hooks/useGlobalContext"
import AddressCardIcon from '@assets/svg/address-card.svg?react'
import { useRequestContext } from "@src/hooks/useRequestContextHook"
import { bindKey, closeWindow } from "@src/core/background"
import { SealxTopic, type ReplyFunc } from "sealx-message"
import messager from "@src/core/messager"
import Button from "@src/components/button"
export const BindPubKey = () => {
    // const navigate = useSealXNavigate()
    const { address } = useGlobalContext()
    const { request } = useRequestContext()
    const reply = useRef<ReplyFunc>(null)
    useEffect(() => {
        if (request.topic === SealxTopic.BIND_PK) {
            reply.current = request.reply ?? null
        }
    }, [request])

    const onSubmit = useCallback(async () => {
        if (!request.header.userId || !request.header.host) {
            throw new Error('Connection lose')
        }
        await bindKey(request.header.userId, request.header.host, address)
        reply.current?.(address as never)
        messager.reply(address, request)
        closeWindow()
    }, [address, request])
    return <div className=" px-[24px] pt-[24px] w-full h-full flex flex-col">
        <div className="w-full rounded-[20px] bg-surface flex-1">
            <div className="w-full bg-neutral-950 rounded-t-[20px] text-left px-[24px] pt-[22px] pb-[20px] font-[500] text-[26px] leading-[32px] text-surface">
                Bind Signature Key
            </div>
            <div className="w-full px-[24px] pt-[24px]">
                <div className='  w-full rounded-[12px] border border border-black/20 px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-text-secondary'><AddressCardIcon className='mr-[11px]'></AddressCardIcon>Pubkey</div>
                    <div className='w-full mt-[16px] break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px]'>
                        {address}
                    </div>
                </div>
            </div>
        </div>
        <div className='w-full mt-[32px] flex justify-between mb-[32px]'>
            <Button
                variant="secondary"
                onClick={() => closeWindow()}
            >
                Cancel
            </Button>
            <Button
                variant="primary"
                onClick={onSubmit}
            >
                Bind Now
            </Button>
        </div>
    </div>
}

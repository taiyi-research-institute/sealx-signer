import { useCallback, useEffect, useRef } from "react"
// import { useSealXNavigate } from "../../hooks/useSealXNavigate"
import { useGlobalContext } from "@src/hooks/useGlobalContext"
import AddressCardIcon from '@assets/svg/address-card.svg?react'
import { useRequestContext } from "@src/hooks/useRequestContextHook"
import { bindKey, closeWindow } from "@src/core/background"
import { SealxTopic, type ReplyFunc } from "sealx-message"
import messager from "@src/core/messager"
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
        <div className="w-full rounded-[20px] bg-[#fff] flex-1">
            <div className="w-full bg-[#000] rounded-t-[20px] text-left px-[24px] pt-[22px] pb-[20px] font-[500] text-[26px] leading-[32px] text-[#fff]">
                Bind Signature Key
            </div>
            <div className="w-full px-[24px] pt-[24px]">
                <div className='  w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'><AddressCardIcon className='mr-[11px]'></AddressCardIcon>Pubkey</div>
                    <div className='w-full mt-[16px] break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px]'>
                        {address}
                    </div>
                </div>
            </div>
        </div>
        <div className='w-full mt-[32px] flex justify-between mb-[32px]'>
            <div onClick={() => {
                closeWindow()
            }} className=' cursor-pointer rounded-[34px] border-2 border-[rgba(0,0,0,0.06)] font-[500] text-[24px] leading-[28px] pl-[52.77px] pr-[53.23px] pt-[18px] pb-[22px] text-[#000]'>
                Cancel
            </div>
            <div onClick={onSubmit} className=' w-[346px] cursor-pointer rounded-[34px] bg-[#000] text-[#fff] border-2 border-[#000] font-[500] text-[24px] leading-[28px] pl-[57.77px] pr-[58.23px] pt-[18px] pb-[22px]'>
                Bind Now
            </div>
        </div>
    </div>
}

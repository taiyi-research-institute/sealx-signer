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
    return (
      <div className=' px-[1.5rem] pt-[1.5rem] w-full h-full flex flex-col'>
        <div className='w-full rounded-[20px] bg-[#fff] '>
          {/* <div className="w-full bg-[#000] rounded-t-[20px] text-left px-[1.5rem] pt-[1.375rem] pb-[1.25rem] font-[500] text-[1.625rem] leading-[2] text-[#fff]">
                Bind Signature Key
            </div> */}
          <div className='w-full p-[1.5rem]'>
            <div className='  w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
              <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[#000]/60'>
                <AddressCardIcon className='mr-[0.6875rem]'></AddressCardIcon>
                Pubkey
              </div>
              <div className='w-full mt-[1rem] wrap-break-word hyphens-auto text-left font-[500] text-[1.5rem] leading-[1.8125]'>
                {address}
              </div>
            </div>
          </div>
        </div>
        <div className='w-full mt-[2rem] flex justify-between mb-[2rem]'>
          <Button variant='secondary' onClick={() => closeWindow()}>
            Cancel
          </Button>
          <Button variant='primary' onClick={onSubmit}>
            Bind Now
          </Button>
        </div>
      </div>
    );
}

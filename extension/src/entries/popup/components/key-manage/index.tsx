import { useGlobalContext } from "@src/hooks/useGlobalContext"
import { useSealXNavigate } from "../../hooks/useSealXNavigate"
import AddressCardIcon from '@assets/svg/address-card.svg?react'
import Button from "@src/components/button"

export const KeyManage = () => {
    const navigate = useSealXNavigate()
    const { address } = useGlobalContext()
    return <div className=" px-[24px] pt-[24px] w-full h-full flex flex-col ">
        <div className="w-full rounded-[20px] bg-surface flex-1">
            <div className="w-full bg-neutral-950 rounded-t-[20px] text-left px-[24px] pt-[22px] pb-[20px] font-[500] text-[26px] leading-[32px] text-surface">
                Key Mgmt
            </div>
            <div className="w-full px-[24px] pt-[24px]">
                <div className=' w-full rounded-[12px] border border border-black/20 px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-text-secondary'>
                        <AddressCardIcon className='mr-[11px]'></AddressCardIcon>Pubkey
                        <div className=" flex-1 text-right">
                            <Button
                                variant="primary"
                                onClick={() => navigate('/key-export')}
                                className="!pt-[2px] !pb-[6px] !px-[12px] !text-[16px] !leading-[24px] !mr-[12px]"
                            >
                                Export
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => navigate('/key-import')}
                                className="!pt-[2px] !pb-[6px] !px-[12px] !text-[16px] !leading-[24px]"
                            >
                                Import
                            </Button>
                        </div>
                    </div>
                    <div className='w-full mt-[16px] break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px]'>
                        {address}
                    </div>
                </div>
            </div>
        </div>
        <div className='w-full mt-[32px] flex justify-between mb-[32px]'>
            <Button
                variant="secondary"
                onClick={() => navigate(-1)}
            >
                Back
            </Button>
        </div>
    </div>
}

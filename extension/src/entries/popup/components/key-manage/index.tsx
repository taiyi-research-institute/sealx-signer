import { useGlobalContext } from "@src/hooks/useGlobalContext"
import { useSealXNavigate } from "../../hooks/useSealXNavigate"
import AddressCardIcon from '@assets/svg/address-card.svg?react'
import Button from "@src/components/button"

export const KeyManage = () => {
    const navigate = useSealXNavigate()
    const { address } = useGlobalContext()
    return <div className=" px-[1.5rem] pt-[1.5rem] w-full h-full flex flex-col ">
        <div className="w-full rounded-[20px] bg-[#fff] flex-1">
            <div className="w-full bg-[#000] rounded-t-[20px] text-left px-[1.5rem] pt-[1.375rem] pb-[1.25rem] font-[500] text-[1.625rem] leading-[2] text-[#fff]">
                Key Mgmt
            </div>
            <div className="w-full px-[1.5rem] pt-[1.5rem]">
                <div className=' w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[#000]/60'>
                        <AddressCardIcon className='mr-[0.6875rem]'></AddressCardIcon>Pubkey
                        <div className=" flex-1 text-right">
                            <Button
                                variant="primary"
                                onClick={() => navigate('/key-export')}
                                className="pt-[0.125rem]! pb-[0.375rem]! px-[0.75rem]! text-[1rem]! leading-[1.5]! mr-[0.75rem]!"
                            >
                                Export
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => navigate('/key-import')}
                                className="pt-[0.125rem]! pb-[0.375rem]! px-[0.75rem]! text-[1rem]! leading-[1.5]!"
                            >
                                Import
                            </Button>
                        </div>
                    </div>
                    <div className='w-full mt-[1rem] wrap-break-word hyphens-auto text-left font-[500] text-[1.5rem] leading-[1.8125]'>
                        {address}
                    </div>
                </div>
            </div>
        </div>
        <div className='w-full mt-[2rem] flex justify-between mb-[2rem]'>
            <Button
                variant="secondary"
                onClick={() => navigate(-1)}
            >
                Back
            </Button>
        </div>
    </div>
}

import { useGlobalContext } from "@src/hooks/useGlobalContext"
import { useSealXNavigate } from "../../hooks/useSealXNavigate"
import AddressCardIcon from '@assets/svg/address-card.svg?react'

export const KeyManage = () => {
    const navigate = useSealXNavigate()
    const { address } = useGlobalContext()
    return <div className=" px-[24px] pt-[24px] w-full h-full flex flex-col ">
        <div className="w-full rounded-[20px] bg-[#fff] flex-1">
            <div className="w-full bg-[#000] rounded-t-[20px] text-left px-[24px] pt-[22px] pb-[20px] font-[500] text-[26px] leading-[32px] text-[#fff]">
                Key Mgmt
            </div>
            <div className="w-full px-[24px] pt-[24px]">
                <div className=' w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'>
                        <AddressCardIcon className='mr-[11px]'></AddressCardIcon>Pubkey
                        <div className=" flex-1 text-right">
                            <span className="pt-[3px] pb-[4px] px-[6px] border-[0.5px] border-[rgba(0,0,0,0.2)] cursor-pointer rounded-[6px] text-[16px] font-[500] leading-[24px] mr-[12px]" onClick={() => {
                                navigate('/key-export')
                            }}>Export</span>
                            <span className="pt-[3px] pb-[4px] px-[6px] border-[0.5px] border-[rgba(0,0,0,0.2)] cursor-pointer rounded-[6px] text-[16px] font-[500] leading-[24px]" onClick={() => {
                                navigate('/key-import')
                            }}>Import</span>
                        </div>
                    </div>
                    <div className='w-full mt-[16px] break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px]'>
                        {address}
                    </div>
                </div>
            </div>
        </div>
        <div className='w-full mt-[32px] flex justify-between mb-[32px]'>
            <div onClick={() => {
                navigate(-1)
            }} className=' cursor-pointer rounded-[34px] border-2 border-[rgba(0,0,0,0.06)] font-[500] text-[24px] leading-[28px] pl-[52.77px] pr-[53.23px] pt-[18px] pb-[22px] text-[#000]'>
                Back
            </div>
        </div>
    </div>
}
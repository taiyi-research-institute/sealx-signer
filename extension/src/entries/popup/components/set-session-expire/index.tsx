import { getSealxSessionTimeout } from "@src/core/background"
import { useCallback, useEffect, useMemo, useState } from "react"
import SelectedIcon from '@assets/svg/selected.svg?react'
import { setSealxSessionTimeout } from "@src/entries/background/state"
import { useSealXNavigate } from "../../hooks/useSealXNavigate"
import { useSuccessStore } from "@src/core/state"
import Button from "@src/components/button"
// import { setSealxSessionTimeout } from "@src/entries/background/state"

export const SetSessionExpire = () => {
    const [time, setTime] = useState<number>(0)
    const navigate = useSealXNavigate()
    const initTime = useCallback(async () => {
        const res = await getSealxSessionTimeout()
        if (res) {
            setTime(res)
        }
    }, [setTime])
    useEffect(() => {
        initTime()
    }, [initTime])
    const TimerItem = useMemo(() => {
        return [1, 2, 5, 10, 15, 30].map((t, i) => {
            return <div onClick={async () => {
                setTime(t)
            }} className={"w-full cursor-pointer flex items-end" + (i > 0 ? ' pt-[1.9375rem]' : '')}>
                {time === t ? <SelectedIcon className=" w-[24px] h-[24px]"></SelectedIcon> :
                    (<div className="w-[24px] border-[0.5px] border-[rgba(0,0,0,0.4)] h-[24px] rounded-full"></div>)}

                <span className="font-[500] pl-[1.5rem] text-[1.5rem] leading-[1.8125] text-[#000]">{t} min</span>
            </div>
        })
    }, [time])
    const setSuccess = useSuccessStore.use.setSuccess()
    const onSubmit = useCallback(async () => {
        const res = await setSealxSessionTimeout(time)
        if (res) {
            setSuccess('Set screen off timer successful.')
            navigate(-1)
        }
    }, [time, setSuccess, navigate])
    return <div className=" px-[1.5rem] pt-[1.5rem] w-full ">
        <div className="w-full rounded-[20px] bg-[#fff]">
            <div className="w-full bg-[#000] rounded-t-[20px] text-left px-[1.5rem] pt-[1.375rem] pb-[1.25rem] font-[500] text-[1.625rem] leading-[2] text-[#fff]">
                Set Screen off Timer
            </div>
            <div className="w-full px-[1.5rem] pt-[1.5rem]">
                <div className="w-full text-left text-[#000]/60 text-[1.1875rem] font-[500] leading-[1.625]">
                    Choose how long your screen stays on during periods of inactivity before turning off.
                </div>
                <div className=" w-full px-[2.75rem] pt-[2.1875rem] pb-[3.5rem]">
                    {TimerItem}
                </div>
            </div>
        </div>
        <div className='w-full mt-[2rem] flex justify-between gap-x-[1.5rem] mb-[2rem]'>
            <Button
                variant="secondary"
                onClick={() => navigate(-1)}
            >
                Cancel
            </Button>
            <Button
                variant="primary"
                onClick={onSubmit}
                className="w-[346px]"
            >
                Confirm
            </Button>
        </div>
    </div>
}

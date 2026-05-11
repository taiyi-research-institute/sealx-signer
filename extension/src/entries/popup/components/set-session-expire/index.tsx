import { getSealxSessionTimeout, setSessionTimeout } from "@src/core/background"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useSealXNavigate } from "../../hooks/useSealXNavigate"
import { useSuccessStore } from "@src/core/state"
import Button from "@src/components/button"

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
            const isSelected = time === t
            return <label
                key={t}
                className={"w-full cursor-pointer flex items-center py-2" + (i > 0 ? ' pt-[31px]' : '')}
            >
                <input
                    type="radio"
                    name="session-timeout"
                    value={t}
                    checked={isSelected}
                    onChange={() => setTime(t)}
                    className="sr-only"
                />
                <div className={`w-[44px] h-[44px] rounded-full flex items-center justify-center border-2 flex-shrink-0 transition-colors ${isSelected ? 'border-brand bg-brand/[10%]' : 'border border-black/20'}`}>
                    {isSelected && <div className="w-[24px] h-[24px] rounded-full bg-brand" />}
                </div>
                <span className="font-[500] pl-[24px] text-[24px] leading-[29px] text-text-primary">{t} min</span>
            </label>
        })
    }, [time])
    const setSuccess = useSuccessStore.use.setSuccess()
    const onSubmit = useCallback(async () => {
        const res = await setSessionTimeout(time)
        if (res) {
            setSuccess('Set screen off timer successful.')
            navigate(-1)
        }
    }, [time, setSuccess, navigate])
    return <div className=" px-[24px] pt-[24px] w-full ">
        <div className="w-full rounded-[20px] bg-surface">
            <div className="w-full bg-neutral-950 rounded-t-[20px] text-left px-[24px] pt-[22px] pb-[20px] font-[500] text-[26px] leading-[32px] text-surface">
                Set Screen off Timer
            </div>
            <div className="w-full px-[24px] pt-[24px]">
                <div className="w-full text-left text-text-secondary text-[19px] font-[500] leading-[26px]">
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

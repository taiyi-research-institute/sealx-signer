import { useSealXNavigate } from "../../hooks/useSealXNavigate"
import React from "react"

export const PopupMenu = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => {
    const navigate = useSealXNavigate()
    return <div {...props} ref={ref}>
        <div onClick={() => {
            navigate('/reset-pin')
        }} className="pt-[18px] cursor-pointer hover:bg-[#00BE78]/[6%] text-[#000] text-[21px] font-[500] leading-[25px] pb-[17px] text-center">Reset Pin</div>
        <div onClick={() => {
            navigate('/key-manage')
        }} className="pt-[18px] cursor-pointer hover:bg-[#00BE78]/[6%] text-[#000] text-[21px] font-[500] leading-[25px] pb-[17px] text-center">Key Mgmt</div>
        <div onClick={() => {
            navigate('/set-screen-timer')
        }} className="pt-[18px] cursor-pointer hover:bg-[#00BE78]/[6%] text-[#000] text-[21px] font-[500] leading-[25px] pb-[17px] text-center">Set Screen Off Time</div>
        <div className="pt-[18px] cursor-pointer hover:bg=[#00BE78]/[6%] text-[#000] text-[21px] font-[500] leading-[25px] pb-[17px] text-center">Turn Off Screen</div>
    </div>
})

// import { useSealXNavigate } from "../../hooks/useSealXNavigate"
import React from "react"

interface PopupCategoryProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
    onChange?: (value: string) => void;
    category?: string;
}

export const PopupCategory = React.forwardRef<HTMLDivElement, PopupCategoryProps>((props, ref) => {
    // const navigate = useSealXNavigate()
    const { onChange, category, ...otherProps } = props;
    return <div {...otherProps} ref={ref}>
        <div onClick={() => {
            // navigate('/reset-pin')
            onChange?.('')
        }} className={"pt-[1.125rem] cursor-pointer hover:bg-[#00BE78]/6 text-[#000] text-[1.3125rem] font-[500] leading-[1.5625] pb-[1.0625rem] text-center" + (category ? '' : ' bg-[#00BE78]/6')}>Total 1000</div>
        <div onClick={() => {
            // navigate('/key-manage')
            onChange?.('transaction')
        }} className={"pt-[1.125rem] cursor-pointer hover:bg-[#00BE78]/6 text-[#000] text-[1.3125rem] font-[500] leading-[1.5625] pb-[1.0625rem] text-center" + (category === 'transaction' ? ' bg-[#00BE78]/6' : '')}>Transaction</div>
        <div onClick={() => {
            // navigate('/set-screen-timer')
            onChange?.('management')
        }} className={"pt-[1.125rem] cursor-pointer hover:bg-[#00BE78]/6 text-[#000] text-[1.3125rem] font-[500] leading-[1.5625] pb-[1.0625rem] text-center" + (category === 'management' ? ' bg-[#00BE78]/6' : '')}>Management</div>
    </div >
})

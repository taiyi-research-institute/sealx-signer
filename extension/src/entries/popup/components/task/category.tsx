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
        <button onClick={() => {
            onChange?.('')
        }} className={"w-full pt-[18px] cursor-pointer hover:bg-brand/[6%] text-[#000] text-[21px] font-[500] leading-[25px] pb-[17px] text-center bg-transparent border-none" + (category ? '' : ' bg-brand/[6%]')}>Total 1000</button>
        <button onClick={() => {
            onChange?.('transaction')
        }} className={"w-full pt-[18px] cursor-pointer hover:bg-brand/[6%] text-[#000] text-[21px] font-[500] leading-[25px] pb-[17px] text-center bg-transparent border-none" + (category === 'transaction' ? ' bg-brand/[6%]' : '')}>Transaction</button>
        <button onClick={() => {
            onChange?.('management')
        }} className={"w-full pt-[18px] cursor-pointer hover:bg-brand/[6%] text-[#000] text-[21px] font-[500] leading-[25px] pb-[17px] text-center bg-transparent border-none" + (category === 'management' ? ' bg-brand/[6%]' : '')}>Management</button>
    </div >
})

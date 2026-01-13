import { useSealXNavigate } from "../../hooks/useSealXNavigate"
import { usePopupType } from "@src/hooks/usePopupType"
import React, { useCallback } from "react"

interface PopupMenuProps extends React.HTMLAttributes<HTMLDivElement> {
    closeMenu?: () => void;
}

export const PopupMenu = React.forwardRef<HTMLDivElement, PopupMenuProps>(({ closeMenu, ...props }, ref) => {
    const navigate = useSealXNavigate()
    const { isActionPopup, isLoading: isPopupTypeLoading } = usePopupType()

    const handleItemClick = useCallback((callback: () => void) => {
        return () => {
            callback();
            closeMenu?.();
        };
    }, [closeMenu]);

    return <div {...props} ref={ref}>
        <div onClick={handleItemClick(() => {
            navigate('/reset-pin')
        })} className="pt-[18px]  px-[24px] cursor-pointer hover:bg-[#00BE78]/[6%] text-[#000] text-[21px] font-[500] leading-[25px] pb-[17px] text-left">Reset Pin</div>
        <div onClick={handleItemClick(() => {
            // If we're in an action popup (icon弹框模式), open in new tab
            // Otherwise, navigate normally
            if (!isPopupTypeLoading && isActionPopup && chrome?.tabs?.create) {
                console.log('Opening key-manage in new tab (action popup detected)')
                chrome.tabs.create({
                    url: chrome.runtime.getURL('src/entries/popup/index.html#/key-manage') + '#/key-manage'
                })
            } else {
                console.log('Navigating to key-manage normally')
                navigate('/key-manage')
            }
        })} className="pt-[18px]  px-[24px] cursor-pointer hover:bg-[#00BE78]/[6%] text-[#000] text-[21px] font-[500] leading-[25px] pb-[17px] text-left">Key Management</div>
        <div onClick={handleItemClick(() => {
            navigate('/set-screen-timer')
        })} className="pt-[18px]  px-[24px] cursor-pointer hover:bg-[#00BE78]/[6%] text-[#000] text-[21px] font-[500] leading-[25px] pb-[17px] text-left">Set Screen Off Time</div>
        {/* <div className="pt-[18px]  px-[24px] cursor-pointer hover:bg=[#00BE78]/[6%] text-[#000] text-[21px] font-[500] leading-[25px] pb-[17px] text-left">Turn Off Screen</div> */}
    </div>
})

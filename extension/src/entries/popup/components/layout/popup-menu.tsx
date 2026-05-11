import { useSealXNavigate } from "../../hooks/useSealXNavigate"
import { usePopupType } from "@src/hooks/usePopupType"
import React, { useCallback } from "react"

interface PopupMenuProps extends React.HTMLAttributes<HTMLDivElement> {
    closeMenu?: () => void;
}

export const PopupMenu = React.forwardRef<HTMLDivElement, PopupMenuProps>(({ closeMenu, ...props }, ref) => {
    const navigate = useSealXNavigate()
    const { isActionPopup, isSidePanel, isLoading: isPopupTypeLoading } = usePopupType()

    const handleItemClick = useCallback((callback: () => void) => {
        return () => {
            callback();
            closeMenu?.();
        };
    }, [closeMenu]);

    // Side Panel 模式下不需要"在新 tab 打开"
    const shouldOpenInNewTab = !isPopupTypeLoading && isActionPopup && !isSidePanel && chrome?.tabs?.create

    return <div {...props} ref={ref}>
        <button onClick={handleItemClick(() => {
            navigate('/reset-pin')
        })} className="w-full pt-[18px] px-[24px] cursor-pointer hover:bg-brand/[6%] text-[#000] text-[21px] font-[500] leading-[25px] pb-[17px] text-left bg-transparent border-none">Reset Pin</button>
        <button onClick={handleItemClick(() => {
            if (shouldOpenInNewTab) {
                chrome.tabs.create({
                    url: chrome.runtime.getURL('src/entries/popup/index.html#/key-manage') + '#/key-manage'
                })
            } else {
                navigate('/key-manage')
            }
        })} className="w-full pt-[18px] px-[24px] cursor-pointer hover:bg-brand/[6%] text-[#000] text-[21px] font-[500] leading-[25px] pb-[17px] text-left bg-transparent border-none">Key Management</button>
        <button onClick={handleItemClick(() => {
            navigate('/set-screen-timer')
        })} className="w-full pt-[18px] px-[24px] cursor-pointer hover:bg-brand/[6%] text-[#000] text-[21px] font-[500] leading-[25px] pb-[17px] text-left bg-transparent border-none">Set Screen Off Time</button>
    </div>
})

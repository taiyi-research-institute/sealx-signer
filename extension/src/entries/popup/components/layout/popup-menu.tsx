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
        <div onClick={handleItemClick(() => {
            navigate('/reset-pin')
        })} className="pt-[1.125rem]  px-[1.5rem] cursor-pointer hover:bg-[#00BE78]/6 text-[#000] text-[1.3125rem] font-[500] leading-[1.5625] pb-[1.0625rem] text-left">Reset Pin</div>
        <div onClick={handleItemClick(() => {
            if (shouldOpenInNewTab) {
                chrome.tabs.create({
                    url: chrome.runtime.getURL('src/entries/popup/index.html#/key-manage') + '#/key-manage'
                })
            } else {
                navigate('/key-manage')
            }
        })} className="pt-[1.125rem]  px-[1.5rem] cursor-pointer hover:bg-[#00BE78]/6 text-[#000] text-[1.3125rem] font-[500] leading-[1.5625] pb-[1.0625rem] text-left">Key Management</div>
        <div onClick={handleItemClick(() => {
            navigate('/set-screen-timer')
        })} className="pt-[1.125rem]  px-[1.5rem] cursor-pointer hover:bg-[#00BE78]/6 text-[#000] text-[1.3125rem] font-[500] leading-[1.5625] pb-[1.0625rem] text-left">Set Screen Off Time</div>
    </div>
})

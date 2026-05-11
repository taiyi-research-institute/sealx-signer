import { Outlet } from 'react-router-dom';
import './styles.css';
import Link from '@assets/svg/link.svg?react'
import MenuIcon from '@assets/svg/menu-icon.svg?react'
import { useGlobalContext } from '@src/hooks/useGlobalContext';
import { PopupMenu } from './popup-menu';
import { useCallback, useRef, useState } from 'react';
import { useClickOutside } from '@src/hooks/useOutsideClick';
import { useRequestContext } from '@src/hooks/useRequestContextHook';

export default function Layout() {
    const { address } = useGlobalContext()
    const [showPopupMenu, setShowPopupMenu] = useState<boolean>(false)
    const popupMenuRef = useRef<HTMLDivElement>(null);
    useClickOutside(popupMenuRef, () => setShowPopupMenu(false));
    const { title } = useRequestContext()
    const closeMenu = useCallback(() => {
        setShowPopupMenu(false)
    }, [setShowPopupMenu])


    return (
        <div className="app-layout w-full h-full flex flex-col bg-neutral-100">
            <header className="app-header bg-surface flex flex-col  justify-center relative">
                <div className='flex  justify-center items-center leading-[20px] mt-[24px] font-[500] text-[18px]'><Link className="w-[18px] h-[18px] text-brand mr-[8.5px]"></Link>{title}</div>
                <div className='flex  justify-center leading-[29px] text-[24px] mt-[17px] mb-[16px] font-[500]'>
                    {address && address.length >= 14
                        ? `${address.substring(0, 8)}...${address.substring(address.length - 6)}`
                        : address || 'Not initialized'}
                </div>
                <button
                    onClick={() => setShowPopupMenu(!showPopupMenu)}
                    className="cursor-pointer w-[44px] h-[44px] flex items-center justify-center absolute right-[20px] top-[29px] bg-transparent border-none"
                    aria-label="Menu"
                >
                    <MenuIcon className="w-[24px] h-[24px]"/>
                </button>
                {showPopupMenu ? <PopupMenu closeMenu={closeMenu} ref={popupMenuRef} className=' py-[12px] absolute z-[999999] right-[12px] top-[100px] rounded-[8px] px-[12px]  w-fit bg-surface popup-menu'></PopupMenu> : ('')}
            </header>
            <main className="app-main flex-1 w-full m-auto overflow-y-auto">
                <Outlet />
            </main>
            {/* <footer className="app-footer">
                <p>© 2025 SealX</p>
            </footer> */}
        </div>
    );
}

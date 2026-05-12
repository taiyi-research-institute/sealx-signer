import { Outlet, useLocation } from 'react-router-dom';
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
    const { pathname } = useLocation()
    const [showPopupMenu, setShowPopupMenu] = useState<boolean>(false)
    const popupMenuRef = useRef<HTMLDivElement>(null);
    useClickOutside(popupMenuRef, () => setShowPopupMenu(false));
    const { title } = useRequestContext()
    const closeMenu = useCallback(() => {
        setShowPopupMenu(false)
    }, [setShowPopupMenu])
    const hideHeaderRoutes = new Set(['/', '/task-home', '/task-detail']);
    const shouldHideHeader = hideHeaderRoutes.has(pathname);


    return (
        <div className="app-layout w-full h-full flex flex-col bg-[#f2f2f2]" data-header-hidden={shouldHideHeader ? 'true' : 'false'}>
            {!shouldHideHeader && <header className="app-header bg-[#fff] flex flex-col  justify-center relative">
                <div className='flex  justify-center items-center leading-[1.25] mt-[1.5rem] font-[500] text-[1.125rem]'><Link className="w-[18px] h-[18px] text-[#00BE78] mr-[0.5312rem]"></Link>{title}</div>
                <div className='flex  justify-center leading-[1.8125] text-[1.5rem] mt-[1.0625rem] mb-[1rem] font-[500]'>{address?.substring?.(0, 8)}...{address?.substring?.(address?.length - 6, address?.length)}</div>
                <MenuIcon onClick={() => setShowPopupMenu(!showPopupMenu)} className=" cursor-pointer w-[24px] h-[24px] absolute right-[32px] top-[41px]"></MenuIcon>
                {showPopupMenu ? <PopupMenu closeMenu={closeMenu} ref={popupMenuRef} className=' py-[0.75rem] absolute z-999999 right-[12px] top-[100px] rounded-[8px] px-[0.75rem]  w-fit bg-[#fff] popup-menu'></PopupMenu> : ('')}
            </header>}
            <main className="app-main flex-1 w-full m-auto overflow-y-auto">
                <Outlet />
            </main>
            {/* <footer className="app-footer">
                <p>© 2025 SealX</p>
            </footer> */}
        </div>
    );
}

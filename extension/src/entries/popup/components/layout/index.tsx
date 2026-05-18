import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import './styles.css';
import ArrowLeft from '@assets/svg/arrow-left.svg?react';
import MenuIcon from '@assets/svg/menu-icon.svg?react';
import { PopupMenu } from './popup-menu';
import { useCallback, useRef, useState } from 'react';
import { useClickOutside } from '@src/hooks/useOutsideClick';

export default function Layout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [showPopupMenu, setShowPopupMenu] = useState<boolean>(false);
  const popupMenuRef = useRef<HTMLDivElement>(null);
  useClickOutside(popupMenuRef, () => setShowPopupMenu(false));
  const closeMenu = useCallback(() => {
    setShowPopupMenu(false);
  }, [setShowPopupMenu]);
  const hideHeaderRoutes = new Set(['/', '/task-home', '/task-detail']);
  const shouldHideHeader = hideHeaderRoutes.has(pathname);

  const pageTitles: Record<string, string> = {
    '/reset-pin': 'Reset PIN',
    '/set-screen-timer': 'Screen Timer',
    '/bind-pubkey': 'Bind Pubkey',
    '/key-manage': 'Key Management',
    '/key-export': 'Export Signature Key',
    '/key-import': 'Import Signature Key',
  };
  const pageTitle = pageTitles[pathname] || 'SealX';

  return (
    <div
      className='app-layout w-full h-full flex flex-col bg-[#f2f2f2]'
      data-header-hidden={shouldHideHeader ? 'true' : 'false'}
    >
      {!shouldHideHeader && (
        <header className='app-header bg-[#fff] flex items-center justify-between h-[56px]'>
          <div className='w-[44px] h-full flex items-center justify-center'>
            <ArrowLeft
              onClick={() => navigate(-1)}
              className='cursor-pointer w-[20px] h-[20px] text-[#000]'
            />
          </div>
          <div className='flex-1 h-full flex items-center justify-center text-center leading-[1.25] font-[500] text-[1.25rem]'>
            {pageTitle}
          </div>
          <div className='w-[44px] h-full flex items-center justify-center relative'>
            {/* <MenuIcon onClick={() => setShowPopupMenu(!showPopupMenu)} className="cursor-pointer w-[24px] h-[24px]"></MenuIcon>
                    {showPopupMenu ? <PopupMenu closeMenu={closeMenu} ref={popupMenuRef} className='py-[0.75rem] absolute z-999999 right-[12px] top-[56px] rounded-[8px] px-[0.75rem] w-fit bg-[#fff] popup-menu'></PopupMenu> : ('')} */}
          </div>
        </header>
      )}
      <main className='app-main flex-1 w-full m-auto overflow-y-auto'>
        <Outlet />
      </main>
      {/* <footer className="app-footer">
                <p>© 2025 SealX</p>
            </footer> */}
    </div>
  );
}

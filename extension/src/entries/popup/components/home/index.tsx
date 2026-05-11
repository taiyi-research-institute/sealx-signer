import React, { useRef, useState } from 'react';
import { useSealXNavigate } from '../../hooks/useSealXNavigate';
import { useGlobalContext } from '@src/hooks/useGlobalContext';
import FilterMenu from '@assets/svg/filter-menu.svg?react';
import { useClickOutside } from '@src/hooks/useOutsideClick';
import { usePopupType } from '@src/hooks/usePopupType';
import './styles.css';

const Home: React.FC = () => {
    const navigate = useSealXNavigate();
    const { address } = useGlobalContext();
    const { isActionPopup, isSidePanel, isLoading: isPopupTypeLoading } = usePopupType();
    const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);
    const settingsMenuRef = useRef<HTMLDivElement>(null);
    useClickOutside(settingsMenuRef, () => setShowSettingsMenu(false));


    const handleSettingsClick = () => {
        setShowSettingsMenu(!showSettingsMenu);
    };

    const handleSettingsOption = (option: string) => {
        setShowSettingsMenu(false);
        // Handle different settings options here
        switch (option) {
            case 'reset-pin':
                navigate('/reset-pin');
                break;
            case 'key-manage':
                // Side Panel 模式下不需要新 tab 打开
                if (!isPopupTypeLoading && isActionPopup && !isSidePanel && chrome?.tabs?.create) {
                    chrome.tabs.create({
                        url: chrome.runtime.getURL('src/entries/popup/index.html#/key-manage') + '#/key-manage'
                    });
                } else {
                    navigate('/key-manage');
                }
                break;
            case 'set-screen-timer':
                navigate('/set-screen-timer');
                break;
            default:
                break;
        }
    };

    const formatAddress = (addr: string | null) => {
        if (!addr) return 'Not initialized';
        return addr; // Display full address
    };

    return (
        <div className='home-container flex w-full flex-col h-fit overflow-auto'>
            <div className='w-full flex flex-col h-fit py-[1.5rem] mx-auto relative'>
                {/* Header with Settings Button */}
                <div className='w-full px-[1.6406rem]  flex items-center justify-end relative'>
                    <FilterMenu
                        onClick={handleSettingsClick}
                        className='cursor-pointer hover:opacity-80 transition-opacity'
                    />
                    {showSettingsMenu && (
                        <div
                            ref={settingsMenuRef}
                            className='absolute z-[999999] px-[0.75rem] right-[12px] top-[30px] rounded-[8px] w-fit bg-[#fff] shadow-lg border border-[#000]/10'
                        >
                            <div
                                onClick={() => handleSettingsOption('reset-pin')}
                                className="pt-[1.125rem] px-[1.5rem] cursor-pointer hover:bg-[#00BE78]/6 text-[#000] text-[1.3125rem] font-[500] leading-[1.5625] pb-[1.0625rem] text-left"
                            >
                                Reset PIN
                            </div>
                            <div
                                onClick={() => handleSettingsOption('key-manage')}
                                className="pt-[1.125rem]  px-[1.5rem] cursor-pointer hover:bg-[#00BE78]/6 text-[#000] text-[1.3125rem] font-[500] leading-[1.5625] pb-[1.0625rem] text-left"
                            >
                                Key Management
                            </div>
                            <div
                                onClick={() => handleSettingsOption('set-screen-timer')}
                                className="pt-[1.125rem]  px-[1.5rem] cursor-pointer hover:bg-[#00BE78]/6 text-[#000] text-[1.3125rem] font-[500] leading-[1.5625] pb-[1.0625rem] text-left"
                            >
                                Set Screen Off Time
                            </div>
                        </div>
                    )}
                </div>

                {/* Logo Section */}
                <div className='sealx-logo w-full pt-[1.25rem] font-[500] text-[1.0625rem]'>
                    <img
                        className='m-auto'
                        src='/public/logo/sealx-logo.svg'
                        alt='SealX Logo'
                    />
                </div>

                {/* Main Content */}
                <div className='mx-auto px-[2.5625rem] mt-[3.75rem] mb-[1.5rem]'>
                    {/* <div className='text-center'>
                        <h1 className='text-[2rem] font-[600] text-[#000] mb-4 leading-tight'>
                            SealX EIP712 Signer
                        </h1> */}

                    {/* Address Display */}
                    <div className='mb-[1.5rem] p-[1rem] bg-[#000]/5 rounded-[12px] border border-[#000]/10'>
                        <div className='text-[0.875rem] text-[#000]/60 mb-[0.25rem]'>Current Signer Address</div>
                        <div className='text-[1rem] font-mono font-[500] text-[#000]'>
                            {formatAddress(address)}
                        </div>
                    </div>

                    <div className='space-y-[1rem] text-left text-[1.125rem] text-[#000]/80 leading-relaxed'>
                        <p>
                            A "What You See Is What You Sign" EIP712 structure data signing plugin
                            that provides secure and transparent digital signatures for blockchain transactions.
                        </p>
                        <p>
                            Ensure the integrity and authenticity of your EIP712 structured data
                            with our advanced cryptographic signing technology.
                        </p>
                    </div>

                    {/* Feature Highlights */}
                    <div className='mt-[2rem] grid grid-cols-1 gap-[1rem] max-w-[400px] mx-auto'>
                        <div className='flex items-center gap-x-[0.75rem] p-[0.75rem] bg-[#000]/5 rounded-[12px]'>
                            <div className='w-[24px] h-[24px] bg-[#00BE78] rounded-full flex items-center justify-center'>
                                <span className='text-[#fff] text-sm'>✓</span>
                            </div>
                            <span className='text-[1rem] text-[#000]/80'>
                                Secure Digital Signatures
                            </span>
                        </div>

                        <div className='flex items-center gap-x-[0.75rem] p-[0.75rem] bg-[#000]/5 rounded-[12px]'>
                            <div className='w-[24px] h-[24px] bg-[#00BE78] rounded-full flex items-center justify-center'>
                                <span className='text-[#fff] text-sm'>✓</span>
                            </div>
                            <span className='text-[1rem] text-[#000]/80'>
                                Browser Integration
                            </span>
                        </div>

                        <div className='flex items-center gap-x-[0.75rem] p-[0.75rem] bg-[#000]/5 rounded-[12px]'>
                            <div className='w-[24px] h-[24px] bg-[#00BE78] rounded-full flex items-center justify-center'>
                                <span className='text-[#fff] text-sm'>✓</span>
                            </div>
                            <span className='text-[1rem] text-[#000]/80'>
                                Enterprise Security
                            </span>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {/* <div className='mt-8 flex flex-col sm:flex-row gap-4 justify-center'>
                            <button
                                onClick={handleGetStarted}
                                className='px-8 py-3 bg-[#00BE78] text-white rounded-lg font-[500] text-[1rem] hover:bg-[#00A366] transition-colors duration-200 shadow-sm'
                            >
                                Get Started
                            </button>
                            <button
                                onClick={handleLearnMore}
                                className='px-8 py-3 bg-transparent border border-[#000]/20 text-[#000]/80 rounded-lg font-[500] text-[1rem] hover:bg-[#000]/5 transition-colors duration-200'
                            >
                                Learn More
                            </button>
                        </div> */}
                    {/* </div> */}
                </div>

                {/* Footer */}
                {/* <div className='text-[#000]/36 text-[1.5625rem] leading-[2.5] font-nanum-pen absolute bottom-[32px] w-full text-center'>
                    Sign What You See
                </div> */}
            </div>
        </div >
    );
};

export default Home;

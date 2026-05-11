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
        <div className='home-container flex w-full flex-col h-fit overflow-auto bg-sealx-gradient'>
            <div className='w-full flex flex-col h-fit py-[24px] mx-auto relative'>
                {/* Header with Settings Button */}
                <div className='w-full px-[26.25px]  flex items-center justify-end relative'>
                    <button
                        type="button"
                        onClick={handleSettingsClick}
                        aria-label="Settings"
                        className="cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-none p-0"
                    >
                        <FilterMenu aria-hidden="true" />
                    </button>
                    {showSettingsMenu && (
                        <div
                            ref={settingsMenuRef}
                            className='absolute z-[999999] px-[12px] right-[12px] top-[30px] rounded-[8px] w-fit bg-surface shadow-lg border border-neutral-950/[10%]'
                        >
                            <button
                                onClick={() => handleSettingsOption('reset-pin')}
                                className="w-full pt-[18px] px-[24px] cursor-pointer hover:bg-brand/[6%] text-[#000] text-[21px] font-[500] leading-[25px] pb-[17px] text-left bg-transparent border-none"
                            >
                                Reset PIN
                            </button>
                            <button
                                onClick={() => handleSettingsOption('key-manage')}
                                className="w-full pt-[18px] px-[24px] cursor-pointer hover:bg-brand/[6%] text-[#000] text-[21px] font-[500] leading-[25px] pb-[17px] text-left bg-transparent border-none"
                            >
                                Key Management
                            </button>
                            <button
                                onClick={() => handleSettingsOption('set-screen-timer')}
                                className="w-full pt-[18px] px-[24px] cursor-pointer hover:bg-brand/[6%] text-[#000] text-[21px] font-[500] leading-[25px] pb-[17px] text-left bg-transparent border-none"
                            >
                                Set Screen Off Time
                            </button>
                        </div>
                    )}
                </div>

                {/* Logo Section */}
                <div className='sealx-logo w-full pt-[20px] font-[500] text-[17px]'>
                    <img
                        className='m-auto'
                        src='/public/logo/sealx-logo.svg'
                        alt='SealX Logo'
                    />
                </div>

                {/* Main Content */}
                <div className='mx-auto px-[41px] mt-[60px] mb-[24px]'>
                    {/* <div className='text-center'>
                        <h1 className='text-[32px] font-[600] text-[#000] mb-4 leading-tight'>
                            SealX EIP712 Signer
                        </h1> */}

                    {/* Address Display */}
                    <div className='mb-[24px] p-[16px] bg-neutral-950/[5%] rounded-[12px] border border-neutral-950/[10%]'>
                        <div className='text-[14px] text-text-secondary mb-[4px]'>Current Signer Address</div>
                        <div className='text-[16px] font-mono font-[500] text-[#000]'>
                            {formatAddress(address)}
                        </div>
                    </div>

                    <div className='space-y-[16px] text-left text-[18px] text-text-primary leading-relaxed'>
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
                    <div className='mt-[32px] grid grid-cols-1 gap-[16px] max-w-[400px] mx-auto'>
                        <div className='flex items-center gap-x-[12px] p-[12px] bg-neutral-950/[5%] rounded-[12px]'>
                            <div className='w-[24px] h-[24px] bg-brand rounded-full flex items-center justify-center'>
                                <span className='text-surface text-sm'>✓</span>
                            </div>
                            <span className='text-[16px] text-text-primary'>
                                Secure Digital Signatures
                            </span>
                        </div>

                        <div className='flex items-center gap-x-[12px] p-[12px] bg-neutral-950/[5%] rounded-[12px]'>
                            <div className='w-[24px] h-[24px] bg-brand rounded-full flex items-center justify-center'>
                                <span className='text-surface text-sm'>✓</span>
                            </div>
                            <span className='text-[16px] text-text-primary'>
                                Browser Integration
                            </span>
                        </div>

                        <div className='flex items-center gap-x-[12px] p-[12px] bg-neutral-950/[5%] rounded-[12px]'>
                            <div className='w-[24px] h-[24px] bg-brand rounded-full flex items-center justify-center'>
                                <span className='text-surface text-sm'>✓</span>
                            </div>
                            <span className='text-[16px] text-text-primary'>
                                Enterprise Security
                            </span>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {/* <div className='mt-8 flex flex-col sm:flex-row gap-4 justify-center'>
                            <button
                                onClick={handleGetStarted}
                                className='px-8 py-3 bg-brand text-white rounded-lg font-[500] text-[16px] hover:bg-brand-dark transition-colors duration-200 shadow-sm'
                            >
                                Get Started
                            </button>
                            <button
                                onClick={handleLearnMore}
                                className='px-8 py-3 bg-transparent border border-neutral-950/[20%] text-text-primary rounded-lg font-[500] text-[16px] hover:bg-neutral-950/[5%] transition-colors duration-200'
                            >
                                Learn More
                            </button>
                        </div> */}
                    {/* </div> */}
                </div>

                {/* Footer */}
                {/* <div className='text-text-tertiary text-[25px] leading-[40px] font-nanum-pen absolute bottom-[32px] w-full text-center'>
                    Sign What You See
                </div> */}
            </div>
        </div >
    );
};

export default Home;

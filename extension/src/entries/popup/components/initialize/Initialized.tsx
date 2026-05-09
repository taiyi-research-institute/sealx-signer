import { useRequestContext } from '@src/hooks/useRequestContextHook';
import { MessageChannel } from 'sealx-message';
import { closeWindow } from '@src/core/background';
import { useMemo } from 'react';
import Button from '@src/components/button';

export function Initialized() {
    // const navigate = useSealXNavigate();
    const { request } = useRequestContext();

    // Determine if opened by page or manually
    // If sender is INPAGE or CONTENT, it's page-initiated
    const isPageInitiated = useMemo(() => request &&
        (request.sender === MessageChannel.INPAGE || request.sender === MessageChannel.CONTENT), [request]);

    const handleAction = () => {
        closeWindow();
        // if (isPageInitiated) {
        //     // Page-initiated: close window to return to page
        //     // messager.send(null, SealxTopic.CLOSE, MessageChannel.BACKGROUND);
        //     closeWindow();
        // } else {
        //     // Manually opened: navigate to home
        //     navigate('/', { replace: true });
        // }
    };

    return (
        <div className="login-container w-full flex flex-col">
            <div className='w-full h-full flex flex-col mx-auto relative'>
                <div className='sealx-logo w-full mt-[120px] font-[500] text-[17px]'>
                    <img className='m-auto' src="/public/logo/sealx-logo.svg" alt="SealX Logo" />
                </div>

                <div className='mx-auto px-[41px] mt-[91.57px] mb-[48px] text-center'>
                    <div className='text-[32px] font-bold text-[#000] mb-8'>
                        Initialization Completed
                    </div>

                    <div className='text-[18px] text-[#000]/[60%] leading-[32px] mb-12'>
                        {isPageInitiated
                            ? 'Your SealX Signer has been successfully initialized. You can now return to the page to continue.'
                            : 'Your SealX Signer has been successfully initialized. You can now start using all features.'
                        }
                    </div>

                    <Button
                        variant="primary"
                        onClick={handleAction}
                        className="w-full"
                    >
                        {isPageInitiated ? 'Return to Page' : 'Go to Home'}
                    </Button>
                </div>

                <div className='text-[#000]/[36%] text-[25px] leading-[40px] font-nanum-pen absolute bottom-[32px] w-full text-center'>
                    What you see is what you sign
                </div>
            </div>
        </div>
    );
}

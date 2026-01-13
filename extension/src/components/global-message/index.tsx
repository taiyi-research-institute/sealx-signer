import React, { useEffect, useState, useCallback } from 'react';
import Warning from '@assets/svg/warning.svg?react';
import SelectedIcon from '@assets/svg/selected.svg?react';
import InfoIcon from '@assets/svg/info.svg?react';
import CloseIcon from '@assets/svg/close.svg?react';

export type MessageType = 'success' | 'error' | 'info' | 'warning';
export type MessageMode = 'modal' | 'top';

export interface GlobalMessageProps {
    /** The message content to display */
    message: string;
    /** The type of message (determines color and icon) */
    type: MessageType;
    /** The display mode of the message */
    mode?: MessageMode;
    /** Whether the message is visible */
    visible: boolean;
    /** Callback when message should be dismissed */
    onDismiss: () => void;
    /** Auto-dismiss duration in milliseconds (0 for no auto-dismiss) */
    autoDismissDuration?: number;
    /** Whether to show a progress bar for auto-dismiss */
    showProgress?: boolean;
    /** Whether to show a close button */
    showCloseButton?: boolean;
    /** Additional CSS classes */
    className?: string;
}

/**
 * A global message component for displaying notifications to the user.
 * Features smooth animations, auto-dismiss with progress bar, and manual dismiss options.
 */
const GlobalMessage: React.FC<GlobalMessageProps> = ({
    message,
    type,
    mode = 'modal',
    visible,
    onDismiss,
    autoDismissDuration = 5000,
    showProgress = true,
    showCloseButton = true,
    className = '',
}) => {
    const [progress, setProgress] = useState(100);
    const [isExiting, setIsExiting] = useState(false);

    // Get type-specific styles
    const getTypeStyles = useCallback(() => {
        switch (type) {
            case 'success':
                return {
                    bg: 'bg-[#f0fff4]',
                    border: 'border-[#00be78]/80',
                    text: 'text-[#00be78]',
                    icon: <SelectedIcon className="w-6 h-6" />,
                    progress: 'bg-[#00be78]',
                };
            case 'error':
                return {
                    bg: 'bg-[#fff5f5]',
                    border: 'border-[#fb2828]/80',
                    text: 'text-[#fb2828]',
                    icon: <Warning className="w-6 h-6" />,
                    progress: 'bg-[#fb2828]',
                };
            case 'warning':
                return {
                    bg: 'bg-[#fffaf0]',
                    border: 'border-[#f6ad55]/80',
                    text: 'text-[#d69e2e]',
                    icon: <Warning className="w-6 h-6" />,
                    progress: 'bg-[#f6ad55]',
                };
            case 'info':
                return {
                    bg: 'bg-[#ebf8ff]',
                    border: 'border-[#4299e1]/80',
                    text: 'text-[#4299e1]',
                    icon: <InfoIcon className="w-6 h-6" />,
                    progress: 'bg-[#4299e1]',
                };
            default:
                return {
                    bg: 'bg-[#f0fff4]',
                    border: 'border-[#00be78]/80',
                    text: 'text-[#00be78]',
                    icon: <SelectedIcon className="w-6 h-6" />,
                    progress: 'bg-[#00be78]',
                };
        }
    }, [type]);

    // Handle auto-dismiss
    useEffect(() => {
        if (!visible || autoDismissDuration <= 0) {
            setProgress(100);
            return;
        }

        const startTime = Date.now();
        const interval = 50; // Update every 50ms for smooth progress

        const timer = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const newProgress = Math.max(0, 100 - (elapsed / autoDismissDuration) * 100);
            setProgress(newProgress);

            if (elapsed >= autoDismissDuration) {
                clearInterval(timer);
                setIsExiting(true);
                setTimeout(() => {
                    onDismiss();
                    setIsExiting(false);
                }, 300); // Wait for exit animation
            }
        }, interval);

        return () => clearInterval(timer);
    }, [visible, autoDismissDuration, onDismiss]);

    // Reset progress when message changes
    useEffect(() => {
        if (visible) {
            setProgress(100);
            setIsExiting(false);
        }
    }, [message, type, visible]);

    const typeStyles = getTypeStyles();

    if (!visible && !isExiting) {
        return null;
    }

    // Determine container classes based on mode
    const containerClasses = mode === 'top'
        ? ` absolute top-0 left-0 right-0 z-[9999] flex w-full justify-center transform transition-all duration-300 ease-out ${visible && !isExiting ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        } ${className}`
        : `absolute top-0 left-0 right-0 z-[9999] flex w-full h-full justify-center pt-[80px] transform transition-all duration-300 ease-out ${visible && !isExiting ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        } ${className}`;

    // Determine message box classes based on mode
    const messageBoxClasses = mode === 'top'
        ? `w-full ${typeStyles.bg} ${typeStyles.border} border-0 rounded-none shadow-md overflow-hidden`
        : `mx-auto max-w-[320px] h-fit ${typeStyles.bg} ${typeStyles.border} border-[0.1px] rounded-[16px] shadow-lg overflow-hidden`;

    return (
        <div
            className={containerClasses}
            role="alert"
            aria-live="assertive"
        >
            <div
                className={messageBoxClasses}
            >
                <div className="px-[24px] py-[16px] ">
                    <div className="flex   flex-1">
                        <div className='flex flex-1 justify-center'>
                            <div className={`flex-shrink-0 ${typeStyles.text} mr-[12px]`}>
                                {typeStyles.icon}
                            </div>
                            <div className="flex-1">
                                <p className={`text-[16px] font-medium ${typeStyles.text}`}>
                                    {message}
                                </p>
                            </div>
                        </div>

                        {showCloseButton && (
                            <div className='flex flex-col justify-start'>
                                <div
                                    onClick={() => {
                                        setIsExiting(true);
                                        setTimeout(() => {
                                            onDismiss();
                                            setIsExiting(false);
                                        }, 300);
                                    }}
                                    className={`ml-[12px] flex-shrink-0 rounded-full cursor-pointer border ${typeStyles.border} ${typeStyles.text} bg-[#fff] hover:scale-105  hover:bg-[#fff]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-current transition-all duration-200`}
                                    aria-label="Dismiss message"
                                >
                                    <CloseIcon className="w-[14px] h-[14px]" />
                                </div>
                            </div>

                        )}
                    </div>
                </div>
                {showProgress && autoDismissDuration > 0 && (
                    <div className="h-[1px] bg-gray-200 overflow-hidden">
                        <div
                            className={`h-full ${typeStyles.progress} rounded-[12px] transition-all duration-300 ease-linear`}
                            style={{ width: `${progress}%` }}
                            aria-valuenow={progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            role="progressbar"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default GlobalMessage;

import { useState, useEffect, useCallback } from "react"
import { Password } from "../password"
import './password.css'
// import { useGlobalContext } from "@src/hooks/useGlobalContext"
import { useErrorStore } from "@src/core/state"

interface PinPopupProps {
    onSubmit: (pin: string) => Promise<void>
    onClose: () => void
    title?: string
    description?: string
    processingText?: string
    clickToType?: boolean
}

export const PinPopup = ({ onSubmit, onClose, title = "Enter Your PIN", description = "Please enter your 6-digit PIN to export the key", processingText = "Exporting...", clickToType = false }: PinPopupProps) => {
    const [pin, setPin] = useState<string>('')
    const [isProcessing, setIsProcessing] = useState<boolean>(false)
    const setError = useErrorStore.use.setError()

    const handleSubmit = useCallback(async () => {
        if (pin.length < 6 || isProcessing) return

        setIsProcessing(true)

        try {
            await onSubmit(pin)
        } catch (error) {
            console.error('PIN submit failed:', error)
            setError('Pin error')
        } finally {
            setIsProcessing(false)
        }
    }, [pin, isProcessing, onSubmit, setError])

    // Handle PIN input - when PIN reaches 6 digits, automatically submit
    useEffect(() => {
        if (pin.length === 6 && !isProcessing) {
            handleSubmit()
        }
    }, [pin, isProcessing, handleSubmit])

    return (
        <div className="absolute top-[0px] h-full w-full flex items-center justify-center z-50 left-[0px] px-[1.5rem] bg-[#000]/50">
            <div className="bg-[#fff] border border-[#000]/10 rounded-[12px] p-[1.5rem] w-full relative">
                {/* Close button in top right corner */}
                <div
                    onClick={onClose}
                    className="absolute right-[24px] top-[24px] w-[24px] h-[24px] flex items-center justify-center cursor-pointer hover:bg-[#fff]/5 rounded-full transition-colors"
                    aria-label="Close"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onClose()}
                >
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="text-black/60"
                    >
                        <path
                            d="M13 1L1 13M1 1L13 13"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>



                {/* PIN input */}
                {!isProcessing ? (<>
                    <div className="text-[1.5rem] font-[500] mb-[1.5rem] text-center">
                    {title}
                </div>

                    <div className="mb-[1.5rem]">
                        <div className="text-[1rem] font-[500] mb-[0.75rem] text-[#000]/60">
                        {description}
                    </div>
                        <Password
                        password={pin}
                        onChange={setPin}
                        readonly={isProcessing}
                            className="w-full gap-x-[0.75rem]"
                            autoFocus
                            clickToType={clickToType}
                    />
                </div>
                </>) : (
                        <div className="mt-[2rem]">
                        <div className="flex flex-col items-center w-full">
                                <div className="h-[32px] w-[32px] animate-spin rounded-full border-[3px] border-[#00BE78]/25 border-t-[#00BE78] mb-[1rem]" />
                                <div className="text-[#000]/80 text-[1.125rem] font-[500] animate-pulse">
                                {processingText}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}

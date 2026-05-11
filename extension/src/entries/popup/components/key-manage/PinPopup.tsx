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
    instructionText?: string
}

export const PinPopup = ({ onSubmit, onClose, title = "Enter Your PIN", description = "Please enter your 6-digit PIN to export the key", processingText = "Exporting...", instructionText = "PIN entered. Export will start automatically..." }: PinPopupProps) => {
    const [pin, setPin] = useState<string>('')
    const [isProcessing, setIsProcessing] = useState<boolean>(false)
    const [progress, setProgress] = useState<number>(0)
    const setError = useErrorStore.use.setError()

    const handleSubmit = useCallback(async () => {
        if (pin.length < 6 || isProcessing) return

        setIsProcessing(true)
        setProgress(0)

        try {
            // Generate random duration between 3-5 seconds
            const duration = 3000 + Math.random() * 2000
            const startTime = Date.now()
            const updateInterval = 50 // Update every 50ms

            // Start the progress bar animation
            const progressInterval = setInterval(() => {
                const elapsed = Date.now() - startTime
                const currentProgress = Math.min((elapsed / duration) * 100, 100)
                setProgress(currentProgress)

                if (currentProgress >= 100) {
                    clearInterval(progressInterval)
                    setProgress(100)
                }
            }, updateInterval)
            // Submit the PIN
            onSubmit(pin).then(() => {
                clearInterval(progressInterval)
                setProgress(100)
            }).catch(() => {
                clearInterval(progressInterval)
                setError('Pin error')
            })
            // Wait for the progress bar to complete, then submit
            await new Promise(resolve => setTimeout(resolve, duration))

            // Clear interval just in case
            clearInterval(progressInterval)
            setProgress(100)



        } catch (error) {
            console.error('Export failed:', error)
            // Error handling should be done in the parent component
        } finally {
            setIsProcessing(false)
            setProgress(0)
        }
    }, [pin, isProcessing, onSubmit, setError])

    // Handle PIN input - when PIN reaches 6 digits, automatically submit
    useEffect(() => {
        if (pin.length === 6 && !isProcessing) {
            handleSubmit()
        }
    }, [pin, isProcessing, handleSubmit])

    return (
        <div className="absolute top-[0px] h-full w-full flex items-center justify-center z-50 left-[0px] px-[24px] bg-neutral-950/50">
            <div className="bg-surface border border-neutral-950/[0.1] rounded-[12px] p-[24px] w-full relative">
                {/* Close button in top right corner */}
                <div
                    onClick={onClose}
                    className="absolute right-[24px] top-[24px] w-[24px] h-[24px] flex items-center justify-center cursor-pointer hover:bg-surface/5 rounded-full transition-colors"
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



                {/* Progress bar for export mask */}
                {!isProcessing ? (<>
                    <div className="text-[24px] font-[500] mb-[24px] text-center">
                    {title}
                </div>

                <div className="mb-[24px]">
                    <div className="text-[16px] font-[500] mb-[12px] text-text-secondary">
                        {description}
                    </div>
                    <Password
                        password={pin}
                        onChange={setPin}
                        readonly={isProcessing}
                        className="w-full gap-x-[12px]"
                    />
                </div>
                </>) : (
                    <div className="mt-[32px]">
                        <div className="flex flex-col items-center w-full">
                            <div className="w-full text-[16px] max-w-[300px] mb-4">
                                <div className="text-brand text-[14px] text-center mt-2">
                                    {Math.round(progress)}%
                                </div>
                                <div className="w-full h-[8px] bg-neutral-950/[10%] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-brand transition-all duration-100 ease-linear"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                            <div className="text-text-primary text-[18px] font-[500] animate-pulse">
                                {processingText}
                            </div>
                        </div>
                    </div>
                )}

                {/* Instruction text */}
                {!isProcessing && pin.length === 6 && (
                    <div className="mt-[24px] text-brand text-[14px] text-center animate-pulse">
                        {instructionText}
                    </div>
                )}
            </div>
        </div>
    )
}

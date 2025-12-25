import { useCallback, useState } from "react"
import { useSealXNavigate } from "../../hooks/useSealXNavigate"
import { Password } from "../password"
import { PinPopup } from "./PinPopup"
import './password.css'
import CloseEye from '@assets/svg/close-eye.svg?react'
import OpenEye from '@assets/svg/open-eye.svg?react'
import { importKey, verifyTempCode } from "@src/core/background"
import { useErrorStore, useSuccessStore } from "@src/core/state"
import { useGlobalContext } from "@src/hooks/useGlobalContext"
import { useRequestContext } from "@src/hooks/useRequestContextHook"

declare global {
    interface Window {
        showDirectoryPicker: (options?: {
            id?: string
            mode?: 'read' | 'readwrite'
            startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'
        }) => Promise<FileSystemDirectoryHandle>
        showOpenFilePicker: (options?: {
            multiple?: boolean
            excludeAcceptAllOption?: boolean
            types?: Array<{
                description?: string
                accept: Record<string, string[]>
            }>
        }) => Promise<FileSystemFileHandle[]>
    }
}


export const KeyImport = () => {
    const navigate = useSealXNavigate()
    const { setAddress } = useGlobalContext();
    const { setSession } = useRequestContext()
    const [ecSession, setEcSession] = useState<string>('')
    const [tpPin, setTpPin] = useState<string>('') // Temporary code
    const [closeEye, setCloseEye] = useState<boolean>(true)
    const [showPinModal, setShowPinModal] = useState<boolean>(false)
    const onSelectFile = useCallback(async () => {
        try {
            const [fileHandle] = await window.showOpenFilePicker()
            const file = await fileHandle.getFile()
            setEcSession(await file.text())
        } catch (err) {
            console.error('Error selecting directory:', err)
        }
    }, [])
    const setError = useErrorStore.use.setError()
    const setSuccess = useSuccessStore.use.setSuccess()

    // Verify temporary code
    const onVerifyTempCode = useCallback(async () => {
        if (!ecSession) {
            setError('Please select an import file first')
            return
        }
        if (!tpPin) {
            setError('Please input temporary code')
            return
        }

        try {
            const isValid = await verifyTempCode(tpPin, ecSession)
            if (isValid) {
                setShowPinModal(true)
                setError('') // Clear any previous error
            } else {
                setError('Temporary code error')
                setTpPin('')
            }
        } catch (err) {
            console.error('Temp code verification failed:', err)
            setError('Temporary code verification failed')
            setTpPin('')
        }
    }, [ecSession, tpPin, setError])

    // Submit login PIN and complete import
    const onSubmitLoginPin = useCallback(async (userPin: string) => {
        if (!userPin || userPin.length < 6) {
            setError('Please enter a valid 6-digit PIN')
            return
        }

        try {
            const res = await importKey(userPin, ecSession, tpPin)
            if (res) {
                setAddress(res)
                setSuccess('Import successful')
                setShowPinModal(false)
                navigate('/login')
                setSession(null)
                // Give user time to see success message
            }
        } catch (err) {
            console.error('Import failed:', err, userPin, tpPin)
            setError('PIN code error')
            throw err // Re-throw to let PinPopup handle the error
        }
    }, [setError, ecSession, tpPin, setAddress, setSuccess, navigate, setSession])

    // Handle PIN input via PinPopup
    const handleImportWithPin = useCallback(async (userPin: string) => {
        return await onSubmitLoginPin(userPin)
    }, [onSubmitLoginPin])

    return (
        <div className="px-[24px] pt-[24px] w-full h-full flex flex-col">
            <div className="w-full rounded-[20px] bg-[#fff] flex-1">
                <div className="w-full bg-[#000] rounded-t-[20px] text-left px-[24px] pt-[22px] pb-[20px] font-[500] text-[26px] leading-[32px] text-[#fff]">
                    Import Signature Key
                </div>
                <div className="w-full px-[24px] pt-[24px]">
                    {/* Source Path - always visible */}
                    <div className='w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                        <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'>
                            Source Path
                        </div>
                        <div className='w-full mt-[16px] break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px]'>
                            <input
                                type="text"
                                onClick={onSelectFile}
                                value={ecSession}
                                readOnly
                                placeholder="Select import file"
                                className="w-2/3 px-[12px] pt-[8px] focus:!border-0 pb-[9px] rounded-[12px] bg-[#000]/[5%]"
                            />
                            <span onClick={onSelectFile} className="px-[12px] py-[8px] bg-[#000]/[10%] rounded-[8px] ml-[12px] cursor-pointer">
                                Select
                            </span>
                        </div>
                    </div>

                    {/* Temporary Code Input */}
                    <div className='mt-[24px] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                        <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'>
                            Temporary Password
                        </div>
                        <div className='w-full flex mt-[16px] items-center break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px]'>
                            <Password
                                seePassword={!closeEye}
                                password={tpPin}
                                onChange={setTpPin}
                                className="import-password key-manage-password flex-1"
                            />
                            <div className="ml-[24px] cursor-pointer">
                                {closeEye ? (
                                    <CloseEye onClick={() => setCloseEye(false)} />
                                ) : (
                                    <OpenEye onClick={() => setCloseEye(true)} />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className='w-full mt-[32px] flex justify-between mb-[32px]'>
                {/* Cancel Button */}
                <div
                    onClick={() => navigate(-1)}
                    className='cursor-pointer rounded-[34px] border-2 border-[rgba(0,0,0,0.06)] font-[500] text-[24px] leading-[28px] pl-[52.77px] pr-[53.23px] pt-[18px] pb-[22px] text-[#000]'
                >
                    Cancel
                </div>

                {/* Next/Import Button */}
                <div
                    onClick={onVerifyTempCode}
                    className='w-[346px] cursor-pointer rounded-[34px] bg-[#000] text-[#fff] border-2 border-[#000] font-[500] text-[24px] leading-[28px] pl-[57.77px] pr-[58.23px] pt-[18px] pb-[22px]'
                >
                    Import Now
                </div>
            </div>

            {/* PIN码输入模态框 */}
            {showPinModal && (
                <PinPopup
                    onSubmit={handleImportWithPin}
                    onClose={() => setShowPinModal(false)}
                    title="Enter Your Login PIN"
                    description="Please enter your 6-digit login PIN to import the key"
                    processingText="Importing..."
                    instructionText="PIN entered. Import will start automatically..."
                />
            )}
        </div>
    )
}

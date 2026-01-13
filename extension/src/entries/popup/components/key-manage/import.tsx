import { useCallback, useEffect, useState } from "react"
import { useSealXNavigate } from "../../hooks/useSealXNavigate"
import { PinPopup } from "./PinPopup"
import './password.css'
import CloseEye from '@assets/svg/close-eye.svg?react'
import OpenEye from '@assets/svg/open-eye.svg?react'
import CopyBtn from '@assets/svg/copy.svg?react'
import Warning from '@assets/svg/warning.svg?react'
import { importKey, verifyTempCode } from "@src/core/background"
import { useErrorStore, useSuccessStore } from "@src/core/state"
import { useGlobalContext } from "@src/hooks/useGlobalContext"
import { useRequestContext } from "@src/hooks/useRequestContextHook"
import Radio from "@src/components/radio"
import Button from "@src/components/button"
import GoogleDriveAuthMask from "@src/components/google-drive-auth-mask"
import { GoogleDrive } from "@src/core/google/drive"

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
    const [importMethod, setImportMethod] = useState<'local' | 'google-drive'>('local')
    const [googleDrive, setGoogleDrive] = useState<GoogleDrive | null>(null)
    const [isVerifying, setIsVerifying] = useState<boolean>(false)
    const [isAuthing, setIsAuthing] = useState<boolean>(false)

    const setError = useErrorStore.use.setError()
    const [progressTitle, setProgressTitle] = useState<string>('')
    const [progressDesc, setProgressDesc] = useState('')
    const setSuccess = useSuccessStore.use.setSuccess()


    // Helper function to verify temp code and show PIN modal
    const verifyAndShowPinModal = useCallback(async (sessionContent?: string) => {
        const contentToVerify = sessionContent || ecSession
        try {
            setProgressTitle('Verifying recovery password...')
            setProgressDesc('Please wait while we verify your recovery password.')
            const isValid = await verifyTempCode(tpPin, contentToVerify)
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

    // Initialize Google Drive
    useEffect(() => {
        const drive = new GoogleDrive('sealx')
        setGoogleDrive(drive)
    }, [])
    const [file, setFile] = useState<string>('')
    // Handle local file selection
    const onSelectFile = useCallback(async () => {
        try {
            const [fileHandle] = await window.showOpenFilePicker()
            const file = await fileHandle.getFile()
            setFile(file.name)
            setEcSession(await file.text())
            setSuccess('File selected successfully')
        } catch (err) {
            console.error('Error selecting file:', err)
            setError('Failed to select file. Please try again.')
        }
    }, [setError, setSuccess])

    // Verify temporary code
    const onVerifyTempCode = useCallback(async () => {
        if (!tpPin) {
            setError('Please input temporary code')
            return
        }

        setIsVerifying(true)
        try {
            // For Google Drive import, handle file reading and authentication
            if (importMethod === 'google-drive') {
                if (!googleDrive) {
                    setError('Google Drive not initialized')
                    return
                }

                try {
                    setProgressTitle('Loading from Google Drive ...')
                    setProgressDesc('Retrieving your backup file from Google Drive...')
                    // Check authentication and reauthorize if needed
                    let isValid = await googleDrive.checkTokenValidity()
                    if (!isValid) {
                        // Show Google Drive authorization mask
                        setIsAuthing(true)
                        try {
                            await googleDrive.reauthorize()
                            isValid = await googleDrive.checkTokenValidity()
                        } finally {
                            setIsAuthing(false)
                        }
                    }

                    if (!isValid) {
                        setError('Failed to authenticate with Google Drive')
                        return
                    }

                    // List files in the folder
                    const files = await googleDrive.listFolderFiles()
                    if (files.length === 0) {
                        setError('No backup files found in Google Drive')
                        return
                    }

                    // Find the sealx.key file or use the first file
                    let fileToRead = files[0]
                    const sealxKeyFile = files.find(file => file.name === 'sealx.key')
                    if (sealxKeyFile) {
                        fileToRead = sealxKeyFile
                    } else {
                        setError('not have sealx backup file in google drive')
                        return
                    }

                    // Read the file content
                    const content = await googleDrive.readFile(fileToRead.id)
                    setEcSession(content)
                    // setSuccess(`Loaded file: ${fileToRead.name}`)

                    // Now verify the temporary code with the file content
                    await verifyAndShowPinModal(content)
                } catch (err) {
                    console.error('Google Drive import failed:', err)
                    const errorMessage = err instanceof Error ? err.message : 'Failed to import from Google Drive'
                    setError(`Google Drive import failed: ${errorMessage}`)
                }
            } else {
                // For local import
                if (!ecSession) {
                    setError('Please select an import file first')
                    return
                }
                await verifyAndShowPinModal()
            }
        } finally {
            setIsVerifying(false)
        }
    }, [ecSession, tpPin, importMethod, googleDrive, setError, verifyAndShowPinModal])

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
            const errorMessage = err instanceof Error
                ? err.message.includes('permission')
                    ? 'Permission denied. Please check your PIN and try again.'
                    : err.message
                : 'PIN code error'
            setError(`Import failed: ${errorMessage}`)
            setShowPinModal(false)
            throw err // Re-throw to let PinPopup handle the error
        }
    }, [setError, ecSession, tpPin, setAddress, setSuccess, navigate, setSession])

    // Handle PIN input via PinPopup
    const handleImportWithPin = useCallback(async (userPin: string) => {
        return await onSubmitLoginPin(userPin)
    }, [onSubmitLoginPin])

    return (
        <div className="px-[24px]  py-[24px] w-full h-fit flex flex-col">
            <div className="w-full rounded-[20px] bg-[#fff] flex-1">
                <div className="w-full bg-[#000] rounded-t-[20px] text-left px-[24px] pt-[22px] pb-[20px] font-[500] text-[26px] leading-[32px] text-[#fff]">
                    Import Signature Key
                </div>
                <div className="w-full px-[24px] pt-[24px]">
                    {/* Import Source Selection */}
                    <div className='w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                        <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'>
                            How would you like to import your backup?
                        </div>
                        <div className='w-full mt-[16px]'>
                            <Radio
                                selected={importMethod}
                                items={[
                                    { label: 'From Local File', value: 'local' },
                                    { label: 'From Google Drive', value: 'google-drive' }
                                ]}
                                onChange={(value) => setImportMethod(value as 'local' | 'google-drive')}
                            />
                        </div>

                        {importMethod === 'local' ? (
                            <>
                                <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%] mt-[24px]'>
                                    Select your encrypted backup file
                                </div>
                                <div className='w-full mt-[16px] break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px] flex items-center'>
                                    <input
                                        type="text"
                                        onClick={onSelectFile}
                                        value={ecSession ? file : ''}
                                        readOnly
                                        placeholder="Select import file"
                                        className="w-2/3 text-[16px] px-[12px] pt-[8px] focus:!border-0 pb-[9px] rounded-[12px] bg-[#fff]/[90%] border-[#000]/[10%] border cursor-pointer"
                                        aria-label="Import file path"
                                    />
                                    <Button
                                        variant="primary"
                                        onClick={onSelectFile}
                                        className="!px-[24px] !pb-[8px] !pt-[6px] !text-[20px] ml-[12px]"
                                    >
                                        Select
                                    </Button>
                                </div>
                            </>
                        ) : (<></>)}
                    </div>

                    {/* Temporary Code Input */}
                    <div className='mt-[24px] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                        <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'>
                            Recovery Password
                        </div>
                        <div className='w-full flex mt-[16px] items-center break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px]'>
                            <div className="flex-1 relative">
                                <input
                                    type={closeEye ? "password" : "text"}
                                    value={tpPin}
                                    onChange={(e) => setTpPin(e.target.value)}
                                    placeholder="Enter recovery password"
                                    className="w-full text-[16px] px-[12px] pt-[8px] focus:!border-0 pb-[9px] rounded-[12px] bg-[#fff]/[90%] border-[#000]/[10%] border"
                                    aria-label="Recovery password"
                                />
                            </div>
                            <div className="ml-[24px] cursor-pointer">
                                {closeEye ? (
                                    <CloseEye onClick={() => setCloseEye(false)} />
                                ) : (
                                    <OpenEye onClick={() => setCloseEye(true)} />
                                )}
                            </div>
                        </div>
                        <div className="relative text-[#E99E42] pl-[40px] mt-[12px] text-[16px] font-[500] leading-[24px] flex text-left">
                            <Warning className='absolute left-[0px] top-[6px] mr-[13.25px] text-[#E99E42] w-[24px] h-[24px]' />
                            Please enter the recovery password that was used to encrypt your backup file. This password is required to decrypt and import your signature key.
                        </div>
                    </div>

                    {/* Information Box */}

                    <div className='font-[500] text-[19px] text-left mt-[24px] bg-[#00be78]/10 mb-[24px]  w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                        After importing the key file, you will need to enter your login PIN to complete the import process. Make sure you have both the backup file and recovery password ready.
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className='w-full mt-[32px] flex gap-x-[24px] justify-between '>
                {/* Cancel Button */}
                <Button
                    variant="secondary"
                    onClick={() => navigate(-1)}
                >
                    Cancel
                </Button>

                {/* Next/Import Button */}
                <Button
                    variant="primary"
                    onClick={onVerifyTempCode}
                    className="w-[346px]"
                    disabled={!tpPin || (importMethod === 'local' && !ecSession)}
                >
                    Import Now
                </Button>
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

            {/* Verification Mask/Overlay */}
            {isVerifying && (
                <div className="fixed inset-0 top-[0px] left-[0px] w-full h-full bg-[#fff]/60 flex items-center justify-center z-50">
                    <div className="bg-white rounded-[20px] p-[32px] flex flex-col items-center">
                        <div className="w-[48px] h-[48px] border-4 border-[#00be78] border-t-transparent rounded-full mb-[16px]" style={{
                            animation: 'spin 1s linear infinite'
                        }}></div>
                        <div className="text-[24px] font-[500] text-[#00be78]">
                            {progressTitle}
                        </div>
                        <div className="text-[16px] text-[#00be78] mt-[8px]">
                            {progressDesc}
                        </div>
                    </div>
                    <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            )}

            {/* Google Drive授权mask */}
            <GoogleDriveAuthMask visible={isAuthing} />
        </div>
    )
}

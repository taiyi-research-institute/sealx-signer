import { useCallback, useEffect, useState } from "react"
import { useSealXNavigate } from "../../hooks/useSealXNavigate"
import { PinPopup } from "./PinPopup"
// import CopyBtn from '@assets/svg/copy.svg?react'
import './password.css'
import Warning from '@assets/svg/warning.svg?react'
import CloseEye from '@assets/svg/close-eye.svg?react'
import OpenEye from '@assets/svg/open-eye.svg?react'
import { useRequestContext } from "@src/hooks/useRequestContextHook"
import { encodeSession } from "@src/core/utils/helper"
import { hashPin, pkHex } from "@src/core/background"
// import copy from 'copy-text-to-clipboard'
import { useErrorStore, useSuccessStore } from "@src/core/state"
import Radio from "@src/components/radio"
import Button from "@src/components/button"
import GoogleDriveAuthMask from "@src/components/google-drive-auth-mask"
import { GoogleDrive } from "@src/core/google/drive"
// import { error } from "console"

declare global {
    interface Window {
        showDirectoryPicker: (options?: {
            id?: string
            mode?: 'read' | 'readwrite'
            startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'
        }) => Promise<FileSystemDirectoryHandle>
    }
}


export const KeyExport = () => {
    const navigate = useSealXNavigate()
    const { session } = useRequestContext()
    const [tpPin, setTpPin] = useState<string>('') // 临时密码 - 改为用户输入
    const [confirmPin, setConfirmPin] = useState<string>('') // 确认密码
    const [closeEye, setCloseEye] = useState<boolean>(true)
    const [closeEyeConfirm, setCloseEyeConfirm] = useState<boolean>(true)
    const [directoryPath, setDirectoryPath] = useState('')
    const [directoryHandle, setDirectoryHandle] = useState<FileSystemFileHandle | null>(null)
    const [showPinModal, setShowPinModal] = useState<boolean>(false)
    const [isAuthing, setIsAuthing] = useState<boolean>(false)
    const [exportMethod, setExportMethod] = useState<'local' | 'google-drive'>('local')
    const [googleDrive, setGoogleDrive] = useState<GoogleDrive | null>(null)
    const [googleDriveStatus, setGoogleDriveStatus] = useState<'unauthenticated' | 'authenticated' | 'uploading' | 'error'>('unauthenticated')
    const setSuccess = useSuccessStore.use.setSuccess()
    const setError = useErrorStore.use.setError()

    // Validation states
    const [tpPinError, setTpPinError] = useState<string>('')
    const [confirmPinError, setConfirmPinError] = useState<string>('')
    const [matchError, setMatchError] = useState<string>('')

    // 初始化Google Drive
    useEffect(() => {
        const drive = new GoogleDrive('sealx')
        setGoogleDrive(drive)

        // 检查Google Drive认证状态
        const checkAuth = async () => {
            try {
                const isValid = await drive.checkTokenValidity()
                setGoogleDriveStatus(isValid ? 'authenticated' : 'unauthenticated')
            } catch (error) {
                console.error('Error checking Google Drive auth:', error)
                setGoogleDriveStatus('unauthenticated')
            }
        }

        checkAuth()
    }, [])
    // Validation functions
    const validateTpPin = useCallback((value: string): boolean => {
        if (!value || value.length < 6) {
            setTpPinError('Password must be at least 6 characters')
            return false
        }
        setTpPinError('')
        return true
    }, [])

    const validateConfirmPin = useCallback((value: string): boolean => {
        if (!value || value.length < 6) {
            setConfirmPinError('Password must be at least 6 characters')
            return false
        }
        setConfirmPinError('')
        return true
    }, [])

    const validateMatch = useCallback((tp: string, confirm: string): boolean => {
        if (tp && confirm && tp !== confirm) {
            setMatchError('Passwords do not match')
            return false
        }
        setMatchError('')
        return true
    }, [])

    // Handle blur validation
    const handleTpPinBlur = useCallback(() => {
        validateTpPin(tpPin)
        validateMatch(tpPin, confirmPin)
    }, [tpPin, confirmPin, validateTpPin, validateMatch])

    const handleConfirmPinBlur = useCallback(() => {
        validateConfirmPin(confirmPin)
        validateMatch(tpPin, confirmPin)
    }, [tpPin, confirmPin, validateConfirmPin, validateMatch])

    const onSelectDir = useCallback(async () => {
        try {
            const dirHandle = await window.showDirectoryPicker({
                mode: 'readwrite'
            })
            // Verify we can actually access the directory
            const fileHandle = await dirHandle.getFileHandle('sealx.key', { create: true })
            setDirectoryHandle(fileHandle)
            const file = await fileHandle.getFile()
            setDirectoryPath(`${dirHandle.name}/${file.name} (selected)`)
        } catch (err: unknown) {
            console.error('Error selecting directory:', err)
            setDirectoryPath('')
            setDirectoryHandle(null)
            if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
                // setError('User refuse')
            } else if (err && typeof err === 'object' && 'name' in err && err.name === 'SecurityError') {
                setError('Permission not allowed')
            } else {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
                setError(`Error selecting directory: ${errorMessage}`)
            }
        }
    }, [setError])
    // 处理PIN码输入和导出
    const handleExportWithPin = useCallback(async (userPin: string) => {
        // 优化验证：确保PIN码最小6位
        if (!userPin || userPin.length < 6) {
            setError('Please enter at least 6 characters for your PIN')
            return
        }

        try {
            // 1. 调用pkHex获取加密的私钥
            const encryptedPk = await pkHex(
                userPin,
                session?.host || '',
                session?.userId || '',
                session?.expire || 0,
                session?.sessionId || ''
            )

            // 2. 创建新的session对象，包含pk字段
            const updatedSession = {
                ...session!,
                pk: encryptedPk
            }

            // 3. 使用临时密码加密更新后的session
            const encoded = await encodeSession(hashPin(tpPin), updatedSession)

            if (exportMethod === 'local') {
                // 本地导出
                if (!directoryHandle) {
                    setError('Please select a destination directory first')
                    return
                }

                const writable = await directoryHandle.createWritable()
                await writable.write(encoded)
                await writable.close()

                setSuccess('Export successful. Key file has been saved as "sealx.key".')
            } else {
                // Google Drive导出
                if (googleDrive && googleDriveStatus !== 'authenticated') {
                    await googleDrive.reauthorize()
                    if (!await googleDrive.checkTokenValidity()) {
                        setError('Please connect to Google Drive Failed')
                        return
                    }
                }
                if (!googleDrive || googleDriveStatus === 'unauthenticated') {
                    setError('Please connect to Google Drive first')
                    return
                }

                setGoogleDriveStatus('uploading')
                try {
                    await googleDrive.uploadFile('sealx.key', encoded)
                    setSuccess('Export successful. Key file has been uploaded to Google Drive as "sealx.key".')
                } catch (err) {
                    console.error('Google Drive upload failed:', err)
                    setGoogleDriveStatus('error')
                    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
                    setError(`Google Drive upload failed: ${errorMessage}`)
                    throw err
                } finally {
                    setGoogleDriveStatus('authenticated')
                }
            }

            // 显示成功消息并关闭模态框
            setShowPinModal(false)

            setTimeout(() => {
                navigate(-1)
            }, 1500) // Give user time to see success message
        } catch (err) {
            console.error('Export failed:', err)
            const errorMessage = err instanceof Error
                ? err.message.includes('permission')
                    ? 'Permission denied. Please select a different directory or grant permissions.'
                    : err.message
                : 'Unknown error occurred'
            setError(`Export failed: ${errorMessage}`)
            setShowPinModal(false)
            throw err // Re-throw to let PinPopup handle the error
        }
    }, [directoryHandle, session, tpPin, navigate, setError, setSuccess, exportMethod, googleDrive, googleDriveStatus])

    const onSubmit = useCallback(async () => {
        // Validate all fields
        const isTpPinValid = validateTpPin(tpPin)
        const isConfirmPinValid = validateConfirmPin(confirmPin)
        const isMatchValid = validateMatch(tpPin, confirmPin)

        if (!isTpPinValid || !isConfirmPinValid || !isMatchValid) {
            // Error messages are already set by validation functions
            return
        }

        // 点击导出时弹出PIN码输入框
        if (exportMethod === 'local') {
            if (!directoryHandle) {
                setError('Please select a destination directory first')
                return
            }
        } else {
            if (!googleDrive || googleDriveStatus === 'unauthenticated') {
                // 显示Google Drive授权mask
                setIsAuthing(true)
                try {
                    await new Promise(resolve => setTimeout(resolve, 3000)) // 确保mask显示
                    await googleDrive?.reauthorize()
                    if (googleDrive?.checkTokenValidity()) {
                        setGoogleDriveStatus('authenticated')
                        setShowPinModal(true)
                    }
                } catch (err) {
                    console.error('Google Drive authorization failed:', err)
                    setError('Google Drive authorization failed. Please try again.')
                } finally {
                    setIsAuthing(false)
                }
                return
            }
        }

        setShowPinModal(true)
    }, [directoryHandle, setError, exportMethod, googleDrive, googleDriveStatus, tpPin, confirmPin, validateTpPin, validateConfirmPin, validateMatch])
    return <div className=" key-manage px-[1.5rem] py-[1.5rem] w-full h-fit flex flex-col">
        <div className="w-full rounded-[20px] bg-[#fff] flex-1">
            <div className="w-full bg-[#000] rounded-t-[20px] text-left px-[1.5rem] pt-[1.375rem] pb-[1.25rem] font-[500] text-[1.625rem] leading-[2] text-[#fff]">
                Export Signature Key
            </div>
            <div className="w-full px-[1.5rem] pt-[1.5rem]">
                <div className='  w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[#000]/60'>
                        Where we save the encrypted backup?
                    </div>
                    <div className='w-full mt-[1rem]'>
                        <Radio
                            selected={exportMethod}
                            items={[
                                { label: 'Save Locally', value: 'local' },
                                { label: 'Save to Google Drive', value: 'google-drive' }
                            ]}
                            onChange={(value) => setExportMethod(value as 'local' | 'google-drive')}
                        />
                    </div>

                    {exportMethod === 'local' ? (
                        <>
                            <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[#000]/60 mt-[1.5rem]'>
                                Choose where to save your encrypted backup
                            </div>
                            <div className='w-full mt-[1rem] wrap-break-word hyphens-auto text-left font-[500] text-[1.5rem] leading-[1.8125] flex items-center'>
                                <input
                                    id="directory-input"
                                    onClick={onSelectDir}
                                    value={directoryPath}
                                    readOnly
                                    placeholder="Select export directory"
                                    className="w-2/3 text-[1rem] px-[0.75rem] pt-[0.5rem] focus:border-0! pb-[0.5625rem] rounded-[12px] bg-[#fff]/90 border-[#000]/10 border cursor-pointer"
                                    aria-label="Export directory path"
                                />
                                <Button
                                    variant="primary"
                                    onClick={onSelectDir}
                                    className="px-[1.5rem]! pb-[0.5rem]! pt-[0.375rem]! text-[1.25rem]! ml-[0.75rem]"
                                >
                                    Select
                                </Button>
                            </div>
                        </>
                    ) : (<></>)}
                </div>
                <div className=' mt-[1.5rem]  w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[#000]/60'>
                        Recovery Password
                    </div>
                    <div className=' w-full flex mt-[1rem] items-center wrap-break-word hyphens-auto text-left font-[500] text-[1.5rem] leading-[1.8125]'>
                        <div className="flex-1 relative">
                            <input
                                type={closeEye ? "password" : "text"}
                                value={tpPin}
                                onChange={(e) => {
                                    const newValue = e.target.value
                                    setTpPin(newValue)
                                    // Clear error when user starts typing
                                    if (tpPinError) setTpPinError('')
                                    if (matchError) setMatchError('')
                                    // Validate in real-time if confirmPin exists
                                    if (confirmPin) {
                                        validateMatch(newValue, confirmPin)
                                    }
                                }}
                                onBlur={handleTpPinBlur}
                                placeholder="Enter recovery password"
                                className={`w-full text-[1rem] px-[0.75rem] pt-[0.5rem] focus:border-0! pb-[0.5625rem] rounded-[12px] bg-[#fff]/90 border ${tpPinError ? 'border-[#ff0000]' : 'border-[#000]/10'}`}
                                aria-label="Recovery password"
                            />
                            {tpPinError && (
                                <div className="text-[#ff0000] text-[0.875rem] mt-1">
                                    {tpPinError}
                                </div>
                            )}
                        </div>
                        <div className="ml-[1.5rem] cursor-pointer">
                            {closeEye ? <CloseEye onClick={() => {
                                setCloseEye(false)
                            }}></CloseEye> : <OpenEye onClick={() => {
                                setCloseEye(true)
                            }}></OpenEye>}
                        </div>
                    </div>

                    {/* Password Confirmation Field */}
                    <div className=' w-full flex mt-[1rem] items-center wrap-break-word hyphens-auto text-left font-[500] text-[1.5rem] leading-[1.8125]'>
                        <div className="flex-1 relative">
                            <input
                                type={closeEyeConfirm ? "password" : "text"}
                                value={confirmPin}
                                onChange={(e) => {
                                    const newValue = e.target.value
                                    setConfirmPin(newValue)
                                    // Clear error when user starts typing
                                    if (confirmPinError) setConfirmPinError('')
                                    if (matchError) setMatchError('')
                                    // Validate in real-time if tpPin exists
                                    if (tpPin) {
                                        validateMatch(tpPin, newValue)
                                    }
                                }}
                                onBlur={handleConfirmPinBlur}
                                placeholder="Confirm recovery password"
                                className={`w-full text-[1rem] px-[0.75rem] pt-[0.5rem] focus:border-0! pb-[0.5625rem] rounded-[12px] bg-[#fff]/90 border ${confirmPinError || matchError ? 'border-[#ff0000]' : 'border-[#000]/10'}`}
                                aria-label="Confirm recovery password"
                            />
                            {(confirmPinError || matchError) && (
                                <div className="text-[#ff0000] text-[0.875rem] mt-1">
                                    {confirmPinError || matchError}
                                </div>
                            )}
                        </div>
                        <div className="ml-[1.5rem] cursor-pointer">
                            {closeEyeConfirm ? <CloseEye onClick={() => {
                                setCloseEyeConfirm(false)
                            }}></CloseEye> : <OpenEye onClick={() => {
                                setCloseEyeConfirm(true)
                            }}></OpenEye>}
                        </div>
                    </div>

                    <div className=" relative text-[#E99E42] pl-[2.5rem] mt-[0.75rem] text-[1rem] font-[500] leading-[1.5] flex text-left">
                        <Warning className=' absolute left-[0px] top-[6px] mr-[0.8281rem] text-[#E99E42] w-[24px] h-[24px]' />
                        Please enter a recovery password (minimum 6 characters). This password will be used to encrypt your signature key backup. Make sure to save it securely.
                    </div>
                </div>

                <div className='font-[500] text-[1.1875rem] text-left mt-[1.5rem] bg-[#00be78]/10 mb-[1.5rem]  w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
                    After exporting the key file, please securely back up both the file and its password. Both are required to recover the key in case of emergency.
                </div>
            </div>
        </div>
        <div className='w-full mt-[2rem] flex gap-x-[1.5rem] justify-between '>
            <Button
                variant="secondary"
                onClick={() => navigate(-1)}
            >
                Cancel
            </Button>
            <Button
                variant="primary"
                onClick={onSubmit}
                className="w-[346px]"
                disabled={
                    (exportMethod === 'local' && !directoryHandle) ||
                    !tpPin || tpPin.length < 6 || tpPin !== confirmPin ||
                    !!tpPinError || !!confirmPinError || !!matchError
                }
            >
                Export Now
            </Button>
        </div>

        {/* PIN码输入模态框 */}
        {showPinModal && (
            <PinPopup
                onSubmit={handleExportWithPin}
                onClose={() => setShowPinModal(false)}
                title="Enter Your PIN"
                description="Please enter your 6-digit PIN to export the key"
                processingText="Exporting..."
                instructionText="PIN entered. Export will start automatically..."
            />
        )}

        {/* Google Drive授权mask */}
        <GoogleDriveAuthMask visible={isAuthing} />
    </div>
}

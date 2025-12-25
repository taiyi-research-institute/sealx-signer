import { useCallback, useEffect, useState } from "react"
import { useSealXNavigate } from "../../hooks/useSealXNavigate"
import { Password } from "../password"
import { PinPopup } from "./PinPopup"
import CopyBtn from '@assets/svg/copy.svg?react'
import './password.css'
import Warning from '@assets/svg/warning.svg?react'
import CloseEye from '@assets/svg/close-eye.svg?react'
import OpenEye from '@assets/svg/open-eye.svg?react'
import { useRequestContext } from "@src/hooks/useRequestContextHook"
import { pinGenerator } from "sealx-core"
import { encodeSession } from "@src/core/utils/helper"
import { hashPin, pkHex } from "@src/core/background"
import copy from 'copy-text-to-clipboard'
import { useErrorStore, useSuccessStore } from "@src/core/state"

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
    const [tpPin, setTpPin] = useState<string>('') // 临时密码
    const [closeEye, setCloseEye] = useState<boolean>(true)
    const [directoryPath, setDirectoryPath] = useState('')
    const [directoryHandle, setDirectoryHandle] = useState<FileSystemFileHandle | null>(null)
    const [showPinModal, setShowPinModal] = useState<boolean>(false)
    const setSuccess = useSuccessStore.use.setSuccess()
    const setError = useErrorStore.use.setError()

    // 初始化临时密码
    useEffect(() => {
        const p = pinGenerator()
        setTpPin(p)
    }, [])
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
        } catch (err) {
            console.error('Error selecting directory:', err)
            setDirectoryPath('')
            setDirectoryHandle(null)
        }
    }, [])
    // 处理PIN码输入和导出
    const handleExportWithPin = useCallback(async (userPin: string) => {
        if (!userPin || userPin.length < 6) {
            setError('Please enter a valid 6-digit PIN')
            return
        }

        if (!directoryHandle) {
            setError('Please select a destination directory first')
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

            // 4. 导出文件
            const writable = await directoryHandle.createWritable()
            await writable.write(encoded)
            await writable.close()

            // 5. 显示成功消息并关闭模态框
            setSuccess('Export successful. Key file has been saved as "sealx.key".')
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
            throw err // Re-throw to let PinPopup handle the error
        }
    }, [directoryHandle, session, tpPin, navigate, setError, setSuccess])

    const onSubmit = useCallback(async () => {
        // 点击导出时弹出PIN码输入框
        if (!directoryHandle) {
            setError('Please select a destination directory first')
            return
        }

        setShowPinModal(true)
    }, [directoryHandle, setError])
    return <div className=" key-manage px-[24px] pt-[24px] w-full h-full flex flex-col">
        <div className="w-full rounded-[20px] bg-[#fff] flex-1">
            <div className="w-full bg-[#000] rounded-t-[20px] text-left px-[24px] pt-[22px] pb-[20px] font-[500] text-[26px] leading-[32px] text-[#fff]">
                Export Signature Key
            </div>
            <div className="w-full px-[24px] pt-[24px]">
                <div className='  w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'>
                        Destination Path
                    </div>
                    <div className='w-full mt-[16px] break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px]'>
                        <input
                            id="directory-input"
                            onClick={onSelectDir}
                            value={directoryPath}
                            readOnly
                            placeholder="Select export directory"
                            className="w-2/3 px-[12px] pt-[8px] focus:!border-0 pb-[9px] rounded-[12px] bg-[#000]/[5%]"
                            aria-label="Export directory path"
                        />
                        <button
                            type="button"
                            onClick={onSelectDir}
                            className="cursor-pointer px-[12px] py-[8px] bg-[#000]/[10%] rounded-[8px] ml-[12px] hover:bg-[#000]/[15%] transition-colors"
                        >
                            Select
                        </button>
                    </div>
                </div>
                <div className=' mt-[24px]  w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'>
                        Temporary Password
                    </div>
                    <div className=' w-full flex mt-[16px] items-center break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px]'>
                        <Password seePassword={!closeEye} password={tpPin} readonly={true} className="export-password key-manage-password flex-1"></Password>
                        <div className="ml-[24px] cursor-pointer">
                            {closeEye ? <CloseEye onClick={() => {
                                setCloseEye(false)
                            }}></CloseEye> : <OpenEye onClick={() => {
                                setCloseEye(true)
                            }}></OpenEye>}
                        </div>
                        <div onClick={() => {
                            copy(tpPin)
                            setSuccess('Password copied successfully.')
                        }} className="ml-[24px] w-[20px] h-[20px] cursor-pointer">
                            <CopyBtn className="w-full h-full"></CopyBtn>
                        </div>
                    </div>
                    <div className=" relative text-[#E99E42] pl-[40px] mt-[12px] text-[16px] font-[500] leading-[24px] flex text-left">
                        <Warning className=' absolute left-[0px] top-[6px] mr-[13.25px] text-[#E99E42] w-[24px] h-[24px]' />
                        Your signature key recovery temporary password has been automatically generated. To ensure you can recover your signature key if needed, please immediately copy and save this temporary password to a secure location.
                    </div>
                </div>

                <div className='font-[500] text-[19px] mt-[24px] bg-[#0E41F5] mb-[24px] text-[#fff] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                    After exporting the key file, please securely back up both the file and its password. Both are required to recover the key in case of emergency.
                </div>
            </div>
        </div>
        <div className='w-full mt-[32px] flex justify-between mb-[32px]'>
            <div onClick={() => {
                navigate(-1)
            }} className=' cursor-pointer rounded-[34px] border-2 border-[rgba(0,0,0,0.06)] font-[500] text-[24px] leading-[28px] pl-[52.77px] pr-[53.23px] pt-[18px] pb-[22px] text-[#000]'>
                Cancel
            </div>
            <button
                onClick={onSubmit}
                className={`w-[346px] rounded-[34px] border-2 font-[500] text-[24px] leading-[28px] pl-[57.77px] pr-[58.23px] pt-[18px] pb-[22px] ${!directoryHandle
                    ? 'bg-gray-400 text-[#fff] border-gray-400 cursor-not-allowed'
                    : 'bg-[#000] text-[#fff] border-[#000] cursor-pointer'
                    }`}
                disabled={!directoryHandle}
            >
                Export Now
            </button>
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
    </div>
}

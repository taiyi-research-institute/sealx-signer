import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react"
import { useSealXNavigate } from "../../hooks/useSealXNavigate"
import { PinPopup } from "./PinPopup"
import './styles.css'
import CloseEye from '@assets/svg/close-eye.svg?react'
import OpenEye from '@assets/svg/open-eye.svg?react'

import Warning from '@assets/svg/warning.svg?react'
import { importKey, verifyTempCode } from "@src/core/background"
import { useErrorStore } from "@src/core/state"
import { useGlobalContext } from "@src/hooks/useGlobalContext"
import { useRequestContext } from "@src/hooks/useRequestContextHook"
import Radio from "@src/components/radio"
import Button from "@src/components/button"
import GoogleDriveAuthMask from "@src/components/google-drive-auth-mask"
import { GoogleDrive } from "@src/core/google/drive"
import { usePinInputMode } from "../../utils/pinInputMode"

export const KeyImport = () => {
    const navigate = useSealXNavigate()
    const { setAddress } = useGlobalContext();
    const { request, setSession } = useRequestContext()
    const [ecSession, setEcSession] = useState<string>('')
    const [selectedFileName, setSelectedFileName] = useState<string>('')
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
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const { clickToType, clickToTypeKey } = usePinInputMode(request)

    const getFileReadErrorMessage = useCallback((err: unknown) => {
        if (err instanceof DOMException) {
            return `Failed to read selected file (${err.name}). Please select the backup file again.`
        }
        if (err instanceof Error) {
            return `Failed to read selected file: ${err.message}`
        }
        return 'Failed to read selected file. Please select the backup file again.'
    }, [])


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
    const mountedRef = useRef(true)
    useEffect(() => {
        return () => {
            mountedRef.current = false
        }
    }, [])
    const onSelectFile = useCallback(() => {
        fileInputRef.current?.click()
    }, [])

    const onLocalFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return

        try {
            const content = await file.text()
            if (!content.trim()) {
                setSelectedFileName(file.name)
                setEcSession('')
                setError('Selected file is empty. Please select a valid SealX backup file.')
                return
            }
            setSelectedFileName(file.name)
            setEcSession(content)
            setError('')
        } catch (err) {
            console.error('Error reading import file:', err)
            setSelectedFileName('')
            setEcSession('')
            setError(getFileReadErrorMessage(err))
        }
    }, [getFileReadErrorMessage, setError])

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
            if (mountedRef.current) {
                setIsVerifying(false)
            }
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
    }, [setError, ecSession, tpPin, setAddress, navigate, setSession])

    // Handle PIN input via PinPopup
    const handleImportWithPin = useCallback(async (userPin: string) => {
        return await onSubmitLoginPin(userPin)
    }, [onSubmitLoginPin])

    return (
      <div className='key-manage-page'>
        <section className='key-manage-card'>
          <div className='w-full'>
            <div className='w-full rounded-[12px] border-[var(--sx-border)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
              <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[var(--sx-muted)]'>
                How would you like to import your backup?
              </div>
              <div className='w-full mt-[1rem]'>
                <Radio
                  selected={importMethod}
                  items={[
                    { label: 'From Local File', value: 'local' },
                    { label: 'From Google Drive', value: 'google-drive' },
                  ]}
                  onChange={(value) =>
                    setImportMethod(value as 'local' | 'google-drive')
                  }
                />
              </div>

              {importMethod === 'local' ? (
                <>
                  <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[var(--sx-muted)] mt-[1.5rem]'>
                    Select your encrypted backup file
                  </div>
                  <div className='w-full mt-[1rem] wrap-break-word hyphens-auto text-left font-[500] text-[1.5rem] leading-[1.8125] flex items-center'>
                    <input
                      ref={fileInputRef}
                      type='file'
                      accept='.key,text/plain,application/octet-stream'
                      className='hidden'
                      onChange={onLocalFileChange}
                      aria-label='Select import file'
                    />
                    <input
                      type='text'
                      onClick={onSelectFile}
                      value={selectedFileName}
                      readOnly
                      placeholder='Select import file'
                      className='w-2/3 text-[1rem] px-[0.75rem] pt-[0.5rem] focus:border-0! pb-[0.5625rem] rounded-[12px] bg-[var(--sx-surface-soft)] border-[var(--sx-border)] focus:border-[var(--sx-focus)] focus:outline-none border cursor-pointer'
                      aria-label='Import file path'
                    />
                    <Button
                      variant='primary'
                      onClick={onSelectFile}
                      className='px-[1.5rem]! pb-[0.5rem]! pt-[0.375rem]! text-[1.25rem]! ml-[0.75rem]'
                    >
                      Select
                    </Button>
                  </div>
                </>
              ) : (
                <></>
              )}
            </div>

            {/* Temporary Code Input */}
            <div className='mt-[1.5rem] w-full rounded-[12px] border-[0.5px] border-[var(--sx-border)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
              <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[var(--sx-muted)]'>
                Recovery Password
              </div>
              <div className='w-full flex mt-[1rem] items-center wrap-break-word hyphens-auto text-left font-[500] text-[1.5rem] leading-[1.8125]'>
                <div className='flex-1 relative'>
                  <input
                    autoFocus
                    type={closeEye ? 'password' : 'text'}
                    value={tpPin}
                    onChange={(e) => setTpPin(e.target.value)}
                    placeholder='Enter recovery password'
                    className='w-full text-[1rem] px-[0.75rem] pt-[0.5rem] focus:border-0! pb-[0.5625rem] rounded-[12px] bg-[var(--sx-surface-soft)] border-[var(--sx-border)] focus:border-[var(--sx-focus)] focus:outline-none border'
                    aria-label='Recovery password'
                  />
                </div>
                <div className='ml-[1.5rem] cursor-pointer'>
                  {closeEye ? (
                    <CloseEye onClick={() => setCloseEye(false)} />
                  ) : (
                    <OpenEye onClick={() => setCloseEye(true)} />
                  )}
                </div>
              </div>
              <div className='relative text-[var(--sx-warning)] pl-[2.5rem] mt-[0.75rem] text-[1rem] font-[500] leading-[1.5] flex text-left'>
                <Warning className='absolute left-[0px] top-[6px] mr-[0.8281rem] text-[var(--sx-warning)] w-[24px] h-[24px]' />
                Please enter the recovery password that was used to encrypt your
                backup file. This password is required to decrypt and import
                your signature key.
              </div>
            </div>

            {/* Information Box */}

            <div className='font-[500] text-[1.1875rem] text-left mt-[1.5rem] bg-[var(--sx-brand-soft)] mb-[1.5rem]  w-full rounded-[12px] border-[0.5px] border-[var(--sx-border)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
              After importing the key file, you will need to enter your login
              PIN to complete the import process. Make sure you have both the
              backup file and recovery password ready.
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <div className='w-full mt-[1.5rem] key-action-grid'>
          {/* Cancel Button */}
          <Button variant='secondary' onClick={() => navigate(-1)}>
            Cancel
          </Button>

          {/* Next/Import Button */}
          <Button
            variant='primary'
            onClick={onVerifyTempCode}
            className='w-[346px]'
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
            title='Enter Your Login PIN'
            description='Please enter your 6-digit login PIN to import the key'
            processingText='Importing...'
            clickToType={clickToType}
            clickToTypeKey={clickToTypeKey}
          />
        )}

        {/* Verification Mask/Overlay */}
        {isVerifying && (
          <div className='fixed inset-0 bg-[#101820]/82 flex items-center justify-center z-50' role="alert" aria-busy="true" aria-live="polite">
            <div className='bg-white rounded-[16px] shadow-[var(--sx-shadow-raised)] p-8 flex flex-col items-center'>
              <div className='animate-spin rounded-full h-12 w-12 border-[3px] border-[var(--sx-brand)]/30 border-t-[var(--sx-brand)] mb-4'></div>
              <div className='text-[1.25rem] font-[800] text-[var(--sx-text)]'>
                {progressTitle}
              </div>
              <div className='text-[0.9375rem] font-[650] text-[var(--sx-muted)] mt-2'>
                {progressDesc}
              </div>
            </div>
          </div>
        )}

        {/* Google Drive授权mask */}
        <GoogleDriveAuthMask visible={isAuthing} />
      </div>
    );
}

import FilterMenu from '@assets/svg/filter-menu.svg?react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CheckBox from '@assets/svg/check-board.svg?react'
import Calendar from '@assets/svg/calendar.svg?react'
import Vault from '@assets/svg/vault.svg?react'
import Guardians from '@assets/svg/guardions.svg?react'
import Protected from '@assets/svg/protected.svg?react'
import Avatar1 from '@assets/svg/avatar-1.svg?react'
import AccountIcon from '@assets/svg/account.svg?react'
import Link from '@assets/svg/link.svg?react'
import CoinIcon from '@assets/svg/coin-icon.svg?react'
import AddressCardIcon from '@assets/svg/address-card.svg?react'
import TagIcon from '@assets/svg/tag.svg?react'
import NoTasksIcon from '@assets/svg/no-tasks.svg?react'
import { PopupCategory } from './category.js'
import { useClickOutside } from '@src/hooks/useOutsideClick'
import { useRequestContext } from '@src/hooks/useRequestContextHook'
import { TabManager, type SealxSignTask } from 'sealx-core'
import moment from 'moment'
import { groupBy, map } from 'lodash'
import { SealxTopic } from 'sealx-message'
import { SignTaskRender, type SignTaskRenderProps } from './task-render.js'
import messager from '@src/core/messager'
import { MessageChannel } from 'sealx-message'
import type { ReplyFunc } from 'sealx-message'
import { closeWindow } from '@src/core/background'
import { useLocation } from 'react-router-dom'

const NoPendingTasks = () => {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center py-[60px]">
            <NoTasksIcon className="mb-[24px]" />
            <div className="text-center">
                <div className="text-[24px] leading-[29px] font-[500] text-[#000] mb-[12px]">
                    No Pending Tasks
                </div>
                <div className="text-[16px] leading-[22px] font-[400] text-[rgba(0,0,0,0.6)]">
                    No pending tasks for sign-off or rejection at this time
                </div>
            </div>
        </div>
    )
}

const SigningOverlay = ({ timeout, progress, onClose }: { timeout: boolean; progress: number; onClose: () => void }) => {
    if (timeout) {
        return (
            <div className='absolute inset-0 bg-neutral-950/[80%] flex items-center justify-center'>
                <div className="flex flex-col items-center">
                    <div className="text-[#ff4d4f] text-[20px] font-[500] mb-4">Signing Timeout</div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-[#1677ff] text-white rounded-lg text-[14px] font-[500] cursor-pointer border-none"
                    >
                        Close
                    </button>
                </div>
            </div>
        )
    }
    return (
        <div className='absolute inset-0 bg-neutral-950/[80%] flex items-center justify-center'>
            <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-16 w-16 border-[3px] border-white/30 border-t-white mb-4"></div>
                {progress >= 75 ? (
                    <div className="text-white/80 text-[16px] font-[400] animate-pulse">Almost done...</div>
                ) : (
                    <div className="text-white text-[20px] font-[500]">Signing...</div>
                )}
            </div>
        </div>
    )
}
let previewWindow: chrome.windows.Window | null = null
const onReview = async (preViewUrl: string) => {
    if (previewWindow) {
        await chrome.windows.remove(previewWindow.id!)
        previewWindow = null
    }
    previewWindow = await chrome.windows.create({
        url: preViewUrl,
        focused: true,
        width: 1200,
        height: 810
    })
}
export const TaskHome = () => {
    const [total, setTotal] = useState<number>(0)
    const [category, setCategory] = useState<string>('')
    const templateFactory = useRef<HTMLDivElement>(null)
    const [showPopupMenu, setShowPopupMenu] = useState<boolean>(false)
    const popupMenuRef = useRef<HTMLDivElement>(null);
    useClickOutside(popupMenuRef, () => setShowPopupMenu(false));
    const { request } = useRequestContext()
    const [list, setList] = useState<Array<SealxSignTask>>([])
    const [signing, setSigning] = useState(false)
    const [signTimeout, setSignTimeout] = useState(false)
    const [signProgress, setSignProgress] = useState<number>(0)
    const replyRef = useRef<ReplyFunc>(null)
    const originTabIdMapRef = useRef<Map<string, number>>(new Map())
    const currentSigningTaskIdRef = useRef<string | null>(null)
    const signTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const { state } = useLocation() as {
        state: {
            result: {
                taskId: string, signatures: string[],
                signCount: number
            }
        }
    };

    // SIGN/BATCH_SIGN handler: send signature result, start signing state
    useEffect(() => {
        if (!signing && (request.topic === SealxTopic.SIGN || request.topic === SealxTopic.BATCH_SIGN) && state && state.result && state.result.taskId && state.result.signatures.length > 0 && state.result.signCount > 0) {
            setSigning(true)
            setSignTimeout(false)
            setSignProgress(0)
            currentSigningTaskIdRef.current = state.result.taskId
            const reply = replyRef.current ? replyRef.current : request.reply
            try {
                reply?.(state)
                messager.send(state.result, SealxTopic.SIGN_RESPONSE, MessageChannel.INPAGE)
            } catch {
                // Reply target may already be closed; signing state fallback handles timeout.
            }

            // 20s fallback timeout: show timeout hint if no SIGN_RESPONSE arrives
            if (signTimeoutRef.current) {
                clearTimeout(signTimeoutRef.current)
            }
            const startTime = Date.now()
            const DURATION = 20000
            signTimeoutRef.current = setTimeout(() => {
                setSignTimeout(true)
            }, DURATION)

            // Progress timer: update every 500ms
            const progressTimer = setInterval(() => {
                const elapsed = Date.now() - startTime
                const progress = Math.min((elapsed / DURATION) * 100, 100)
                setSignProgress(progress)
            }, 500)

            return () => {
                if (signTimeoutRef.current) {
                    clearTimeout(signTimeoutRef.current)
                    signTimeoutRef.current = null
                }
                clearInterval(progressTimer)
            }
        }
    }, [state, request, signing])

    // SIGN/BATCH_SIGN request: store task list and origin tabId mapping
    useEffect(() => {
        if (request.topic === SealxTopic.BATCH_SIGN || request.topic === SealxTopic.SIGN) {
            const items = ((request.payload instanceof Array ? request.payload : [request.payload]) as SealxSignTask[]).filter((task) => {
                return Number(task.validUntilTime) > Date.now()
            })
            setTotal(items.length)
            setList(items)
            replyRef.current = request.reply ?? null
            // Store tabId per taskId for later SIGN_RESPONSE routing
            if (request.header?.tabId) {
                items.forEach((task: SealxSignTask) => {
                    originTabIdMapRef.current.set(task.taskId, request.header.tabId)
                })
            }
            TabManager.getInstance().updateActiveTab(request.header.tabId)
        }
    }, [request])

    // SIGN_RESPONSE handler: validate, clear signing state, update task list
    useEffect(() => {
        if (request.topic === SealxTopic.SIGN_RESPONSE) {
            const payload = request.payload as { taskId: string, error: string }

            // Security: verify tabId matches the originating tab
            const expectedTabId = originTabIdMapRef.current.get(payload.taskId)
            if (expectedTabId && request.header?.tabId && request.header.tabId !== expectedTabId) {
                console.warn(`SIGN_RESPONSE from unexpected tab: expected ${expectedTabId}, got ${request.header.tabId}`)
                return
            }

            // Race condition prevention: verify taskId matches current signing task
            if (currentSigningTaskIdRef.current && payload.taskId !== currentSigningTaskIdRef.current) {
                console.warn(`Sign response taskId mismatch: expected ${currentSigningTaskIdRef.current}, got ${payload.taskId}`)
                return
            }

            currentSigningTaskIdRef.current = null
            setSigning(false)
            setSignTimeout(false)
            setSignProgress(0)

            // Clear fallback timeout
            if (signTimeoutRef.current) {
                clearTimeout(signTimeoutRef.current)
                signTimeoutRef.current = null
            }

            if (payload.error) {
                closeWindow()
                return
            }
            setList(currentList => {
                const task = currentList.find(a => a.taskId == payload.taskId)
                if (task) {
                    if (task.preViewUrl && previewWindow) {
                        chrome.windows.remove(previewWindow.id!).then(() => {
                            previewWindow = null
                        })
                    }
                }
                const items = currentList.filter(a => a.taskId !== payload.taskId)
                setTotal(items.length)
                if (items.length === 0) {
                    setTimeout(() => {
                        // 通知 background 处理队列中的下一个请求
                        chrome.runtime.sendMessage({ type: 'panel-process-queue' })
                        closeWindow()
                    }, 50)
                } else {
                    // 还有任务，通知处理队列
                    chrome.runtime.sendMessage({ type: 'panel-process-queue' })
                }
                return items
            })
            try {
                request.reply?.(request.payload as never)
            } catch {
                // Reply target may already be closed.
            }

        }
    }, [request])

    // Visibility change: auto-timeout when page is hidden
    useEffect(() => {
        if (!signing) return

        let quickTimer: ReturnType<typeof setTimeout> | null = null

        const handleVisibility = () => {
            if (document.hidden && signing && !signTimeout) {
                // 清除上一个 timer
                if (quickTimer) clearTimeout(quickTimer)
                quickTimer = setTimeout(() => {
                    if (signing && document.hidden) {
                        setSignTimeout(true)
                    }
                }, 5000)
            } else if (!document.hidden) {
                // 页面恢复可见时清除 timer
                if (quickTimer) {
                    clearTimeout(quickTimer)
                    quickTimer = null
                }
            }
        }

        document.addEventListener('visibilitychange', handleVisibility)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility)
            if (quickTimer) clearTimeout(quickTimer)
        }
    }, [signing, signTimeout])

    // Cleanup on unmount
    useEffect(() => {
        const originTabIdMap = originTabIdMapRef.current
        return () => {
            originTabIdMap.clear()
            if (signTimeoutRef.current) {
                clearTimeout(signTimeoutRef.current)
            }
        }
    }, [])

    const tasks = useMemo(() => {
        const tasks = groupBy(list.sort((a, b) => {
            return Number(a.validUntilTime) - Number(b.validUntilTime)
        }).map((task) => {
            const date = moment(Number(task.validUntilTime))
            const day = date.clone().diff(Date.now(), 'day')
            return {
                ...task,
                validUntilTime: Number(task.validUntilTime),
                days: day,
                date: date.format('YYYY-MM-DD')
            }
        }), 'days')
        return tasks
    }, [list])

    // Note: signing state is managed by the SIGN/BATCH_SIGN request handler
    // This callback only sends the signature result
    const onSign = useCallback(async (taskId: string, signatures: { taskId: string, signature: string }[] | string | null) => {
        const reply = replyRef.current
        const over = list.length - 1 === 0
        if (signatures instanceof Array) {
            if (signatures.length > 1) {
                reply?.({
                    result: {
                        taskId,
                        signatures,
                        signCount: signatures.length
                    }
                } as never, over)
            } else {
                reply?.({
                    result: {
                        taskId,
                        signature: signatures[0] ?? '',
                        signCount: signatures.length
                    }
                } as never, over)
            }
        } else {
            reply?.({
                result: {
                    taskId,
                    signature: signatures,
                    signCount: 1
                }
            } as never, over)
        }
        const signResponsePayload = { taskId, signatures }
        const tabId = originTabIdMapRef.current.get(taskId)
        if (tabId) {
            signResponsePayload.__tabId = tabId
            originTabIdMapRef.current.delete(taskId)
        }
        messager.send(signResponsePayload, SealxTopic.SIGN_RESPONSE, MessageChannel.INPAGE)
    }, [list])
    return <>
        {/* <button onClick={onTest}>Test</button> */}
        <div className="w-full h-full flex flex-col" data-tasks={JSON.stringify(tasks)}>
            <div className='w-full px-[26.25px] mt-[24px] flex items-center relative'>
                <button
                    type="button"
                    onClick={() => setShowPopupMenu(true)}
                    aria-label="Filter tasks"
                    className="mr-[8px] cursor-pointer bg-transparent border-none p-0"
                >
                    <FilterMenu aria-hidden="true" />
                </button>
                <span className='font-[500] leading-[25px] text-[21px]'>Total {total}</span>
                {showPopupMenu ? <PopupCategory category={category} onChange={(c: string) => {
                    setCategory(c)
                    setShowPopupMenu(false)
                }} ref={popupMenuRef} className=' py-[12px] absolute z-[999999] left-[12px] top-[30px] rounded-[8px]  w-[242px] bg-surface popup-menu'></PopupCategory> : ('')}
            </div>
            {total === 0 ? (
                <NoPendingTasks />
            ) : (
                map(tasks, (t, day) => {
                    return (<div className={'task-container w-full pt-[23px] '}>
                        <div className='w-full px-[24px]'>
                            <div className='w-full mb-[16px] text-center text-[19px] leading-[22px] font-[500] text-[rgba(0,0,0,0.40)]'>
                                {
                                    Number(day) === 0 ? 'Urgent' : `Within ${day} Days`
                                }
                            </div>
                            {
                                t.map((task) => {
                                    const taskProps = task as unknown as SignTaskRenderProps;
                                    return <SignTaskRender {...taskProps} onSign={onSign} onReview={onReview} setSigning={setSigning} signing={signing}></SignTaskRender>
                                })
                            }
                        </div>
                    </div>)
                })
            )}
        </div>
        <div id='template-factory' ref={templateFactory} className=' hidden'>
            <script id="initBoardTemplate" type="text/template">
                <div className='cmd-name w-full rounded-[12px] border border border-black/20 px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-text-secondary'><CheckBox className='mr-[11px]'></CheckBox>{'<%=command.label%>'}</div>
                    <div className='w-full mt-[16px] flex text-left font-[500] text-[24px] leading-[29px]'>
                        {'<%=command.value%>'}
                    </div>
                </div>
                <div className='cmd-expire-time mt-[24px] w-full rounded-[12px] border border border-black/20 px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-text-secondary'><Calendar className='mr-[11px]'></Calendar>{'<%=valid_until_time.label%>'}</div>
                    <div className='w-full mt-[16px] flex text-left font-[500] text-[24px] leading-[29px]'>
                        {'<%=valid_until_time.value%>'}
                    </div>
                </div>
                <div className='cmd-vault-id mt-[24px] w-full rounded-[12px] border border border-black/20 px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-text-secondary'><Vault className='mr-[11px]'></Vault>{'<%=vault_code.label%>'}</div>
                    <div className='w-full mt-[16px] break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px]'>
                        {'<%=vault_code.value%>'}
                    </div>
                </div>
                <div className='cmd-vault-guardians mt-[24px] w-full rounded-[12px] border border border-black/20 px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-text-secondary'>
                        <Guardians className='mr-[11px]'></Guardians>{'<%=guardians.label%>'}
                        <div className='flex-1 flex justify-end'>
                            <div className=' rounded-[18px] text-[19px] flex items-center bg-brand/[10%] text-brand pl-[17.88px] pt-[6px] pb-[5px] pr-[22px]  font-[500] leading-[26px]'>
                                <Protected className='mr-[7.88px]'></Protected>
                                <span>{'<%=threshold.label%>'}  {'<%=threshold.value%>'}</span>
                            </div>
                        </div>
                    </div>
                    <div className='w-full mt-[16px]'>
                        {'<%for (let i = 0; i < guardians.value.length; i++) {%>'}
                        <div className='guardian-member w-full flex items-center'>
                            <div className='w-[24px] h-[24px] rounded-full flex justify-center items-center bg-black/6 mr-[16px]'>{'<%=guardians.value[i].label%>'}</div>
                            <div className='flex-1 rounded-[8px] flex pl-[13.13px] pr-[10px] bg-black/6 py-[8px]'>
                                <Avatar1 className='mr-[12.75px]'></Avatar1>
                                <span className='text-[15px] font-[500] leading-[21px] text-[#000]'>{'<%=guardians.value[i].value%>'}</span>
                            </div>
                        </div>
                        {'<%}%>'}
                    </div>
                </div>
            </script>
            <div data-command="initAuthorizer" className='cmd-content-body w-full p-[24px]'>
                <div className='flex justify-between'>
                    <div className='cmd-name flex-1 mr-[24px] rounded-[12px] border border border-black/20 px-[24px] pt-[17px] pb-[16px]'>
                        <div className='title flex w-full items-center text-left font-[500] text-[19px] text-text-secondary'><CheckBox className='mr-[11px]'></CheckBox>{'<%command.label%>'}</div>
                        <div className='w-full mt-[16px] flex text-left font-[500] text-[24px] leading-[29px]'>
                            {'<%command.value%>'}
                        </div>
                    </div>
                    <div className='cmd-name flex-1 rounded-[12px] border border border-black/20 px-[24px] pt-[17px] pb-[16px]'>
                        <div className='title flex w-full items-center text-left font-[500] text-[19px] text-text-secondary'><AccountIcon className='mr-[11px]'></AccountIcon>{'<%account_group_code.label%>'}</div>
                        <div className='w-full mt-[16px] flex text-left font-[500] text-[24px] leading-[29px]'>
                            {'account_group_code.value'}
                        </div>
                    </div>
                </div>
                <div className='cmd-expire-time mt-[24px] w-full rounded-[12px] border border border-black/20 px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-text-secondary'><Calendar className='mr-[11px]'></Calendar>{'<%valid_until_time.label%>'}</div>
                    <div className='w-full mt-[16px] flex text-left font-[500] text-[24px] leading-[29px]'>
                        {'<%valid_until_time.value%>'}
                    </div>
                </div>
                <div className='cmd-vault-id mt-[24px] w-full rounded-[12px] border border border-black/20 px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-text-secondary'><Vault className='mr-[11px]'></Vault>{'<%vault_code.label%>'}</div>
                    <div className='w-full mt-[16px] break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px]'>
                        {'<%vault_code.value%>'}
                    </div>
                </div>
                <div className='cmd-vault-guardians mt-[24px] w-full rounded-[12px] border border border-black/20 px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-text-secondary'>
                        <Guardians className='mr-[11px]'></Guardians>{'<%guardians.label%>'}
                        <div className='flex-1 flex justify-end'>
                            <div className=' rounded-[18px] text-[19px] flex items-center bg-brand/[10%] text-brand pl-[17.88px] pt-[6px] pb-[5px] pr-[22px]  font-[500] leading-[26px]'>
                                <Protected className='mr-[7.88px]'></Protected>
                                <span>{'<%threshold.label%>'}  {'<%threshold.value%>'}</span>
                            </div>
                        </div>
                    </div>
                    <div className='w-full mt-[16px]'>
                        {'<%for (let i = 0; i < guardians.value.length; i++){%>'}
                        <div className='guardian-member w-full flex items-center'>
                            <div className='w-[24px] h-[24px] rounded-full flex justify-center items-center bg-black/6 mr-[16px]'>{'<%guardians.value[i].label%>'}</div>
                            <div className='flex-1 rounded-[8px] flex pl-[13.13px] pr-[10px] bg-black/6 py-[8px]'>
                                <Avatar1 className='mr-[12.75px]'></Avatar1>
                                <span className='text-[15px] font-[500] leading-[21px] text-[#000]'>{'<%guardians.value[i].value%>'}</span>
                            </div>
                        </div>
                        {'<%}%>'}
                    </div>
                </div>
            </div>
            <div data-command="transfer" className='cmd-content-body w-full p-[24px]'>
                <div className='flex justify-between'>
                    <div className='cmd-name flex-1 mr-[24px] rounded-[12px] border border border-black/20 px-[24px] pt-[17px] pb-[16px]'>
                        <div className='title flex w-full items-center text-left font-[500] text-[19px] text-text-secondary'><CheckBox className='mr-[11px]'></CheckBox>{'<%command.label%>'}</div>
                        <div className='w-full mt-[16px] flex text-left font-[500] text-[24px] leading-[29px]'>
                            {'<%command.value%>'}
                        </div>
                    </div>
                    <div className='cmd-name flex-1 rounded-[12px] border border border-black/20 px-[24px] pt-[17px] pb-[16px]'>
                        <div className='title flex w-full items-center text-left font-[500] text-[19px] text-text-secondary'><Link className='mr-[11px]'></Link>{'<%network.label%>'}</div>
                        <div className='w-full mt-[16px] flex text-left font-[500] text-[24px] leading-[29px]'>
                            {'<%network.value%>'}
                        </div>
                    </div>
                </div>
                <div className='cmd-expire-time mt-[24px] w-full rounded-[12px] border border border-black/20 px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-text-secondary'><Calendar className='mr-[11px]'></Calendar>{'<%valid_until_time.label%>'}</div>
                    <div className='w-full mt-[16px] flex text-left font-[500] text-[24px] leading-[29px]'>
                        {'<%valid_until_time.value%>'}
                    </div>
                </div>
                <div className='cmd-coin-type mt-[24px] w-full rounded-[12px] border border border-black/20 px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-text-secondary'><CoinIcon className='mr-[11px]'></CoinIcon>{'<%coin_type.label%>'}</div>
                    <div className='w-full mt-[16px] break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px]'>
                        {'<%coin_type.value%>'}
                    </div>
                </div>
                <div className='cmd-coin-type mt-[24px] w-full rounded-[12px] border border border-black/20 px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-text-secondary'><AddressCardIcon className='mr-[11px]'></AddressCardIcon>{'<%from_address.label%>'}</div>
                    <div className='w-full mt-[16px] break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px]'>
                        {'<%from_address.value%>'}
                    </div>
                </div>
                <div className='cmd-coin-type mt-[24px] w-full rounded-[12px] border border border-black/20 px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-text-secondary'><TagIcon className='mr-[11px]'></TagIcon>{'<%amount.label%>'}</div>
                    <div className='w-full mt-[16px] break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px]'>
                        {'<%amount.value%>'}
                    </div>
                </div>
                <div className='cmd-coin-type mt-[24px] w-full rounded-[12px] border border border-black/20 px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-text-secondary'><AddressCardIcon className='mr-[11px]'></AddressCardIcon>{'<%to_address.label%>'}</div>
                    <div className='w-full mt-[16px] break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px]'>
                        {'<%to_address.value%>'}
                    </div>
                </div>
            </div>
        </div>
        {signing && (
            <SigningOverlay
                timeout={signTimeout}
                progress={signProgress}
                onClose={() => {
                    setSigning(false)
                    setSignTimeout(false)
                    setSignProgress(0)
                    closeWindow()
                }}
            />
        )}
    </>
}

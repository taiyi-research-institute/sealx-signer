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
import { useSessionStore } from '@src/core/state';
import { useLocation } from 'react-router-dom'
import { useSealXNavigate } from '../../hooks/useSealXNavigate';
import { SIGN_OVERLAY_DISMISS_MS } from './constants';

const NoPendingTasks = () => {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center py-[3.75rem] px-[1.5rem]">
            <NoTasksIcon className="mb-[1.5rem]" />
            <div className="text-center">
                <div className="text-[1.25rem] leading-[1.35] font-[850] text-[var(--sx-text)] mb-[0.5rem]">
                    No Pending Tasks
                </div>
                <div className="text-[0.875rem] leading-[1.45] font-[650] text-[var(--sx-muted)]">
                    No pending tasks for sign-off or rejection at this time
                </div>
            </div>
        </div>
    )
}

const SigningOverlay = ({ timeout, progress, onClose }: { timeout: boolean; progress: number; onClose: () => void }) => {
    if (timeout) {
        return (
            <div className='fixed inset-0 bg-[#101820]/82 flex items-center justify-center z-50' role="alert" aria-busy="true" aria-live="polite">
                <div className="flex flex-col items-center rounded-[16px] bg-white px-6 py-5 shadow-[var(--sx-shadow-raised)]">
                    <div className="text-[var(--sx-danger)] text-[1rem] font-[800] mb-4">Signing Timeout</div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-[#101820] text-white rounded-[10px] text-[0.875rem] font-[800] cursor-pointer border-none"
                    >
                        Close
                    </button>
                </div>
            </div>
        )
    }
    return (
        <div className='fixed inset-0 bg-[#101820]/82 flex items-center justify-center z-50' role="alert" aria-busy="true" aria-live="polite">
            <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-[3px] border-white/30 border-t-white mb-4"></div>
                {progress >= 75 ? (
                    <div className="text-white/80 text-[0.875rem] font-[700] animate-pulse">Almost done...</div>
                ) : (
                        <div className="text-white text-[1rem] font-[800]">Signing...</div>
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
const extractTasks = (payload: unknown): SealxSignTask[] => {
    if (!payload) return [];
    const items = (payload instanceof Array ? payload : [payload]) as SealxSignTask[];
    return items.filter(task => Number(task.validUntilTime) > Date.now());
};
export const TaskHome = () => {
    const { request } = useRequestContext()
    const navigate = useSealXNavigate()
    const initialList = (request.topic === SealxTopic.SIGN || request.topic === SealxTopic.BATCH_SIGN)
        ? extractTasks(request.payload)
        : [];
    const [list, setList] = useState<Array<SealxSignTask>>(initialList)
    const templateFactory = useRef<HTMLDivElement>(null)
    const [signing, setSigning] = useState(false)
    const [signTimeout, setSignTimeout] = useState(false)
    const [signProgress, setSignProgress] = useState<number>(0)
    const replyRef = useRef<ReplyFunc>(null)
    const originTabIdMapRef = useRef<Map<string, number>>(new Map())
    const currentSigningTaskIdRef = useRef<string | null>(null)
    const signTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const clearTaskAndCloseIfDoneRef = useRef<((taskId: string) => void) | null>(null)
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
            const currentSession = useSessionStore.getState().session
            if (currentSession) messager.session = currentSession
            try {
                reply?.(state.result)
                messager.send(state.result, SealxTopic.SIGN_RESPONSE, MessageChannel.INPAGE)
            } catch {
                // Reply channel may already be closed; signing state fallback handles timeout.
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
            const items = extractTasks(request.payload)
            setList(items)
            replyRef.current = request.reply ?? null
            // Store tabId per taskId for later SIGN_RESPONSE routing
            if (request.header?.tabId) {
                items.forEach((task: SealxSignTask) => {
                    return originTabIdMapRef.current.set(task.taskId, request.header.tabId ?? 0)
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
                // Reply channel may already be closed.
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
        const signTimeout = signTimeoutRef.current
        const dismissTimeout = dismissTimeoutRef.current
        return () => {
            originTabIdMap.clear()
            if (signTimeout) {
                clearTimeout(signTimeout)
            }
            if (dismissTimeout) {
                clearTimeout(dismissTimeout)
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

    const clearTaskAndCloseIfDone = useCallback((taskId: string) => {
        setList(currentList => {
            const task = currentList.find(a => a.taskId === taskId)
            if (task?.preViewUrl && previewWindow) {
                chrome.windows.remove(previewWindow.id!).then(() => {
                    previewWindow = null
                })
            }

            const items = currentList.filter(a => a.taskId !== taskId)
            if (items.length === 0) {
                setTimeout(() => {
                    chrome.runtime.sendMessage({ type: 'panel-process-queue' })
                    closeWindow()
                }, 50)
            } else {
                chrome.runtime.sendMessage({ type: 'panel-process-queue' })
            }
            return items
        })
    }, [])
    clearTaskAndCloseIfDoneRef.current = clearTaskAndCloseIfDone

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
        const signResponsePayload: { taskId: string; signatures: string | { taskId: string; signature: string; }[] | null; __tabId?: number } = { taskId, signatures }
        const tabId = originTabIdMapRef.current.get(taskId)
        if (tabId) {
            signResponsePayload.__tabId = tabId
            originTabIdMapRef.current.delete(taskId)
        }
        messager.send(signResponsePayload, SealxTopic.SIGN_RESPONSE, MessageChannel.INPAGE)
        currentSigningTaskIdRef.current = null
        if (signTimeoutRef.current) {
            clearTimeout(signTimeoutRef.current)
            signTimeoutRef.current = null
        }
        // Delay overlay dismissal to ensure it's visible to user
        if (dismissTimeoutRef.current) {
            clearTimeout(dismissTimeoutRef.current)
        }
        dismissTimeoutRef.current = setTimeout(() => {
            dismissTimeoutRef.current = null
            setSigning(false)
            setSignTimeout(false)
            setSignProgress(0)
            clearTaskAndCloseIfDoneRef.current(taskId)
        }, SIGN_OVERLAY_DISMISS_MS)
    }, [list])
    return <>
        {/* <button onClick={onTest}>Test</button> */}
        <div className="sx-signing-list-page w-full h-full flex flex-col" data-tasks={JSON.stringify(tasks)}>
            {list.length === 0 ? (
                <NoPendingTasks />
            ) : (
                    map(tasks, (t: unknown[], day: string | number) => {
                        return (<div key={day} className='task-container sx-task-container'>
                            <div className='sx-task-list'>
                            {
                                    t.map((task: unknown) => {
                                    const taskProps = task as unknown as SignTaskRenderProps;
                                    return <SignTaskRender key={taskProps.taskId} {...taskProps} onSign={onSign} onReview={onReview} setSigning={setSigning} signing={signing} onSessionExpired={() => navigate('/login', { replace: true })}></SignTaskRender>
                                })
                            }
                        </div>
                    </div>)
                })
            )}
        </div>
        <div id='template-factory' ref={templateFactory} className=' hidden'>
            <script id="initBoardTemplate" type="text/template">
                <div className='cmd-name w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[#000]/60'><CheckBox className='mr-[0.6875rem]'></CheckBox>{'<%=command.label%>'}</div>
                    <div className='w-full mt-[1rem] flex text-left font-[500] text-[1.5rem] leading-[1.8125]'>
                        {'<%=command.value%>'}
                    </div>
                </div>
                <div className='cmd-expire-time mt-[1.5rem] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[#000]/60'><Calendar className='mr-[0.6875rem]'></Calendar>{'<%=valid_until_time.label%>'}</div>
                    <div className='w-full mt-[1rem] flex text-left font-[500] text-[1.5rem] leading-[1.8125]'>
                        {'<%=valid_until_time.value%>'}
                    </div>
                </div>
                <div className='cmd-vault-id mt-[1.5rem] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[#000]/60'><Vault className='mr-[0.6875rem]'></Vault>{'<%=vault_code.label%>'}</div>
                    <div className='w-full mt-[1rem] wrap-break-word hyphens-auto text-left font-[500] text-[1.5rem] leading-[1.8125]'>
                        {'<%=vault_code.value%>'}
                    </div>
                </div>
                <div className='cmd-vault-guardians mt-[1.5rem] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[#000]/60'>
                        <Guardians className='mr-[0.6875rem]'></Guardians>{'<%=guardians.label%>'}
                        <div className='flex-1 flex justify-end'>
                            <div className=' rounded-[18px] text-[1.1875rem] flex items-center bg-[#00BE78]/10 text-[#00BE78] pl-[1.1175rem] pt-[0.375rem] pb-[0.3125rem] pr-[1.375rem]  font-[500] leading-[1.625]'>
                                <Protected className='mr-[0.4925rem]'></Protected>
                                <span>{'<%=threshold.label%>'}  {'<%=threshold.value%>'}</span>
                            </div>
                        </div>
                    </div>
                    <div className='w-full mt-[1rem]'>
                        {'<%for (let i = 0; i < guardians.value.length; i++) {%>'}
                        <div className='guardian-member w-full flex items-center'>
                            <div className='w-[24px] h-[24px] rounded-full flex justify-center items-center bg-[rgba(0,0,0,0.06)] mr-[1rem]'>{'<%=guardians.value[i].label%>'}</div>
                            <div className='flex-1 rounded-[8px] flex pl-[0.8206rem] pr-[0.625rem] bg-[rgba(0,0,0,0.06)] py-[0.5rem]'>
                                <Avatar1 className='mr-[0.7969rem]'></Avatar1>
                                <span className='text-[0.9375rem] font-[500] leading-[1.3125] text-[#000]'>{'<%=guardians.value[i].value%>'}</span>
                            </div>
                        </div>
                        {'<%}%>'}
                    </div>
                </div>
            </script>
            <div data-command="initAuthorizer" className='cmd-content-body w-full p-[1.5rem]'>
                <div className='flex justify-between'>
                    <div className='cmd-name flex-1 mr-[1.5rem] rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
                        <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[#000]/60'><CheckBox className='mr-[0.6875rem]'></CheckBox>{'<%command.label%>'}</div>
                        <div className='w-full mt-[1rem] flex text-left font-[500] text-[1.5rem] leading-[1.8125]'>
                            {'<%command.value%>'}
                        </div>
                    </div>
                    <div className='cmd-name flex-1 rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
                        <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[#000]/60'><AccountIcon className='mr-[0.6875rem]'></AccountIcon>{'<%account_group_code.label%>'}</div>
                        <div className='w-full mt-[1rem] flex text-left font-[500] text-[1.5rem] leading-[1.8125]'>
                            {'account_group_code.value'}
                        </div>
                    </div>
                </div>
                <div className='cmd-expire-time mt-[1.5rem] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[#000]/60'><Calendar className='mr-[0.6875rem]'></Calendar>{'<%valid_until_time.label%>'}</div>
                    <div className='w-full mt-[1rem] flex text-left font-[500] text-[1.5rem] leading-[1.8125]'>
                        {'<%valid_until_time.value%>'}
                    </div>
                </div>
                <div className='cmd-vault-id mt-[1.5rem] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[#000]/60'><Vault className='mr-[0.6875rem]'></Vault>{'<%vault_code.label%>'}</div>
                    <div className='w-full mt-[1rem] wrap-break-word hyphens-auto text-left font-[500] text-[1.5rem] leading-[1.8125]'>
                        {'<%vault_code.value%>'}
                    </div>
                </div>
                <div className='cmd-vault-guardians mt-[1.5rem] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[#000]/60'>
                        <Guardians className='mr-[0.6875rem]'></Guardians>{'<%guardians.label%>'}
                        <div className='flex-1 flex justify-end'>
                            <div className=' rounded-[18px] text-[1.1875rem] flex items-center bg-[#00BE78]/10 text-[#00BE78] pl-[1.1175rem] pt-[0.375rem] pb-[0.3125rem] pr-[1.375rem]  font-[500] leading-[1.625]'>
                                <Protected className='mr-[0.4925rem]'></Protected>
                                <span>{'<%threshold.label%>'}  {'<%threshold.value%>'}</span>
                            </div>
                        </div>
                    </div>
                    <div className='w-full mt-[1rem]'>
                        {'<%for (let i = 0; i < guardians.value.length; i++){%>'}
                        <div className='guardian-member w-full flex items-center'>
                            <div className='w-[24px] h-[24px] rounded-full flex justify-center items-center bg-[rgba(0,0,0,0.06)] mr-[1rem]'>{'<%guardians.value[i].label%>'}</div>
                            <div className='flex-1 rounded-[8px] flex pl-[0.8206rem] pr-[0.625rem] bg-[rgba(0,0,0,0.06)] py-[0.5rem]'>
                                <Avatar1 className='mr-[0.7969rem]'></Avatar1>
                                <span className='text-[0.9375rem] font-[500] leading-[1.3125] text-[#000]'>{'<%guardians.value[i].value%>'}</span>
                            </div>
                        </div>
                        {'<%}%>'}
                    </div>
                </div>
            </div>
            <div data-command="transfer" className='cmd-content-body w-full p-[1.5rem]'>
                <div className='flex justify-between'>
                    <div className='cmd-name flex-1 mr-[1.5rem] rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
                        <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[#000]/60'><CheckBox className='mr-[0.6875rem]'></CheckBox>{'<%command.label%>'}</div>
                        <div className='w-full mt-[1rem] flex text-left font-[500] text-[1.5rem] leading-[1.8125]'>
                            {'<%command.value%>'}
                        </div>
                    </div>
                    <div className='cmd-name flex-1 rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
                        <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[#000]/60'><Link className='mr-[0.6875rem]'></Link>{'<%network.label%>'}</div>
                        <div className='w-full mt-[1rem] flex text-left font-[500] text-[1.5rem] leading-[1.8125]'>
                            {'<%network.value%>'}
                        </div>
                    </div>
                </div>
                <div className='cmd-expire-time mt-[1.5rem] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[#000]/60'><Calendar className='mr-[0.6875rem]'></Calendar>指令有效时间</div>
                    <div className='w-full mt-[1rem] flex text-left font-[500] text-[1.5rem] leading-[1.8125]'>
                        2025-06-20 10:02:30 UTC+8.5
                    </div>
                </div>
                <div className='cmd-coin-type mt-[1.5rem] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[#000]/60'><CoinIcon className='mr-[0.6875rem]'></CoinIcon>币种</div>
                    <div className='w-full mt-[1rem] wrap-break-word hyphens-auto text-left font-[500] text-[1.5rem] leading-[1.8125]'>
                        0xe09c3f6dfbb9ce994eafa9e84327dd52b06eb09aadc824e36d325d4f87cc5b82::remi::REMI
                    </div>
                </div>
                <div className='cmd-coin-type mt-[1.5rem] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[#000]/60'><AddressCardIcon className='mr-[0.6875rem]'></AddressCardIcon>源地址</div>
                    <div className='w-full mt-[1rem] wrap-break-word hyphens-auto text-left font-[500] text-[1.5rem] leading-[1.8125]'>
                        304b7de5-19eb-475c-a653-b60b09aa8bd2
                    </div>
                </div>
                <div className='cmd-coin-type mt-[1.5rem] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[#000]/60'><TagIcon className='mr-[0.6875rem]'></TagIcon>数额</div>
                    <div className='w-full mt-[1rem] wrap-break-word hyphens-auto text-left font-[500] text-[1.5rem] leading-[1.8125]'>
                        100,000
                    </div>
                </div>
                <div className='cmd-coin-type mt-[1.5rem] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[1.5rem] pt-[1.0625rem] pb-[1rem]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[1.1875rem] text-[#000]/60'><AddressCardIcon className='mr-[0.6875rem]'></AddressCardIcon>目标地址</div>
                    <div className='w-full mt-[1rem] wrap-break-word hyphens-auto text-left font-[500] text-[1.5rem] leading-[1.8125]'>
                        304b7de5-19eb-475c-a653-b60b09aa8bd2
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

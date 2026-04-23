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

const TypingAnimation = () => {
    const [displayText, setDisplayText] = useState('')
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isDeleting, setIsDeleting] = useState(false)
    const text = 'Waiting ...'

    useEffect(() => {
        const timer = setTimeout(() => {
            if (!isDeleting) {
                if (currentIndex < text.length) {
                    setDisplayText(text.substring(0, currentIndex + 1))
                    setCurrentIndex(currentIndex + 1)
                } else {
                    setTimeout(() => setIsDeleting(true), 1000)
                }
            } else {
                if (currentIndex > 0) {
                    setDisplayText(text.substring(0, currentIndex - 1))
                    setCurrentIndex(currentIndex - 1)
                } else {
                    setIsDeleting(false)
                }
            }
        }, isDeleting ? 50 : 150)

        return () => clearTimeout(timer)
    }, [currentIndex, isDeleting, text])

    return (
        <div className="text-[#fff] text-[32px]  font-[500]">
            {displayText}
            {/* <span className="animate-pulse">|</span> */}
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
    const replyRef = useRef<ReplyFunc>(null)
    const { state } = useLocation() as {
        state: {
            result: {
                taskId: string, signatures: string[],
                signCount: number
            }
        }
    };
    useEffect(() => {
        if (!signing && (request.topic === SealxTopic.SIGN || request.topic === SealxTopic.BATCH_SIGN) && state && state.result && state.result.taskId && state.result.signatures.length > 0 && state.result.signCount > 0) {
            setSigning(true)
            const reply = replyRef.current ? replyRef.current : request.reply
            try {
                reply?.(state)
            messager.send(state.result, SealxTopic.SIGN_RESPONSE, MessageChannel.INPAGE)
            } catch (e) {
                console.debug(e, '--------------- 00000 ---------')
            }
        }
    }, [
        state,
        request,
        signing
    ])
    useEffect(() => {
        if (request.topic === SealxTopic.BATCH_SIGN || request.topic === SealxTopic.SIGN) {
            const items = ((request.payload instanceof Array ? request.payload : [request.payload]) as SealxSignTask[]).filter((task) => {
                return Number(task.validUntilTime) > Date.now()
            })
            setTotal(items.length)
            setList(items)
            replyRef.current = request.reply ?? null
            TabManager.getInstance().updateActiveTab(request.header.tabId)
        }
    }, [request])

    useEffect(() => {
        if (request.topic === SealxTopic.SIGN_RESPONSE) {
            setSigning(false)
            const payload = request.payload as { taskId: string, error: string }
            if (payload.error) {
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
                        // Use message to close window through background script
                        // messager.send(null, SealxTopic.CLOSE, MessageChannel.BACKGROUND)
                        closeWindow()
                    }, 50)
                }
                return items
            })
            try {
                request.reply?.(request.payload as never)
            } catch (e) {
                console.debug(e, '----------- 11111 ------------')
            }

        }
    }, [request])

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
        console.log('Tasks:', tasks)
        return tasks
    }, [list])
    const onSign = useCallback(async (taskId: string, signatures: { taskId: string, signature: string }[] | string | null) => {
        // setSigning(true)
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
        messager.send({ taskId, signatures }, SealxTopic.SIGN_RESPONSE, MessageChannel.INPAGE)
        // setSigning(false)
        // closeWindow()
    }, [list])
    return <>
        {/* <button onClick={onTest}>Test</button> */}
        <div className="w-full h-full flex flex-col" data-tasks={JSON.stringify(tasks)}>
            <div className='w-full px-[26.25px] mt-[24px] flex items-center relative'>
                <FilterMenu onClick={() => {
                    setShowPopupMenu(true)
                }} className='mr-[8px]'></FilterMenu>
                <span className='font-[500] leading-[25px] text-[21px]'>Total {total}</span>
                {/* <div className='flex-1 flex justify-end'>
                    <Switch className=" w-[160px] text-[19px] leading-[22px] font-[500]  rounded-[20px] bg-[rgba(22,38,48,0.04)]" items={['Date', 'Expiry']} selected={switchSelected} onChange={setSwitchSelected}></Switch>
                </div> */}
                {showPopupMenu ? <PopupCategory category={category} onChange={(c: string) => {
                    setCategory(c)
                    setShowPopupMenu(false)
                }} ref={popupMenuRef} className=' py-[12px] absolute z-[999999] let-[12px] top-[30px] rounded-[8px]  w-[242px] bg-[#fff] popup-menu'></PopupCategory> : ('')}
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
                <div className='cmd-name w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'><CheckBox className='mr-[11px]'></CheckBox>{'<%=command.label%>'}</div>
                    <div className='w-full mt-[16px] flex text-left font-[500] text-[24px] leading-[29px]'>
                        {'<%=command.value%>'}
                    </div>
                </div>
                <div className='cmd-expire-time mt-[24px] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'><Calendar className='mr-[11px]'></Calendar>{'<%=valid_until_time.label%>'}</div>
                    <div className='w-full mt-[16px] flex text-left font-[500] text-[24px] leading-[29px]'>
                        {'<%=valid_until_time.value%>'}
                    </div>
                </div>
                <div className='cmd-vault-id mt-[24px] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'><Vault className='mr-[11px]'></Vault>{'<%=vault_code.label%>'}</div>
                    <div className='w-full mt-[16px] break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px]'>
                        {'<%=vault_code.value%>'}
                    </div>
                </div>
                <div className='cmd-vault-guardians mt-[24px] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'>
                        <Guardians className='mr-[11px]'></Guardians>{'<%=guardians.label%>'}
                        <div className='flex-1 flex justify-end'>
                            <div className=' rounded-[18px] text-[19px] flex items-center bg-[#00BE78]/[10%] text-[#00BE78] pl-[17.88px] pt-[6px] pb-[5px] pr-[22px]  font-[500] leading-[26px]'>
                                <Protected className='mr-[7.88px]'></Protected>
                                <span>{'<%=threshold.label%>'}  {'<%=threshold.value%>'}</span>
                            </div>
                        </div>
                    </div>
                    <div className='w-full mt-[16px]'>
                        {'<%for (let i = 0; i < guardians.value.length; i++) {%>'}
                        <div className='guardian-member w-full flex items-center'>
                            <div className='w-[24px] h-[24px] rounded-full flex justify-center items-center bg-[rgba(0,0,0,0.06)] mr-[16px]'>{'<%=guardians.value[i].label%>'}</div>
                            <div className='flex-1 rounded-[8px] flex pl-[13.13px] pr-[10px] bg-[rgba(0,0,0,0.06)] py-[8px]'>
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
                    <div className='cmd-name flex-1 mr-[24px] rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                        <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'><CheckBox className='mr-[11px]'></CheckBox>{'<%command.label%>'}</div>
                        <div className='w-full mt-[16px] flex text-left font-[500] text-[24px] leading-[29px]'>
                            {'<%command.value%>'}
                        </div>
                    </div>
                    <div className='cmd-name flex-1 rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                        <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'><AccountIcon className='mr-[11px]'></AccountIcon>{'<%account_group_code.label%>'}</div>
                        <div className='w-full mt-[16px] flex text-left font-[500] text-[24px] leading-[29px]'>
                            {'account_group_code.value'}
                        </div>
                    </div>
                </div>
                <div className='cmd-expire-time mt-[24px] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'><Calendar className='mr-[11px]'></Calendar>{'<%valid_until_time.label%>'}</div>
                    <div className='w-full mt-[16px] flex text-left font-[500] text-[24px] leading-[29px]'>
                        {'<%valid_until_time.value%>'}
                    </div>
                </div>
                <div className='cmd-vault-id mt-[24px] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'><Vault className='mr-[11px]'></Vault>{'<%vault_code.label%>'}</div>
                    <div className='w-full mt-[16px] break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px]'>
                        {'<%vault_code.value%>'}
                    </div>
                </div>
                <div className='cmd-vault-guardians mt-[24px] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'>
                        <Guardians className='mr-[11px]'></Guardians>{'<%guardians.label%>'}
                        <div className='flex-1 flex justify-end'>
                            <div className=' rounded-[18px] text-[19px] flex items-center bg-[#00BE78]/[10%] text-[#00BE78] pl-[17.88px] pt-[6px] pb-[5px] pr-[22px]  font-[500] leading-[26px]'>
                                <Protected className='mr-[7.88px]'></Protected>
                                <span>{'<%threshold.label%>'}  {'<%threshold.value%>'}</span>
                            </div>
                        </div>
                    </div>
                    <div className='w-full mt-[16px]'>
                        {'<%for (let i = 0; i < guardians.value.length; i++){%>'}
                        <div className='guardian-member w-full flex items-center'>
                            <div className='w-[24px] h-[24px] rounded-full flex justify-center items-center bg-[rgba(0,0,0,0.06)] mr-[16px]'>{'<%guardians.value[i].label%>'}</div>
                            <div className='flex-1 rounded-[8px] flex pl-[13.13px] pr-[10px] bg-[rgba(0,0,0,0.06)] py-[8px]'>
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
                    <div className='cmd-name flex-1 mr-[24px] rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                        <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'><CheckBox className='mr-[11px]'></CheckBox>{'<%command.label%>'}</div>
                        <div className='w-full mt-[16px] flex text-left font-[500] text-[24px] leading-[29px]'>
                            {'<%command.value%>'}
                        </div>
                    </div>
                    <div className='cmd-name flex-1 rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                        <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'><Link className='mr-[11px]'></Link>{'<%network.label%>'}</div>
                        <div className='w-full mt-[16px] flex text-left font-[500] text-[24px] leading-[29px]'>
                            {'<%network.value%>'}
                        </div>
                    </div>
                </div>
                <div className='cmd-expire-time mt-[24px] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'><Calendar className='mr-[11px]'></Calendar>指令有效时间</div>
                    <div className='w-full mt-[16px] flex text-left font-[500] text-[24px] leading-[29px]'>
                        2025-06-20 10:02:30 UTC+8.5
                    </div>
                </div>
                <div className='cmd-coin-type mt-[24px] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'><CoinIcon className='mr-[11px]'></CoinIcon>币种</div>
                    <div className='w-full mt-[16px] break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px]'>
                        0xe09c3f6dfbb9ce994eafa9e84327dd52b06eb09aadc824e36d325d4f87cc5b82::remi::REMI
                    </div>
                </div>
                <div className='cmd-coin-type mt-[24px] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'><AddressCardIcon className='mr-[11px]'></AddressCardIcon>源地址</div>
                    <div className='w-full mt-[16px] break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px]'>
                        304b7de5-19eb-475c-a653-b60b09aa8bd2
                    </div>
                </div>
                <div className='cmd-coin-type mt-[24px] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'><TagIcon className='mr-[11px]'></TagIcon>数额</div>
                    <div className='w-full mt-[16px] break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px]'>
                        100,000
                    </div>
                </div>
                <div className='cmd-coin-type mt-[24px] w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'><AddressCardIcon className='mr-[11px]'></AddressCardIcon>目标地址</div>
                    <div className='w-full mt-[16px] break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px]'>
                        304b7de5-19eb-475c-a653-b60b09aa8bd2
                    </div>
                </div>
            </div>
        </div>
        {signing && (<div className='w-full h-full bg-[#000]/[70%] absolute left-0 top-0 flex items-center justify-center'>
            <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                <TypingAnimation />
            </div>
        </div>)}
    </>
}

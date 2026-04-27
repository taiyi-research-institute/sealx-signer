import DOMPurify from 'dompurify';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState, memo } from 'react';
import {
    convertToISOFormat,
    TabManager,
    type SignContent,
    type SignLayoutContext,
    type SignLayoutRender,
} from 'sealx-core';
import Clock from '@assets/svg/clock.svg?react';
import { useRequestContext } from '@src/hooks/useRequestContextHook';
import initBoardTemplate from './initBoardTemplate.js';
import initAuthorizerTemplate from './initAuthorizerTemplate.js';
import { sign } from '@src/core/background';
import Vault from '@assets/svg/vault.svg?react';
import CheckBox from '@assets/svg/check-board.svg?react';
import Calendar from '@assets/svg/calendar.svg?react';
import { SealxTopic } from 'sealx-message';
import type { SealxRequest } from 'sealx-message';
import { useNavigate } from 'react-router-dom';
import { useGlobalContext } from '@src/hooks/useGlobalContext.js';
import Button from '@src/components/button';
import { useSessionStore } from '@src/core/state/index.js';
import { generateDataKey } from '@src/core/utils/dataKey';
import { handleLocateElement } from '@src/core/utils/locateElement';
// import moment from 'moment';

/**
 * Props for rendering a sign task in the UI.
 *
 * @remarks
 * This interface extends standard HTML div attributes, except for `onSubmit`.
 *
 * @property signContent - The sign content to be rendered. Can be a single item or an array.
 * @property preViewUrl - (Optional) URL for a third-party provided task preview page.
 * @property command - The command type being signed.
 * @property extenals - (Optional) Additional external data or context for the task, provided as a key-value map.
 * @property taskId - Unique identifier for the task.
 * @property taskType - Type of the task.
 * @property signing - Whether the component is currently in signing state
 * @property setSigning - (Optional) Callback to set the signing state
 * @property validUntilTime - Timestamp (in milliseconds) when the task expires.
 * @property onSign - Callback invoked when signing is performed, with the task ID and signatures.
 */
export interface SignTaskRenderProps
    extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSubmit'> {
    /** The sign content to be rendered */
    signContent: SignContent | { taskId: string, signContent: SignContent }[];
    /** Optional: Third-party provided task preview page */
    preViewUrl?: string;
    /** The command type being signed */
    command: string;
    /**(Optional) Additional external data or context for the task, provided as a key-value map. */
    extenals?: Record<string, unknown>
    /** Unique task identifier */
    taskId: string;
    confirmText?: string
    cencelText?: string
    /** Type of task */
    taskType: string;
    signing: boolean
    onReview?: (url: string) => Promise<void>
    setSigning?: (signing: boolean) => void
    /** Timestamp when the task expires */
    validUntilTime: number;
    onSign: (taskId: string, signatures: string | { taskId: string, signature: string }[] | null) => void;
}

/**
 * Props for DefaultTemplateRender component
 * Extends SignTaskRenderProps with additional context
 */
export interface DefaultTemplateRenderProps extends SignTaskRenderProps {
    /** Layout context for rendering */
    context: SignLayoutContext | null;
}

const templates: Record<string, string> = {
    initBoard: initBoardTemplate,
    initAuthorizer: initAuthorizerTemplate,
};

/**
 * Renders content using the default template from template factory
 * @param props Component props
 * @returns Rendered template or empty fragment if no template found
 */
export const DefaultTemplateRender = memo(({
    context,
    ...props
}: DefaultTemplateRenderProps) => {
    const [safeHtml, setSafeHtml] = useState<string>('');
    const { sendToIframe } = useGlobalContext()

    // 从 keysMapStr 解析出完整的 key 映射（用于元素定位）
    const keyMap = useMemo(() => {
        if (props.signContent instanceof Array) return null;
        const layout = props.signContent.layout;
        if (!layout?.keysMapStr) return null;
        try {
            return JSON.parse(layout.keysMapStr);
        } catch {
            return null;
        }
    }, [props.signContent]);

    const onRendered = useCallback(
        async () => {
            const { type, output, error } = await sendToIframe({
                type: 'render',
                context: JSON.parse(JSON.stringify(context)),
                template: templates[props.command] ?? '',
            });
            if (type === 'rendered') {
                setSafeHtml(output);
                // 可以在这里更新 UI 或执行后续逻辑
            }
            if (type === 'error') {
                console.error('渲染失败:', error);
            }
        },
        [context, props.command, sendToIframe]
    );
    useEffect(() => {
        if (context && templates[props.command]) onRendered()
    }, [context, onRendered, props.command]);
    if (context && templates[props.command]) {
        // Sanitize and render the template with context
        return <div dangerouslySetInnerHTML={{ __html: safeHtml }}></div>;
    }
    if (props.signContent instanceof Array) {
        return '';
    }
    const messages = props.signContent.message;
    const keys = Object.keys(messages);
    return keys.map((key) => {
        // 从 keysMapStr 映射获取顶层 originKey
        const mapping = keyMap?.[key];
        const originKey = mapping?.originKey || key;
        console.log('Origin Key:', originKey, key, mapping, keyMap);
        return (
            <div className='w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px] mt-[24px]'>
                <OrigionMessageRender
                    origionKey={originKey}
                    displayKey={key}
                    keyMap={keyMap}
                    context={context}
                    parentKeys={[]}
                    value={messages[key]}></OrigionMessageRender>
            </div>
        );
    });
});

export const OrigionMessageRender = memo(({
    origionKey,
    displayKey,
    keyMap,
    value,
    context,
    parentKeys = [] }: {
    origionKey: string;
        displayKey?: string;
        keyMap?: Record<string, any>;
    context?: SignLayoutContext | null
    value: unknown;
        parentKeys?: string[];
        displayKeyPath?: string[];
}) => {
    // displayKey 是来自 message 的 key（如 "Fund Control", "#1", "Guardians"）
    // keyMap 包含 originKey 和 originType 映射
    // 参考 buildSignRenderContext: 用 message 的 key 去 keyMap 中查找
    const keyForDisplay = displayKey || origionKey;

    // 从 keyMap 查找当前 key 对应的 mapping
    const currentMapping = keyMap?.[keyForDisplay];
    // 如果没找到，尝试匹配 # 开头的键（如 #1）
    const finalMapping = currentMapping || (keyForDisplay.startsWith('#') ? keyMap : undefined);

    const originKey = finalMapping?.originKey || keyForDisplay;

    // 处理叶子节点值的显示
    const displayValue = (val: unknown): string => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    };

    // 根据 value 的类型来决定渲染方式（不修改这部分）
    if (Array.isArray(value)) {
        // 数组类型：遍历数组
        // 参考 buildSignRenderContext: 数组元素的 children 在 children[数组key] 中
        const arrayChildrenMap = finalMapping?.children;
        return (
            <>
                <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'>
                    {keyForDisplay}
                </div>
                <div className='w-full mt-[16px] flex flex-col text-left font-[500] text-[24px] leading-[29px] gap-y-[8px]'>
                    {value.map((item, index) => {
                        const itemKey = `#${index + 1}`;
                        // 使用 originKey + 下标作为 data-key
                        //const itemDataKey = `${originKey}.${itemKey}`;
                        // 获取数组元素对应的 children
                        const itemChildrenMap = arrayChildrenMap?.[itemKey];
                        // 如果数组元素是对象，需要将 childrenMap 合并，让它能通过属性名查找
                        // itemChildrenMap 包含 "Coin ID", "Fund Control Rules" 等属性
                        return (
                            <div
                                key={index}
                                className='flex flex-col gap-y-[8px]'
                            >
                                <OrigionMessageRender
                                    origionKey={itemKey}
                                    displayKey={itemKey}
                                    keyMap={itemChildrenMap || arrayChildrenMap}
                                    context={context}
                                    parentKeys={[...parentKeys, originKey]}
                                    value={item}
                                />
                            </div>
                        );
                    })}
                </div>
            </>
        );
    }

    if (value && typeof value === 'object') {
    // 对象类型：遍历对象属性
        const recordValue = value as Record<string, unknown>;
        const keys = Object.keys(recordValue);
        const childrenMap = finalMapping?.children;
        return (
            <>
                <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'>
                    {keyForDisplay}
                </div>
                <div className='w-full border-t border-[rgba(0,0,0,0.2)]'></div>
                <div className='w-full pl-[12px] mt-[16px] flex flex-col text-left font-[500] text-[24px] leading-[29px]'>
                    {keys.map((key1) => {
                        return (
                            <div className='w-full pt-[20px]'>
                                <OrigionMessageRender
                                    origionKey={key1}
                                    displayKey={key1}
                                    keyMap={childrenMap}
                                    context={context}
                                    parentKeys={[...parentKeys, originKey]}
                                    value={recordValue[key1]}
                                />
                            </div>
                        );
                    })}
                </div>
            </>
        );
    }

    // 默认：叶子节点（简单值）
    // 使用累积的 parentKeys + originKey 生成完整路径
    const fullDataKey = [...parentKeys, originKey].filter(Boolean).join('.');
    return (
        <>
            <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'>
                {keyForDisplay}
            </div>
            <div
                className='w-full mt-[16px] flex text-left break-all font-[500] text-[24px] leading-[29px] cursor-pointer hover:text-[#007AFF]'
                data-key={fullDataKey}
                title='点击定位到业务系统中的对应数据'
                onClick={handleLocateElement}
            >
                {displayValue(value)}
            </div>
        </>
    );
});

/**
 * Props for OutsideTemplateRender component
 */
export interface OutsideTemplateRenderProps
    extends React.HTMLAttributes<HTMLDivElement> {
    /** HTML string to render */
    render: string;
}

/**
 * Renders content from an external template source
 * @param props Component props
 * @returns Sanitized rendered content
 */
export const OutsideTemplateRender = memo(({
    render,
    ...props
}: OutsideTemplateRenderProps) => {
    const safeHtml = DOMPurify.sanitize(render);
    return (
        <div
            {...props}
            dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
    );
});

const onRejected = (props: SignTaskRenderProps) => {
    props.onSign(props.taskId, '');
};
/**
 * Handles the signing operation when user clicks "Sign to Approve"
 * - Logs the signing content and task ID for debugging
 * - Sends the signed response back through the request channel
 * - Currently uses a placeholder signature that should be replaced with actual signing logic
 */
const onApproval = async (props: SignTaskRenderProps, request: SealxRequest) => {
    if (!request.header.userId || props.signing) {
        return;
    }
    props.setSigning?.(true)
    try {
        //console.log('-------- request tab --------', TabManager.getInstance().currentTab, request.header)
        const signatures = [] as { taskId: string, signature: string }[];
        if (props.signContent instanceof Array) {
            for (const signContent of props.signContent) {
                const res = await sign(
                    request.header.userId,
                    request.header.host,
                    signContent.signContent
                ) as { signature: string } | null;
                if (res) signatures.push({
                    taskId: signContent.taskId,
                    signature: res.signature
                })
            }
            props.onSign(props.taskId, signatures);
            return {
                signatures,
                taskId: props.taskId
            }
        } else {
            const res = await sign(
                request.header.userId,
                request.header.host,
                props.signContent
            ) as { signature: string } | null;
            if (res) {
                props.onSign(props.taskId, res.signature);
                return {
                    signatures,
                    taskId: props.taskId
                }
            }
        }
    } finally {
        props.setSigning?.(false)
    }
};

/**
 * Main component for rendering sign tasks
 * @param props Component props
 * @returns Rendered sign task UI
 */
export const SignTaskRender = memo((props: SignTaskRenderProps) => {
    const navigate = useNavigate();
    const { sendToIframe } = useGlobalContext()
    //console.log('SignTaskRender props:', props);
    /**
     * Parses the raw sign content into a renderable format
     * - Uses memoization to avoid unnecessary re-parsing
     * - Only updates when signContent prop changes
     */
    const [layoutRender, setLayoutRender] = useState<SignLayoutRender>({
        render: '',
        context: null,
        signData: {
            types: {},
            primaryType: '',
            domain: {
                name: '',
                version: '',
                chainId: 0,
                verifyingContract: '',
                salt: '',
            },
            message: {},
        },
    });

    // Tracks remaining time until task expiration in formatted string (HH:MM:SS or Dd:Hh:Mm)
    const [validTime, setValidTime] = useState('00:00:00');

    const { request } = useRequestContext();
    const parseSignContent = useCallback(async () => {
        if (props.signContent instanceof Array) {
            return
        }
        const { type, output, error } = await sendToIframe({
            type: 'parseContent',
            signContent: JSON.parse(JSON.stringify(props.signContent)),
        });
        if (type === 'contentParsed') {
            setLayoutRender(output);
            console.log('--------- parsed context ----', output)
        }

        if (type === 'error') {
            console.error('渲染失败:', error);
        }
    }, [props.signContent, sendToIframe])
    useEffect(() => {
        if (layoutRender.context) setLayoutRender({
            ...layoutRender,
            context: null
        })
    }, [layoutRender, props.signContent])
    useEffect(() => {
        // layoutRender.context=null
        parseSignContent()
    }, [parseSignContent]);

    useEffect(() => {
        /**
         * Updates the remaining time display
         */
        const updateTime = () => {
            let remainingMs = props.validUntilTime - Date.now();

            if (remainingMs <= 0) {
                setValidTime('00:00:00');
                return;
            }

            // Break down into time units
            const days = Math.floor(remainingMs / (24 * 3600 * 1000));
            remainingMs %= 24 * 3600 * 1000;
            const hours = Math.floor(remainingMs / (3600 * 1000));
            remainingMs %= 3600 * 1000;
            const minutes = Math.floor(remainingMs / 60000);
            remainingMs %= 60000;
            const seconds = Math.floor(remainingMs / 1000);

            const format = (num: number) => num.toString().padStart(2, '0');

            // Format differently based on days remaining
            setValidTime(
                days > 0
                    ? `${days}d:${format(hours)}h:${format(minutes)}m`
                    : `${format(hours)}h:${format(minutes)}m:${format(
                        seconds
                    )}s`
            );
        };
        // Only setup timer if not expired
        if (props.validUntilTime > Date.now()) {
            updateTime(); // Initial update
            const interval = setInterval(updateTime, 1000);
            return () => clearInterval(interval);
        }
    }, [props.validUntilTime]);

    const primaryType = useMemo(() => {
        if (props.signContent instanceof Array) {
            return (props.extenals?.['command'] ?? 'Set Treasy Unit') as string;
        } else {
            return props.signContent.primaryType;
        }
    }, [props.signContent, props.extenals]);
    const session = useSessionStore.use.session()
    useEffect(() => {
        if (request.topic === SealxTopic.REMOTE_SIGN) {
            // Other window post sign task
            const payload = request.payload as { taskId: string, rejected?: boolean }
            if (payload.taskId === props.taskId) {
                if (payload.rejected) {
                    props.onSign(props.taskId, '');
                } else {
                    const req = {
                        ...request
                    }
                    if (!req.header.userId) {
                        req.header.userId = session?.userId
                        req.header.sessionId = session?.sessionId ?? ''
                    }
                    onApproval(props, req)
                }
            }
        }
    }, [request, props, session?.userId, session?.sessionId]); // Removed onApproval and onRejected from dependencies

    const onReview = useCallback(() => {
        // If task has subtasks (array of signContent), navigate to detail page
        if (props.signContent instanceof Array && props.signContent.length > 0) {
            navigate('/task-detail', {
                state: {
                    mainTaskId: props.taskId,
                    taskType: props.taskType,
                    command: props.command,
                    validUntilTime: props.validUntilTime,
                    subTasks: props.signContent,
                    preViewUrl: props.preViewUrl,
                    extenals: props.extenals,
                },
            });
        } else if (props.preViewUrl && props.onReview) {
            // Otherwise use the original preview URL behavior
            props.onReview(props.preViewUrl);
        }
    }, [props, navigate])

    // const session = useSessionStore.use.session()

    return (
        <div {...props}>
            <div className='cmd-info-container w-full rounded-[20px] bg-[#fff]'>
                <div className='cmd-title-wrapper flex text-left  w-full rounded-t-[20px] bg-[50px] text-[#fff] bg-[#000] px-[24px] pt-[22px] pb-[20px]'>
                    <span className='font-[500] text-[26px] leading-[32px]'>
                        {primaryType}
                    </span>
                    <div className='flex-1 flex justify-end items-end'>
                        <Clock className='mr-[17.87px] '></Clock>
                        <span className=' font-[500] leading-[29px] text-[24px]'>
                            {validTime}
                        </span>
                    </div>
                </div>
                <div className='cmd-content-body w-full p-[24px]'>
                    {props.signContent instanceof Array ? (<TreasuryUnitTask {...props} context={layoutRender.context}></TreasuryUnitTask>) : (layoutRender.render ? (
                        <OutsideTemplateRender
                            render={
                                layoutRender.render
                            }></OutsideTemplateRender>
                    ) : (
                        <DefaultTemplateRender
                            {...props}
                            context={
                                layoutRender.context
                            }></DefaultTemplateRender>
                    ))}
                </div>
            </div>

            {!props.preViewUrl ? (<div className='w-full mt-[32px] flex justify-between mb-[32px]'>
                <Button
                    variant="secondary"
                    onClick={() => onRejected(props)}
                >
                    {props.cencelText ?? 'Reject'}
                </Button>
                <Button
                    variant="primary"
                    onClick={() => {
                        const req = {
                            ...request
                        }
                        if (!req.header.userId) {
                            req.header.userId = session?.userId
                            req.header.sessionId = session?.sessionId ?? ''
                        }
                        onApproval(props, req)
                    }}
                >
                    {props.confirmText ?? 'Sign to Approve'}
                </Button>
            </div>) : (<div className='w-full my-[32px] flex justify-center'>
                <Button
                    variant="primary"
                    onClick={onReview}
                >
                    Click to Review Details
                </Button>
            </div>)}
        </div>
    );
});

export const TreasuryUnitTask = memo((
    props: SignTaskRenderProps & { context: SignLayoutContext | null }
) => {
    const commandLabel = useMemo(() => {
        if (props.context && props.context['command'] && typeof props.context['command'].label === 'string') {
            return props.context['command'].label;
        } else if (typeof props.extenals?.['commandLabel'] === 'string') {
            return props.extenals['commandLabel'];
        } else {
            return 'Command';
        }
    }, [props.context, props.extenals]);

    const command = useMemo(() => {
        if (typeof props.extenals?.['command'] === 'string') {
            return props.extenals['command'];
        } else {
            return 'Set Treasury Unit';
        }
    }, [props.extenals]);

    const validTimeLabel = useMemo(() => {
        if (props.context) {
            return props.context['valid_until_time'].label;
        } else {
            return (props.extenals?.['validTimeLabel'] ?? 'Valid Time') as string;
        }
    }, [props.context, props.extenals]);
    const vaultCodeLabel = useMemo(() => {
        if (props.context) {
            return props.context['vault_code'].label;
        } else {
            return (props.extenals?.['vaultCodeLabel'] ?? 'Vault Code') as string;
        }
    }, [props.context, props.extenals]);

    const vaultCode = useMemo(() => {
        if (props.context && props.context['vault_code']) {
            return props.context['vault_code'].value as string
        } else {
            return (props.extenals?.['vaultCode'] ?? '') as string;
        }
    }, [props.context, props.extenals])

    const validDateFormat = useMemo(() => {
        return convertToISOFormat(props.validUntilTime)
    }, [props.validUntilTime])

    return (
        <div className='w-full flex flex-col gap-y-[24px]'>
            <div className='flex  w-full gap-x-[24px]'>
                <div className='cmd-name  w-1/2  rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'>
                        <CheckBox className='mr-[11px]'></CheckBox>
                        {commandLabel}
                    </div>
                    <div
                        className='w-full mt-[16px] flex text-left font-[500] text-[24px] leading-[29px] cursor-pointer hover:text-[#007AFF]'
                        data-key='command'
                        title='点击定位到业务系统中的对应数据'
                        onClick={handleLocateElement}
                    >
                        {command}
                    </div>
                </div>
                <div className='cmd-name w-1/2 rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'>
                        <Calendar className='mr-[11px]'></Calendar>
                        {validTimeLabel}
                    </div>
                    <div
                        className='w-full mt-[16px] flex text-left font-[500] text-[24px] break-all leading-[29px] cursor-pointer hover:text-[#007AFF]'
                        data-key='valid_until_time'
                        title='点击定位到业务系统中的对应数据'
                        onClick={handleLocateElement}
                    >
                        {validDateFormat}
                    </div>
                </div>
            </div>
            <div className='flex justify-between w-full gap-x-[24px]'>
                <div className='cmd-name flex-1 rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'>
                        <Vault className='mr-[11px]'></Vault>
                        {vaultCodeLabel}
                    </div>
                    <div
                        className='w-full mt-[16px] break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px] cursor-pointer hover:text-[#007AFF]'
                        data-key='vault_code'
                        title='点击定位到业务系统中的对应数据'
                        onClick={handleLocateElement}
                    >
                        {vaultCode}
                    </div>
                </div>
                <div className='flex-1'></div>
            </div>
        </div>
    );
});

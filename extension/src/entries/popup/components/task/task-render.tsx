import DOMPurify from 'dompurify';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState, memo } from 'react';
import {
    convertToISOFormat,
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
        return (
            <div className='w-full rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px] mt-[24px]'>
                <OrigionMessageRender
                    origionKey={key}
                    context={context}
                    value={messages[key]}></OrigionMessageRender>
            </div>
        );
    });
});

export const OrigionMessageRender = memo(({
    origionKey,
    value,
    context
}: {
    origionKey: string;
    context?: SignLayoutContext | null
    value: unknown;
}) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const recordValue = value as Record<string, unknown>;
        const keys = Object.keys(recordValue);
        const context1 = context ? (Object.values(context).find(a => a.label === origionKey)?.value as SignLayoutContext) : null
        return (
            <>
                <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'>
                    {origionKey}
                </div>
                <div className='w-full border-t border-[rgba(0,0,0,0.2)]'></div>
                <div className='w-full pl-[12px] mt-[16px] flex flex-col text-left font-[500] text-[24px] leading-[29px]'>
                    {keys.map((key1) => {
                        return (
                            <div className='w-full pt-[20px]'>
                                <OrigionMessageRender
                                    origionKey={key1}
                                    context={context1}
                                    value={
                                        recordValue[key1]
                                    }></OrigionMessageRender>
                            </div>
                        );
                    })}
                </div>
            </>
        );
    } else {
        const context1 = context ? (Object.values(context).find(a => a.label === origionKey)?.value) : null
        return (
            <>
                <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'>
                    {origionKey}
                </div>
                <div className='w-full mt-[16px] flex text-left break-all font-[500] text-[24px] leading-[29px]'>
                    {context1 ? String(context1) : String(value)}
                </div>
            </>
        );
    }
})

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
        // props.setSigning?.(false)
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
    }, [props.signContent])
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

    useEffect(() => {
        if (request.topic === SealxTopic.REMOTE_SIGN) {
            // Other window post sign task
            const payload = request.payload as { taskId: string, rejected?: boolean }
            if (payload.taskId === props.taskId) {
                if (payload.rejected) {
                    props.onSign(props.taskId, '');
                } else {
                    onApproval(props, request);
                }
            }
        }
    }, [request, props]); // Removed onApproval and onRejected from dependencies

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
                    {props.signContent instanceof Array ? (<TreasyUnitTask {...props} context={layoutRender.context}></TreasyUnitTask>) : (layoutRender.render ? (
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
                <div
                    onClick={() => onRejected(props)}
                    className=' cursor-pointer rounded-[34px] border-2 border-[rgba(0,0,0,0.06)] font-[500] text-[24px] leading-[28px] pl-[57.77px] pr-[58.23px] pt-[18px] pb-[22px] text-[#000]'>
                    {props.cencelText ?? 'Reject'}
                </div>
                <div
                    onClick={() => onApproval(props, request)}
                    className=' cursor-pointer rounded-[34px] bg-[#000] text-[#fff] border-2 border-[#000] font-[500] text-[24px] leading-[28px] pl-[57.77px] pr-[58.23px] pt-[18px] pb-[22px]'>
                    {props.confirmText ?? 'Sign to Approve'}
                </div>
            </div>) : (<div className='w-full my-[32px] flex justify-center'>
                <div
                    onClick={onReview}
                    className=' px-[36px] cursor-pointer rounded-[34px] bg-[#000] text-[#fff] border-2 border-[#000] font-[500] text-[24px] leading-[28px]  pt-[18px] pb-[22px]'>
                    Click to Review Detials
                </div>
            </div>)}
        </div>
    );
});

export const TreasyUnitTask = memo((
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
            return 'Set Treasy Unit';
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
                    <div className='w-full mt-[16px] flex text-left font-[500] text-[24px] leading-[29px]'>
                        {command}
                    </div>
                </div>
                <div className='cmd-name w-1/2 rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.2)] px-[24px] pt-[17px] pb-[16px]'>
                    <div className='title flex w-full items-center text-left font-[500] text-[19px] text-[#000]/[60%]'>
                        <Calendar className='mr-[11px]'></Calendar>
                        {validTimeLabel}
                    </div>
                    <div className='w-full mt-[16px] flex text-left font-[500] text-[24px] break-all leading-[29px]'>
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
                    <div className='w-full mt-[16px] break-words hyphens-auto text-left font-[500] text-[24px] leading-[29px]'>
                        {vaultCode}
                    </div>
                </div>
                <div className='flex-1'></div>
            </div>
        </div>
    );
});

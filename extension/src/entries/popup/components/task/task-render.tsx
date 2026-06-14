import DOMPurify from 'dompurify';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState, memo, useRef } from 'react';
import {
  convertToISOFormat,
  type SignContent,
  type SignLayoutContext,
  type SignLayoutRender,
  type OrigionType,
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
import { useErrorStore, useSessionStore } from '@src/core/state/index.js';
import { handleLocateElement } from '@src/core/utils/locateElement';
import { REJECT_DELAY_MS } from './constants';
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
export interface SignTaskRenderProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onSubmit'
> {
  /** The sign content to be rendered */
  signContent: SignContent | { taskId: string; signContent: SignContent }[];
  /** Optional: Third-party provided task preview page */
  preViewUrl?: string;
  /** The command type being signed */
  command: string;
  /**(Optional) Additional external data or context for the task, provided as a key-value map. */
  extenals?: Record<string, unknown>;
  /** Unique task identifier */
  taskId: string;
  confirmText?: string;
  cencelText?: string;
  /** Type of task */
  taskType: string;
  signing: boolean;
  onReview?: (url: string) => Promise<void>;
  setSigning?: (signing: boolean) => void;
  /** Whether the component is currently in rejecting state */
  rejecting?: boolean;
  /** Timestamp when the task expires */
  validUntilTime: number;
  /** Callback when session expires during signing — should navigate to /login */
  onSessionExpired?: () => void;
  onSign: (
    taskId: string,
    signatures: string | { taskId: string; signature: string }[] | null,
  ) => void;
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

type FieldReflection = {
  originKey?: string;
  originType?: OrigionType;
  children?: unknown;
};

type FieldKeyMap = Record<string, FieldReflection>;

const asFieldKeyMap = (value: unknown): FieldKeyMap | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  return value as FieldKeyMap;
};

const getFieldSemanticClass = (key = '', originType: OrigionType | '' = '') => {
  const normalizedKey = key.toLowerCase().replace(/[\s_-]+/g, '-');
  if (
    originType === 'time' ||
    normalizedKey.includes('time') ||
    normalizedKey.includes('date') ||
    normalizedKey.includes('valid')
  )
    return 'field-time';
  if (normalizedKey.includes('address') || normalizedKey.includes('account'))
    return 'field-address';
  if (
    normalizedKey.includes('amount') ||
    normalizedKey.includes('value') ||
    normalizedKey.includes('quantity')
  )
    return 'field-amount';
  if (
    normalizedKey.includes('command') ||
    normalizedKey.includes('action') ||
    normalizedKey.includes('type')
  )
    return 'field-command';
  if (normalizedKey.includes('network') || normalizedKey.includes('chain'))
    return 'field-network';
  if (
    normalizedKey.includes('asset') ||
    normalizedKey.includes('coin') ||
    normalizedKey.includes('token')
  )
    return 'field-asset';
  if (normalizedKey.includes('vault') || normalizedKey.includes('safe'))
    return 'field-vault';
  if (
    normalizedKey.includes('target') ||
    normalizedKey.includes('to') ||
    normalizedKey.includes('recipient')
  )
    return 'field-target';
  if (normalizedKey.includes('file') || normalizedKey.includes('hash'))
    return 'field-file';
  if (normalizedKey.includes('password') || normalizedKey.includes('pin'))
    return 'field-password';
  if (originType === 'array') return 'field-list';
  if (originType === 'struct') return 'field-struct';
  return 'field-default';
};

const shouldPairFieldCards = (leftClass: string, rightClass: string) => {
  if (leftClass === 'field-command') {
    return rightClass === 'field-network' || rightClass === 'field-time';
  }
  return false;
};

/**
 * Renders content using the default template from template factory
 * @param props Component props
 * @returns Rendered template or empty fragment if no template found
 */
export const DefaultTemplateRender = memo(
  ({ context, ...props }: DefaultTemplateRenderProps) => {
    const [safeHtml, setSafeHtml] = useState<string>('');
    const { sendToIframe } = useGlobalContext();

    // 从 keysMapStr 解析出完整的 key 映射（用于元素定位）
    const keyMap = useMemo(() => {
      if (props.signContent instanceof Array) return null;
      const layout = props.signContent.layout;
      if (!layout?.keysMapStr) return null;
      try {
        return JSON.parse(layout.keysMapStr) as FieldKeyMap;
      } catch {
        return null;
      }
    }, [props.signContent]);

    const onRendered = useCallback(async () => {
      const { type, output, error } = await sendToIframe({
        type: 'render',
        context: JSON.parse(JSON.stringify(context)),
        template: templates[props.command] ?? '',
      });
      if (type === 'rendered') {
        setSafeHtml(DOMPurify.sanitize(output));
        // 可以在这里更新 UI 或执行后续逻辑
      }
      if (type === 'error') {
        console.error('渲染失败:', error);
      }
    }, [context, props.command, sendToIframe]);
    useEffect(() => {
      if (context && templates[props.command]) onRendered();
    }, [context, onRendered, props.command]);
    if (context && templates[props.command]) {
      // Sanitize and render the template with context
      return (
        <div
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(safeHtml) }}
        ></div>
      );
    }
    if (props.signContent instanceof Array) {
      return '';
    }
    const messages = props.signContent.message;
    const keys = Object.keys(messages);
    const renderFieldCard = (key: string) => {
      // 从 keysMapStr 映射获取顶层 originKey
      const mapping = keyMap?.[key];
      const originKey = mapping?.originKey || key;
      const semanticClass = getFieldSemanticClass(
        originKey,
        mapping?.originType,
      );
      // Origin key mapping for element location
      return (
        <div key={key} className={`sx-field-card ${semanticClass}`}>
          <OrigionMessageRender
            origionKey={originKey}
            displayKey={key}
            keyMap={keyMap ?? undefined}
            context={context}
            parentKeys={[]}
            value={messages[key]}
          ></OrigionMessageRender>
        </div>
      );
    };;
    const renderedFields = [];
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      const nextKey = keys[index + 1];
      const currentMapping = keyMap?.[key];
      const nextMapping = nextKey ? keyMap?.[nextKey] : undefined;
      const currentClass = getFieldSemanticClass(
        currentMapping?.originKey || key,
        currentMapping?.originType,
      );
      const nextClass = nextKey
        ? getFieldSemanticClass(
            nextMapping?.originKey || nextKey,
            nextMapping?.originType,
          )
        : '';

      if (nextKey && shouldPairFieldCards(currentClass, nextClass)) {
        renderedFields.push(
          <div key={`${key}-${nextKey}`} className='sx-field-row'>
            {renderFieldCard(key)}
            {renderFieldCard(nextKey)}
          </div>,
        );
        index += 1;
      } else {
        renderedFields.push(renderFieldCard(key));
      }
    }
    return renderedFields;
  },
);

export const OrigionMessageRender = memo(
  ({
    origionKey,
    displayKey,
    keyMap,
    value,
    context,
    parentKeys = [],
  }: {
    origionKey: string;
    displayKey?: string;
    keyMap?: FieldKeyMap;
    context?: SignLayoutContext | null;
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
    const finalMapping =
      currentMapping ||
      (keyForDisplay.startsWith('#') ? keyMap?.[keyForDisplay] : undefined);

    const originKey = finalMapping?.originKey || keyForDisplay;
    const originType = finalMapping?.originType || '';
    const semanticClass = getFieldSemanticClass(originKey, originType);

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
      const arrayChildrenMap = asFieldKeyMap(finalMapping?.children);
      return (
        <>
          <div className='sx-field-title'>{keyForDisplay}</div>
          <div className='sx-field-list'>
            {value.map((item, index) => {
              const itemKey = `#${index + 1}`;
              // 使用 originKey + 下标作为 data-key
              //const itemDataKey = `${originKey}.${itemKey}`;
              // 获取数组元素对应的 children
              const itemChildrenMap = asFieldKeyMap(
                arrayChildrenMap?.[itemKey],
              );
              // 如果数组元素是对象，需要将 childrenMap 合并，让它能通过属性名查找
              // itemChildrenMap 包含 "Coin ID", "Fund Control Rules" 等属性
              return (
                <div key={index} className='sx-array-item'>
                  <span className='sx-array-index'>{index + 1}</span>
                  <div className='sx-array-content'>
                    <OrigionMessageRender
                      origionKey={itemKey}
                      displayKey={itemKey}
                      keyMap={itemChildrenMap || arrayChildrenMap}
                      context={context}
                      parentKeys={[...parentKeys, originKey]}
                      value={item}
                    />
                  </div>
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
      const childrenMap = asFieldKeyMap(finalMapping?.children);
      return (
        <>
          <div className='sx-field-title'>{keyForDisplay}</div>
          <div className='sx-field-divider'></div>
          <div className='sx-field-nested'>
            {keys.map((key1) => {
              return (
                <div className='sx-field-nested-item'>
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
        <div className='sx-field-title'>{keyForDisplay}</div>
        <div
          className={`sx-field-value ${semanticClass}`}
          data-key={fullDataKey}
          title='点击定位到业务系统中的对应数据'
          onClick={handleLocateElement}
        >
          {displayValue(value)}
        </div>
      </>
    );
  },
);

/**
 * Props for OutsideTemplateRender component
 */
export interface OutsideTemplateRenderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** HTML string to render */
  render: string;
}

/**
 * Renders content from an external template source
 * @param props Component props
 * @returns Sanitized rendered content
 */
export const OutsideTemplateRender = memo(
  ({ render, ...props }: OutsideTemplateRenderProps) => {
    const safeHtml = DOMPurify.sanitize(render);
    const className = `sx-outside-template ${props.className ?? ''}`.trim();
    return (
      <div
        {...props}
        className={className}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  },
);

const handleApprovalFailure = (props: SignTaskRenderProps, error: unknown) => {
  console.error('Approval failed:', error);
  props.setSigning?.(false);
  useErrorStore
    .getState()
    .setError(error instanceof Error ? error : 'Approval failed');
};

const getSigningFailureMessage = (res: unknown) => {
  if (!res || typeof res !== 'object')
    return 'Signing failed. Please try again.';
  const result = res as { error?: string; errorCode?: string };
  return (
    result.error || result.errorCode || 'Signing failed. Please try again.'
  );
};

/**
 * Handles the signing operation when user clicks "Sign to Approve"
 * - Logs the signing content and task ID for debugging
 * - Sends the signed response back through the request channel
 * - Currently uses a placeholder signature that should be replaced with actual signing logic
 */
const onApproval = async (
  props: SignTaskRenderProps,
  request: SealxRequest,
) => {
  if (!request.header.userId || props.signing) {
    return;
  }
  props.setSigning?.(true);
  try {
    const signatures = [] as { taskId: string; signature: string }[];
    if (props.signContent instanceof Array) {
      for (const signContent of props.signContent) {
        const res = (await sign(
          request.header.userId,
          request.header.host,
          signContent.signContent,
        )) as { signature: string; errorCode?: string } | null;
        if (!res?.signature) {
          if ((res as any)?.errorCode === 'SESSION_EXPIRED') {
            props.setSigning?.(false);
            props.onSessionExpired?.();
            return;
          }
          throw new Error(getSigningFailureMessage(res));
        }
        signatures.push({
          taskId: signContent.taskId,
          signature: res.signature,
        });
      }
      props.onSign(props.taskId, signatures);
      return {
        signatures,
        taskId: props.taskId,
      };
    } else {
      const res = (await sign(
        request.header.userId,
        request.header.host,
        props.signContent,
      )) as { signature: string; errorCode?: string } | null;
      if (!res?.signature) {
        if ((res as any)?.errorCode === 'SESSION_EXPIRED') {
          props.setSigning?.(false);
          props.onSessionExpired?.();
          return;
        }
        throw new Error(getSigningFailureMessage(res));
      }
      props.onSign(props.taskId, res.signature);
      return {
        signatures,
        taskId: props.taskId,
      };
    }
  } catch (error) {
    handleApprovalFailure(props, error);
  }
};

/**
 * Main component for rendering sign tasks
 * @param props Component props
 * @returns Rendered sign task UI
 */
export const SignTaskRender = memo((props: SignTaskRenderProps) => {
  const navigate = useNavigate();
  const { sendToIframe } = useGlobalContext();
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

  // Rejection loading state
  const [rejecting, setRejecting] = useState(false);
  const rejectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup reject timeout on unmount
  useEffect(() => {
    return () => {
      if (rejectTimeoutRef.current) {
        clearTimeout(rejectTimeoutRef.current);
        rejectTimeoutRef.current = null;
      }
    };
  }, []);

  // Shared reject handler: shows animation, then calls onSign
  const handleReject = useCallback(() => {
    if (rejectTimeoutRef.current) return;
    setRejecting(true);
    rejectTimeoutRef.current = setTimeout(() => {
      rejectTimeoutRef.current = null;
      setRejecting(false);
      props.onSign(props.taskId, '');
    }, REJECT_DELAY_MS);
  }, [props]);

  // Merge local rejecting state with parent-prop rejecting state (TaskDetail passes it)
  const isRejecting = rejecting || props.rejecting;

  const { request } = useRequestContext();
  const parseSignContent = useCallback(async () => {
    if (props.signContent instanceof Array) {
      return;
    }
    const { type, output, error } = await sendToIframe({
      type: 'parseContent',
      signContent: JSON.parse(JSON.stringify(props.signContent)),
    });
    if (type === 'contentParsed') {
      setLayoutRender(output);
    }

    if (type === 'error') {
      console.error('渲染失败:', error);
    }
  }, [props.signContent, sendToIframe]);
  useEffect(() => {
    if (layoutRender.context)
      setLayoutRender({
        ...layoutRender,
        context: null,
      });
  }, [layoutRender, props.signContent]);
  useEffect(() => {
    // layoutRender.context=null
    parseSignContent();
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
          : `${format(hours)}h:${format(minutes)}m:${format(seconds)}s`,
      );
    };;
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
  const session = useSessionStore.use.session();
  useEffect(() => {
    if (request.topic === SealxTopic.REMOTE_SIGN) {
      // Other window post sign task
      const payload = request.payload as { taskId: string; rejected?: boolean };
      if (payload.taskId === props.taskId) {
        if (payload.rejected) {
          handleReject();
        } else {
          const req = {
            ...request,
          };
          if (!req.header.userId) {
            req.header.userId = session?.userId;
            req.header.sessionId = session?.sessionId ?? '';
          }
          onApproval(props, req);
        }
      }
    }
  }, [request, props, session?.userId, session?.sessionId, handleReject]);

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
  }, [props, navigate]);

  // const session = useSessionStore.use.session()

  return (
    <div {...props} className={`sx-task-render ${props.className ?? ''}`}>
      <div className='cmd-info-container sx-task-card'>
        <div className='cmd-title-wrapper sx-task-header'>
          <span className='sx-task-title'>{primaryType}</span>
          <div className='sx-task-timer'>
            <Clock></Clock>
            <span>{validTime}</span>
          </div>
        </div>
        <div className='cmd-content-body sx-task-body'>
          {props.signContent instanceof Array ? (
            <TreasuryUnitTask
              {...props}
              context={layoutRender.context}
            ></TreasuryUnitTask>
          ) : layoutRender.render ? (
            <OutsideTemplateRender
              render={layoutRender.render}
            ></OutsideTemplateRender>
          ) : (
            <DefaultTemplateRender
              {...props}
              context={layoutRender.context}
            ></DefaultTemplateRender>
          )}
        </div>
        {!props.preViewUrl ? (
          <div className='sx-task-actions'>
            <Button
              variant='secondary'
              onClick={handleReject}
              disabled={props.signing || isRejecting}
              loading={isRejecting}
            >
              {isRejecting ? 'Rejecting...' : (props.cencelText ?? 'Reject')}
            </Button>
            <Button
              variant='primary'
              disabled={props.signing || isRejecting}
              onClick={() => {
                const req = {
                  ...request,
                };
                if (!req.header.userId) {
                  req.header.userId = session?.userId;
                  req.header.sessionId = session?.sessionId ?? '';
                }
                onApproval(props, req);
              }}
            >
              {props.confirmText ?? 'Sign to Approve'}
            </Button>
          </div>
        ) : (
          <div className='sx-task-actions sx-task-actions-review'>
            <Button variant='primary' onClick={onReview}>
              Click to Review Details
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});

export const TreasuryUnitTask = memo(
  (props: SignTaskRenderProps & { context: SignLayoutContext | null }) => {
    const commandLabel = useMemo(() => {
      if (
        props.context &&
        props.context['command'] &&
        typeof props.context['command'].label === 'string'
      ) {
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
        return props.context['vault_code'].value as string;
      } else {
        return (props.extenals?.['vaultCode'] ?? '') as string;
      }
    }, [props.context, props.extenals]);

    const validDateFormat = useMemo(() => {
      return convertToISOFormat(props.validUntilTime);
    }, [props.validUntilTime]);

    return (
      <div className='sx-treasury-grid'>
        <div className='sx-treasury-row'>
          <div className='cmd-name sx-field-card field-command'>
            <div className='sx-field-title'>
              <CheckBox className='mr-[11px]'></CheckBox>
              {commandLabel}
            </div>
            <div
              className='sx-field-value field-command'
              data-key='command'
              title='点击定位到业务系统中的对应数据'
              onClick={handleLocateElement}
            >
              {command}
            </div>
          </div>
          <div className='cmd-name sx-field-card field-time'>
            <div className='sx-field-title'>
              <Calendar className='mr-[11px]'></Calendar>
              {validTimeLabel}
            </div>
            <div
              className='sx-field-value field-time'
              data-key='valid_until_time'
              title='点击定位到业务系统中的对应数据'
              onClick={handleLocateElement}
            >
              {validDateFormat}
            </div>
          </div>
        </div>
        <div className='sx-treasury-row'>
          <div className='cmd-name sx-field-card field-vault'>
            <div className='sx-field-title'>
              <Vault className='mr-[11px]'></Vault>
              {vaultCodeLabel}
            </div>
            <div
              className='sx-field-value field-vault'
              data-key='vault_code'
              title='点击定位到业务系统中的对应数据'
              onClick={handleLocateElement}
            >
              {vaultCode}
            </div>
          </div>
        </div>
      </div>
    );
  },
);

// import { useNavigate } from 'react-router-dom';
import './styles.css';
import { Password } from '../password';
import { useCallback, useEffect, useRef, useState } from 'react';
import { login } from '@src/core/background';
import messager from '@src/core/messager';
// import { localStorageWrapper } from 'sealx-core';
import { useRequestContext } from '@src/hooks/useRequestContextHook';
import { useGlobalContext } from '@src/hooks/useGlobalContext';
import { useSealXNavigate } from '../../hooks/useSealXNavigate';
import { lockLogin } from '../../state/session';
import { SealxTopic } from 'sealx-message';
import type { ReplyFunc } from 'sealx-message';
import { usePinInputMode } from '../../utils/pinInputMode';
import { useSessionStore } from '@src/core/state';
import type { ConnectionRequest } from 'sealx-message';
import { loginAnimatingRef, loginAnimatingMeta } from '@src/core/state/login-animating';
import sealxLogoSvg from '@assets/svg/sealx-logo.svg?raw';

const LOGGING_IN_DURATION_MS = 5_00;

const getPostLoginRoute = (topic?: SealxTopic) => {
  if (topic === SealxTopic.BIND_PK) return '/bind-pubkey';
  if (topic === SealxTopic.SIGN || topic === SealxTopic.BATCH_SIGN) return '/task-home';
  return null;
};

export default function Login() {
  const navigate = useSealXNavigate();
  const [password, setPassword] = useState<string>('');
  const [countdown, setCountdown] = useState<string>('');
  const { userId } = useRequestContext();
  const { attempt, setAttempt, lockTime, setLockTime, maxAttempt, maxLockTime } =
    useGlobalContext();
  const { setSession, activeTabHost, setActiveTabHost, request, session } = useRequestContext();
  // const {setUserId} = useSession()
  const setUserId = useSessionStore.use.setUserId();
  const reply = useRef<ReplyFunc>(null);
  const latestTopicRef = useRef<SealxTopic | undefined>(request.topic);
  const { clickToType, clickToTypeKey } = usePinInputMode(request);
  const loginCallCountRef = useRef(0);
  const loginDoneRef = useRef(false);
  const passwordChangeCountRef = useRef(0);
  const [loggingIn, setLoggingIn] = useState(false);

  console.warn('[TRACE-CONNECT:LOGIN] +++ component render +++', {
    mountTopic: request.topic,
    userId,
    activeTabHost,
    hasSession: !!session,
    sessionUserId: session?.userId,
    passwordChangeCount: passwordChangeCountRef.current,
  });

  useEffect(() => {
    console.warn('[TRACE-CONNECT:LOGIN] request.topic changed', {
      from: latestTopicRef.current,
      to: request.topic,
      hasReply: !!request.reply,
      loginDone: loginDoneRef.current,
    });
    latestTopicRef.current = request.topic;
    if (request.topic === SealxTopic.LOGIN || request.topic === SealxTopic.CONNECT) {
      reply.current = request.reply ?? null;
      const connectRequest = request as ConnectionRequest;
      if (!userId) {
        const inferredUserId = connectRequest.payload?.userId || connectRequest.header?.userId;
        console.warn(
          '[TRACE-CONNECT:LOGIN] WARNING: no userId in context for LOGIN/CONNECT topic',
          request,
          inferredUserId,
        );

        setUserId(inferredUserId || '');
      }
      if (!activeTabHost) {
        const inferredHost = connectRequest.payload?.host || connectRequest.header?.host;
        console.warn(
          '[TRACE-CONNECT:LOGIN] WARNING: no activeTabHost in context for LOGIN/CONNECT topic',
          request,
          inferredHost,
        );
        setActiveTabHost(inferredHost || '');
      }
    }
  }, [request.topic, request.reply, setUserId, userId, request, setActiveTabHost, activeTabHost]);

  // Handle deferred navigation after logging-in animation completes
  useEffect(() => {
    if (!loggingIn) return;
    const timer = setTimeout(() => {
      loginAnimatingRef.current = false;
      setLoggingIn(false);
      const finalTopic = latestTopicRef.current;
      const targetRoute = getPostLoginRoute(finalTopic);
      if (targetRoute) {
        navigate(targetRoute, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }, LOGGING_IN_DURATION_MS);
    return () => {
      clearTimeout(timer);
      loginAnimatingRef.current = false;
    };
  }, [loggingIn, navigate]);

  // Update countdown every second when locked
  useEffect(() => {
    if (attempt === 0) {
      const updateCountdown = () => {
        const remaining = Math.max(0, lockTime - Date.now());
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        if (minutes === 0 && seconds === 0) {
          clearInterval(interval);
          setAttempt(maxAttempt);
          setLockTime(0);
        }
        setCountdown(
          `${minutes > 0 ? minutes + ' minutes ' : ' '}${seconds > 0 ? seconds + ' seconds' : ''}`,
        );
      };

      // Update immediately
      updateCountdown();

      // Then update every second
      const interval = setInterval(updateCountdown, 1000);
      return () => clearInterval(interval);
    } else {
      setCountdown('');
    }
  }, [attempt, lockTime, maxAttempt, setAttempt, setLockTime]);

  const handlePasswordChange = useCallback(
    async (value: string) => {
      passwordChangeCountRef.current++;
      const callIndex = passwordChangeCountRef.current;
      console.warn(`[TRACE-CONNECT:LOGIN] handlePasswordChange #${callIndex}`, {
        value,
        valueLen: value.length,
        loginRequestTopic: request.topic,
        userId,
        activeTabHost,
        hasReply: !!reply.current,
        loginDone: loginDoneRef.current,
      });
      setPassword(value);
      if (value.length >= 6) {
        if (loginDoneRef.current) {
          console.warn(`[TRACE-CONNECT:LOGIN] SKIP — already logged in (call #${callIndex})`);
          return;
        }
        loginCallCountRef.current++;
        const loginCallIndex = loginCallCountRef.current;
        const loginRequestTopic = request.topic;
        console.warn(`[TRACE-CONNECT:LOGIN] login attempt #${loginCallIndex}`, {
          loginRequestTopic,
          userId,
          activeTabHost,
        });
        try {
          const res = await login(value, userId, activeTabHost);
          console.warn(`[TRACE-CONNECT:LOGIN] login result #${loginCallIndex}`, {
            resUserId: res?.userId,
            resHost: res?.host,
            resSessionId: res?.sessionId,
            resExpire: res?.expire,
          });
          if (res) {
            loginDoneRef.current = true;
            setSession(res);
            messager.session = res;
            // 仅 CONNECT/LOGIN topic 才 reply session 给 Background
            // SIGN/BIND_PK 的 reply 留给业务组件（task-home / bind-pubkey），携带最终结果
            if (request.topic === SealxTopic.CONNECT || request.topic === SealxTopic.LOGIN) {
              reply.current?.({
                session: res,
                account: {
                  userId: res.userId,
                  host: res.host,
                  pk: res.pk,
                },
              } as never);
            }
            console.warn(`[TRACE-CONNECT:LOGIN] reply sent #${loginCallIndex}`, {
              sessionUserId: res.userId,
              sessionHost: res.host,
              sessionPk: res.pk,
            });
            // Show logging-in animation — navigation deferred to animation-end effect
            loginAnimatingRef.current = true;
            loginAnimatingMeta.setAt = Date.now();
            setLoggingIn(true);
            // alert(request.topic)
          } else {
            console.warn(`[TRACE-CONNECT:LOGIN] login FAILED #${loginCallIndex} — setPassword("")`);
            setPassword('');
          }
        } catch (e) {
          console.warn(`[TRACE-CONNECT:LOGIN] login ERROR #${loginCallIndex}`, e);
          setPassword('');
          reply.current?.({ error: e });
          const t = attempt - 1;
          setAttempt(t);
          if (t === 0) {
            const now = Date.now();
            const expire = now + maxLockTime * 60 * 1000;
            await lockLogin(expire);
            setLockTime(expire);
            setSession(null);
          }
        }
      }
    },
    [
      userId,
      activeTabHost,
      setSession,
      request.topic,
      attempt,
      setAttempt,
      maxLockTime,
      setLockTime,
    ],
  );

  return (
    <div className="login-container w-full flex ">
      <div className="w-full min-h-[780px] flex flex-col mx-auto relative">
        <div className="sealx-logo w-full mt-[7.5rem] ">
          <span
            className="m-auto block w-[190px] h-[184px]"
            aria-label="SealX Logo"
            role="img"
            dangerouslySetInnerHTML={{ __html: sealxLogoSvg }}
          />
        </div>
        {loggingIn ? (
          <div className="login-anim-overlay mx-auto px-[1.5rem] w-full flex flex-col items-center mt-[5.7231rem] mb-[1.5rem]">
            <div className="login-anim-pulse" />
            <span className="text-[1.125rem] font-[600] text-(--sx-muted)">Verifying...</span>
          </div>
        ) : (
          <>
            <div className="mx-auto px-[1.5rem] w-full flex mt-[5.7231rem] mb-[1.5rem]">
              <Password
                key="password-input"
                password={password}
                className="w-full password-input-wrapper"
                onChange={handlePasswordChange}
                autoFocus
                readonly={attempt === 0}
                clickToType={clickToType}
                clickToTypeKey={clickToTypeKey}
              />
            </div>
            <div
              className={
                (attempt === 0 ? 'text-[#F0231E] ' : 'text-[#000]/60 ') +
                ' text-center w-full px-[1.5rem] text-[1.3125rem] leading-[1.75]'
              }
            >
              {attempt === 0
                ? `Too many incorrect attempts. Your account is locked for ${maxLockTime} minutes. ${countdown} left.`
                : `You have ${attempt} attempt${attempt !== 1 ? 's' : ''} remaining. `}
            </div>
          </>
        )}
        <div className=" text-[#000]/36 text-[1.5625rem] leading-[2.5] font-nanum-pen absolute bottom-[32px]  w-full text-center">
          What you see is what you sign
        </div>
      </div>
    </div>
  );
}

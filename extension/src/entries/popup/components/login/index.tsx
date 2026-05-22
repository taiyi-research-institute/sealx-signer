// import { useNavigate } from 'react-router-dom';
import './styles.css';
import { Password } from '../password';
import { useCallback, useEffect, useRef, useState } from 'react';
import { login } from '@src/core/background';
// import { localStorageWrapper } from 'sealx-core';
import { useRequestContext } from '@src/hooks/useRequestContextHook';
import { useGlobalContext } from '@src/hooks/useGlobalContext';
import { useSealXNavigate } from '../../hooks/useSealXNavigate';
import { lockLogin } from '../../state/session';
import { SealxTopic } from 'sealx-message';
import type { ReplyFunc } from 'sealx-message';
import { usePinInputMode } from '../../utils/pinInputMode';
// import { useErrorStore } from '@src/core/state';
// import messager from '@src/core/messager';
// import { useSessionStore } from '@src/core/state';
// import { useSessionStore } from '@src/core/state/session';

const CONNECT_FALLBACK_DELAY_MS = 2_000;

const getPostLoginRoute = (topic?: SealxTopic) => {
    if (topic === SealxTopic.BIND_PK) return '/bind-pubkey';
    if (topic === SealxTopic.SIGN || topic === SealxTopic.BATCH_SIGN) return '/task-home';
    return null;
};

export default function Login() {
    const navigate = useSealXNavigate()
    const [password, setPassword] = useState<string>('');
    const [countdown, setCountdown] = useState<string>(''); // Store formatted countdown
    const { userId } = useRequestContext()
    // const setError = useErrorStore.use.setError()
    const { attempt, setAttempt, lockTime, setLockTime, maxAttempt, maxLockTime } = useGlobalContext()
    // const setSession = useSessionStore.use.setSession()
    const { setSession, activeTabHost, request } = useRequestContext()
    const reply = useRef<ReplyFunc>(null)
    const latestTopicRef = useRef<SealxTopic | undefined>(request.topic)
    const connectFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const { clickToType, clickToTypeKey } = usePinInputMode(request)
    // useEffect(() => setError('Test error 5342523453453425234 4352345345 3453245345234 4352345234 345324523 34543534 345234534 popup!!!!!'), [setError])
    useEffect(() => {
        latestTopicRef.current = request.topic
        if (request.topic !== SealxTopic.CONNECT && connectFallbackTimerRef.current) {
            clearTimeout(connectFallbackTimerRef.current)
            connectFallbackTimerRef.current = null
        }
        if (request.topic === SealxTopic.LOGIN || request.topic === SealxTopic.CONNECT) {
            reply.current = request.reply ?? null
            // alert(reply.current ? 'settup reply' : 'skip')
        }
    }, [request.topic, request.reply])

    useEffect(() => {
        return () => {
            if (connectFallbackTimerRef.current) {
                clearTimeout(connectFallbackTimerRef.current)
                connectFallbackTimerRef.current = null
            }
        }
    }, [])

    // Update countdown every second when locked
    useEffect(() => {
        if (attempt === 0) {
            const updateCountdown = () => {
                const remaining = Math.max(0, lockTime - Date.now());
                const minutes = Math.floor(remaining / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);
                if (minutes === 0 && seconds === 0) {
                    clearInterval(interval)
                    setAttempt(maxAttempt)
                    setLockTime(0)
                }
                setCountdown(`${minutes > 0 ? minutes + ' minutes ' : ' '}${seconds > 0 ? seconds + ' seconds' : ''}`);
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


    const handlePasswordChange = useCallback(async (value: string) => {
        setPassword(value);
        if (value.length >= 6) {
            const loginRequestTopic = request.topic
            try {
                const res = await login(value, userId, activeTabHost)
                if (res) {
                    // console.log(res)
                    setSession(res)
                    reply.current?.({
                        session: res, account: {
                            userId: res.userId,
                            host: res.host,
                            pk: res.pk
                        }
                    } as never)
                    const targetRoute = getPostLoginRoute(loginRequestTopic)
                    if (targetRoute) {
                        navigate(targetRoute, { replace: true })
                    } else if (loginRequestTopic === SealxTopic.CONNECT) {
                        setPassword('')
                        if (connectFallbackTimerRef.current) {
                            clearTimeout(connectFallbackTimerRef.current)
                        }
                        connectFallbackTimerRef.current = setTimeout(() => {
                            connectFallbackTimerRef.current = null
                            if (latestTopicRef.current === SealxTopic.CONNECT) {
                                navigate('/', { replace: true })
                            }
                        }, CONNECT_FALLBACK_DELAY_MS)
                    } else {
                        navigate('/', { replace: true })
                    }
                    // alert(request.topic)
                } else {
                    setPassword('')
                }
            } catch (e) {
                setPassword('')
                reply.current?.({ error: e })
                const t = attempt - 1
                setAttempt(t)
                if (t === 0) {
                    const now = Date.now();
                    const expire = now + maxLockTime * 60 * 1000
                    await lockLogin(expire)
                    setLockTime(expire);
                    setSession(null)
                }
            }
        }
    }, [userId, activeTabHost, setSession, request.topic, navigate, attempt, setAttempt, maxLockTime, setLockTime])

    return (
        <div className="login-container w-full flex ">
            <div className='w-full min-h-[780px] flex flex-col mx-auto relative'>
                <div className='sealx-logo w-full mt-[7.5rem] '>
                    <img className='m-auto w-[190px] h-[184px]' src="/public/logo/sealx-logo.svg" alt="SealX Logo" />
                </div>
                <div className='mx-auto px-[1.5rem] w-full flex mt-[5.7231rem] mb-[1.5rem]'>
                    <Password
                        key="password-input"
                        password={password}
                        className='w-full password-input-wrapper'
                        onChange={handlePasswordChange}
                        autoFocus
                        readonly={attempt === 0}
                        clickToType={clickToType}
                        clickToTypeKey={clickToTypeKey}
                    />
                </div>
                <div className={(attempt === 0 ? 'text-[#F0231E] ' : 'text-[#000]/60 ') + ' text-center w-full px-[1.5rem] text-[1.3125rem] leading-[1.75]'}>
                    {
                        attempt === 0 ? (`Too many incorrect attempts. Your account is locked for ${maxLockTime} minutes. ${countdown} left.`) :
                            (`You have ${attempt} attempt${attempt !== 1 ? 's' : ''} remaining. `)
                    }
                </div>
                <div className=' text-[#000]/36 text-[1.5625rem] leading-[2.5] font-nanum-pen absolute bottom-[32px]  w-full text-center'>
                    What you see is what you sign
                </div>
            </div>
        </div>
    );
}

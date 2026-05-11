import './styles.css';
import { Password } from '../password';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clearSessionPrivateKey, login } from '@src/core/background';
import { useRequestContext } from '@src/hooks/useRequestContextHook';
import { useGlobalContext } from '@src/hooks/useGlobalContext';
import { useSealXNavigate } from '../../hooks/useSealXNavigate';
import { lockLogin } from '../../state/session';
import { SealxTopic } from 'sealx-message';
import type { ReplyFunc } from 'sealx-message';

export default function Login() {
    const navigate = useSealXNavigate()
    const [password, setPassword] = useState<string>('');
    const [countdown, setCountdown] = useState<string>('');
    const [loggingIn, setLoggingIn] = useState(false);
    const { userId } = useRequestContext()
    // const setError = useErrorStore.use.setError()
    const { attempt, setAttempt, lockTime, setLockTime, maxAttempt, maxLockTime } = useGlobalContext()
    const { setSession, activeTabHost, request } = useRequestContext()
    const reply = useRef<ReplyFunc>(null)
    useEffect(() => {
        if (request.topic === SealxTopic.LOGIN || request.topic === SealxTopic.CONNECT) {
            reply.current = request.reply ?? null
        }
    }, [request.topic, request.reply])

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
            setLoggingIn(true)
            try {
                const res = await login(value, userId, activeTabHost)
                if (res) {
                    setSession(res)
                    reply.current?.({
                        session: res, account: {
                            userId: res.userId,
                            host: res.host,
                            pk: res.pk
                        }
                    } as never)
                    if (request.topic === SealxTopic.BIND_PK) {
                        navigate('/bind-pubkey', { replace: true })
                    } else if (request.topic === SealxTopic.SIGN || request.topic === SealxTopic.BATCH_SIGN) {
                        navigate('/task-home', { replace: true })
                    } else {
                        navigate('/', { replace: true })
                    }
                    // alert(request.topic)
                } else {
                    setPassword('')
                    setLoggingIn(false)
                }
            } catch (e) {
                setPassword('')
                setLoggingIn(false)
                reply.current?.({ error: e })
                const t = attempt - 1
                setAttempt(t)
                if (t === 0) {
                    const now = Date.now();
                    const expire = now + maxLockTime * 60 * 1000
                    await lockLogin(expire)
                    setLockTime(expire);
                    await clearSessionPrivateKey(activeTabHost, userId)
                    setSession(null)
                }
            }
        }
    }, [userId, activeTabHost, setSession, request.topic, navigate, attempt, setAttempt, maxLockTime, setLockTime])

    return (
        <div className="login-container w-full flex bg-sealx-gradient">
            <div className='w-full min-h-[780px] flex flex-col mx-auto relative'>
                <div className='sealx-logo w-full mt-[120px] '>
                    <img className='m-auto w-[190px] h-[184px]' src="/public/logo/sealx-logo.svg" alt="SealX Logo" />
                </div>
                <div className='mx-auto px-[24px] w-full flex mt-[91.57px] mb-[24px]'>
                    <Password
                        key="password-input"
                        password={password}
                        className='w-full password-input-wrapper'
                        onChange={handlePasswordChange}
                        autoFocus
                        readonly={attempt === 0 || loggingIn}
                    />
                </div>
                {loggingIn && (
                    <div className='flex justify-center mt-[16px]'>
                        <div className='w-[24px] h-[24px] border-2 border-brand border-t-transparent rounded-full animate-spin'></div>
                    </div>
                )}
                <div className={(attempt === 0 ? 'text-text-error ' : 'text-text-secondary ') + ' text-center w-full px-[24px] text-[21px] leading-[28px]' + (loggingIn ? ' invisible' : '')}>
                    {
                        attempt === 0 ? (`Too many incorrect attempts. Your account is locked for ${maxLockTime} minutes. ${countdown} left.`) :
                            (`You have ${attempt} attempt${attempt !== 1 ? 's' : ''} remaining. `)
                    }
                </div>
                <div className=' text-text-tertiary text-[25px] leading-[40px] font-nanum-pen absolute bottom-[32px] w-full text-center'>
                    What you see is what you sign
                </div>
            </div>
        </div>
    );
}

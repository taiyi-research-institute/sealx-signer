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
import messager from '@src/core/messager';
// import { useSessionStore } from '@src/core/state';
// import { useSessionStore } from '@src/core/state/session';

export default function Login() {
    const navigate = useSealXNavigate()
    const [password, setPassword] = useState<string>('');
    const [countdown, setCountdown] = useState<string>(''); // Store formatted countdown
    const { userId } = useRequestContext()
    const { attempt, setAttempt, lockTime, setLockTime, maxAttempt, maxLockTime } = useGlobalContext()
    // const setSession = useSessionStore.use.setSession()
    const { setSession, activeTabHost, request } = useRequestContext()
    const reply = useRef<ReplyFunc>(null)
    useEffect(() => {
        if (request.topic === SealxTopic.LOGIN || request.topic === SealxTopic.CONNECT) {
            reply.current = request.reply ?? null
            // alert(reply.current ? 'settup reply' : 'skip')
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
        console.log(`------ password ${value} --------`)
        if (value.length >= 6) {
            try {
                const res = await login(value, userId, activeTabHost)
                if (res) {
                    // console.log(res)
                    setSession(res)
                    reply.current?.(res as never)
                    console.log('---------- topic -------', request?.topic)
                    if (request.topic === SealxTopic.BIND_PK) {
                        navigate('/bind-pubkey', { replace: true })
                    } else if (request.topic === SealxTopic.SIGN || request.topic === SealxTopic.BATCH_SIGN) {
                        navigate('/task-home', { replace: true })
                    } else {
                        navigate('/', { replace: true })
                    }
                    // alert(request.topic)
                    console.log('---------- connected -----', Date.now())
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
        <div className="login-container flex ">
            <div className='w-[600px] min-h-[780px] flex flex-col mx-auto relative'>
                <div className='sealx-logo w-full mt-[120px] '>
                    <img className='m-auto' src="/public/logo/sealx-logo.svg" alt="SealX Logo" />
                </div>
                <div className='mx-auto px-[41px] w-full flex mt-[91.57px] mb-[24px]'>
                    <Password
                        key="password-input"
                        password={password}
                        className='w-full password-input-wrapper'
                        onChange={handlePasswordChange}
                        readonly={attempt === 0}
                    />
                </div>
                <div className={(attempt === 0 ? 'text-[#F0231E] ' : 'text-[#000]/[60%] ') + ' text-center w-full px-[65px] text-[21px] leading-[28px]'}>
                    {
                        attempt === 0 ? (`Too many incorrect attempts. Your account is locked for ${maxLockTime} minutes. ${countdown} left.`) :
                            (`You have ${attempt} attempt${attempt !== 1 ? 's' : ''} remaining. `)
                    }
                </div>
                <div className=' text-[#000]/[36%] text-[25px] leading-[40px] font-nanum-pen absolute bottom-[32px]  w-full text-center'>
                    What you see is what you sign
                </div>
            </div>
        </div>
    );
}

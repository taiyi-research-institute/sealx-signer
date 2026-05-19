// import { useNavigate } from 'react-router-dom';
import './styles.css';
import { Password } from '../password';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { checkPin, resetSealxPin } from '@src/core/background';
import { useSealXNavigate } from '../../hooks/useSealXNavigate';
import { useGlobalContext } from '@src/hooks/useGlobalContext';
// import { localStorageWrapper } from 'sealx-core';
import { lockLogin } from '../../state/session';
// import { useRequestContext } from '@src/hooks/useRequestContextHook';
import { useSessionStore } from '@src/core/state/session';

export default function ResetPin() {
    // const navigate = useNavigate();
    const [password, setPassword] = useState<string>('');
    const [confirmPassword, setConfirmPassword] = useState<string>('');
    const [errorIndex, setErrorIndex] = useState<number>(-1);
    const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
    const [oldPasswordPass, setOldPasswordPass] = useState<number>(0)
    const navigate = useSealXNavigate()
    const { setAddress } = useGlobalContext()
    const { attempt, setAttempt, lockTime, setLockTime, maxAttempt, maxLockTime } = useGlobalContext()
    const [countdown, setCountdown] = useState<string>(''); // Store formatted countdown
    // const { activeTabHost, request } = useRequestContext()
    const { address } = useGlobalContext()
    const logout = useSessionStore.use.logout()


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
                setCountdown(`${minutes > 0 ? minutes + ' minutes' : ''}${seconds > 0 ? seconds + ' seconds' : ''}`);
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
    const showError = useMemo(() => {
        return errorIndex > -1 || oldPasswordPass === 2
    }, [errorIndex, oldPasswordPass])

    const tip = useMemo(() => {
        if (oldPasswordPass === 1)
            return showConfirmPassword ? (errorIndex > -1 ? 'PIN mismatch. Please press any key to re-enter.' : 'Re-enter the new 6-character PIN.') : ('Reset your 6-character PIN. It must include a mix of numbers (0-9), uppercase letters(A-Z), and lowercase letters (a-z).')
        else if (oldPasswordPass === 2)
            return attempt === 0 ? (`Too many incorrect attempts. Your account is locked for ${maxLockTime} minutes. ${countdown} left.`) :
                (`You have ${attempt} attempt${attempt !== 1 ? 's' : ''} remaining. `)
        else
            return 'Please Input Your Pin Code.'
    }, [attempt, countdown, errorIndex, maxLockTime, oldPasswordPass, showConfirmPassword])

    useEffect(() => {
        if (password.length > 0 && confirmPassword.length > 0 && !password.startsWith(confirmPassword)) {
            setErrorIndex(confirmPassword.length - 1);
        } else {
            setErrorIndex(-1);
        }
    }, [password, confirmPassword]);
    const [old, setOld] = useState<string>('')

    const handlePasswordChange = useCallback(async (value: string) => {
        setPassword(value);
        if (oldPasswordPass !== 1 && value.length === 6) {
            const res = await checkPin(value)
            if (res) {
                //
                // old = value
                setOld(value)
                setOldPasswordPass(1)
                setPassword('')
                setAttempt(maxAttempt)
            } else {
                //
                setOldPasswordPass(2)
                const t = attempt - 1
                setAttempt(t)
                setPassword('')
                if (t === 0) {
                    const now = Date.now();
                    const expire = now + maxLockTime * 60 * 1000
                    await lockLogin(expire)
                    setLockTime(expire);
                    logout()
                }
            }
        } else {
            if (value.length >= 6)
                setTimeout(() => setShowConfirmPassword(value.length >= 6), 200);
        }

    }, [oldPasswordPass, setAttempt, maxAttempt, attempt, maxLockTime, setLockTime, logout, setOld])

    const handleConfirmPassword = useCallback(async (value: string) => {
        setConfirmPassword(value);
        if (value.length === 0 && confirmPassword.length === 0) {
            setTimeout(() => setShowConfirmPassword(false), 200);
        }

        // 判断PIN完成初始化
        if (value === password) {
            const res = await resetSealxPin(address, old, value)
            if (res) {
                // 自动登录
                navigate('/', { replace: true })
                setAddress(res)
            }
        }
    }, [confirmPassword, password, address, old, navigate, setAddress])

    return (
        <div className="login-container ">
            <div className='w-full min-h-full mx-auto relative'>
                <div className='sealx-logo w-full pt-[5rem] font-[500] text-[1.0625rem]'>
                    <img className='m-auto' src="/public/logo/sealx-logo.svg" alt="SealX Logo" />
                </div>
                <div className='mx-auto px-[1.5rem] mt-[5.7231rem] mb-[1.5rem]'>
                    {
                        !showConfirmPassword ? (
                            <Password
                                key="password-input"
                                readonly={attempt === 0}
                                password={password}
                                className='w-full password-input-wrapper'
                                onChange={handlePasswordChange}
                                autoFocus
                            />
                        ) : (
                            <Password
                                key="password-confirm"
                                password={confirmPassword}
                                className='w-full password-confirm-input-wrapper'
                                errorIndex={errorIndex}
                                onChange={handleConfirmPassword}
                                autoFocus
                            />
                        )
                    }
                </div>
                <div className={(showError ? 'text-[#F0231E] ' : 'text-[#000]/60 ') + ' text-center w-full px-[1.5rem] text-[1.3125rem] leading-[1.75]'}>
                    {tip}
                </div>
                <div className=' text-[#000]/36 text-[1.5625rem] leading-[2.5] font-nanum-pen absolute bottom-[32px]  w-full text-center'>Sign What You See</div>
            </div>
        </div>
    );
}

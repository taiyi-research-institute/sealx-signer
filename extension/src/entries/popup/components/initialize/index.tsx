// import { useNavigate } from 'react-router-dom';
import './styles.css';
import { Password } from '../password';
import { useCallback, useEffect, useState } from 'react';
import { initializeSealx, login } from '@src/core/background';
import { useSealXNavigate } from '../../hooks/useSealXNavigate';
import { useGlobalContext } from '@src/hooks/useGlobalContext';
import { useRequestContext } from '@src/hooks/useRequestContextHook';
import { VersionFooter } from '../version-footer';
// import type { SealxRequest } from 'sealx-message';
import type { SealxSession } from 'sealx-core';
// import { useInitializedStore } from '@src/core/state';

export default function Initialize() {
    // const navigate = useNavigate();
    const [password, setPassword] = useState<string>('');
    const [confirmPassword, setConfirmPassword] = useState<string>('');
    const [errorIndex, setErrorIndex] = useState<number>(-1);
    const [isInitializing, setIsInitializing] = useState<boolean>(false);
    const [initProgress, setInitProgress] = useState<number>(0);
    const [initError, setInitError] = useState<string>('');
    // const setAddress = useInitializedStore.use.setAddress()
    const [showConfirmPassword, setShowConfirmPassword] =
        useState<boolean>(false);
    const navigate = useSealXNavigate();
    const { setAddress } = useGlobalContext();
    const { setSession, activeTabHost, request, userId } = useRequestContext();

    const handlePasswordChange = useCallback(
        (value: string) => {
            setPassword(value);
            // Only show confirm password when exactly 6 characters are entered
            if (value.length >= 6) {
                setShowConfirmPassword(true);
            }
        },
        [setPassword]
    );

    const handleConfirmPassword = useCallback(
        async (value: string) => {
            // 如果正在初始化，阻止输入
            if (isInitializing) {
                return;
            }

            setConfirmPassword(value);
            if (value.length === 0 && confirmPassword.length === 0) {
                //setTimeout(() => setShowConfirmPassword(false), 10);
            }

            // 判断PIN完成初始化
            if (value.startsWith(password)) {
                try {
                    // 开始初始化，阻止进一步输入
                    setIsInitializing(true);
                    setInitProgress(0);
                    setInitError('');

                    // 生成随机持续时间 3-5秒
                    const duration = (3000 + Math.random() * 2000);
                    const startTime = Date.now();
                    const updateInterval = 50; // 每50ms更新一次进度

                    // 启动后台初始化任务
                    const initPromise = (async () => {
                        const res = await initializeSealx(value);
                        if (res) {
                            // setAddress(res);
                            const res1 = await login(
                                value,
                                userId,
                                activeTabHost
                            );
                            if (res1) {
                                // setSession(res1);
                                request.reply?.({
                                    session: res1,
                                    account: {
                                        host: res1.host,
                                        userId: userId,
                                        pk: res1.pk
                                    }
                                } as never);
                                return [res, res1];
                            }
                        }
                        return false;
                    })();
                    // 等待初始化完成和进度条走完
                    const [initSuccess] = await Promise.all([initPromise]);
                    if (!initSuccess) {
                        // 初始化失败
                        setInitError(
                            'Initialization failed. Please press any key to try again.'
                        );
                        setIsInitializing(false);
                        setInitProgress(0);
                    }
                    // 进度条动画
                    const progressInterval = setInterval(async () => {
                        const elapsed = Date.now() - startTime;
                        const progress = Math.min(
                            (elapsed / duration) * 100,
                            100
                        );
                        setInitProgress(progress);

                        if (progress >= 100) {
                            setInitProgress(100);
                            clearInterval(progressInterval);
                            await new Promise((resolve) =>
                                setTimeout(resolve, 300)
                            );
                            if (initSuccess instanceof Array) {
                                setAddress(initSuccess[0] as string)
                                setSession(initSuccess[1] as SealxSession)
                            }

                            // 跳转到初始化完成页面
                            navigate('/initialized', {
                                replace: true,
                                state: { fromInitialize: true },
                            });
                        }
                    }, updateInterval);

                    // clearInterval(progressInterval);


                } catch (error) {
                    console.error('Initialization failed:', error);
                    setInitError(
                        'An error occurred during initialization. Please press any key to try again.'
                    );
                    setIsInitializing(false);
                    setInitProgress(0);
                }
            } else {
                if (password.length <= value.length) {
                    setErrorIndex(5);
                    // setConfirmPassword('')
                    // setPassword('')
                    // setShowConfirmPassword(false)
                }
            }
        },
        [
            activeTabHost,
            confirmPassword,
            isInitializing,
            navigate,
            password,
            request,
            setAddress,
            setSession,
            userId,
        ]
    );
    useEffect(() => {
        const handleKeyPress = () => {
            // 如果有初始化错误，按任意键重置
            if (initError) {
                setInitError('');
                setPassword('');
                setConfirmPassword('');
                setShowConfirmPassword(false);
                return;
            }

            if (errorIndex > 4) {
                // Reset all input fields
                setPassword('');
                setConfirmPassword('');
                setErrorIndex(-1);
                setShowConfirmPassword(false);
                // } else if (errorIndex === 5) {
                // setErrorIndex(6);
            }
        };

        window.addEventListener('keydown', handleKeyPress);

        return () => {
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, [errorIndex, initError]);
    return (
        <div className='login-container w-full '>
            <div className='w-full h-full mx-auto relative'>
                <div className='sealx-logo w-full pt-[7.5rem] font-[500] text-[1.0625rem]'>
                    <img
                        className='m-auto'
                        src='/public/logo/sealx-logo.svg'
                        alt='SealX Logo'
                    />
                </div>
                <div className='mx-auto px-[1.5rem] mt-[5.7231rem] mb-[1.5rem]'>
                    {isInitializing ? (
                        <div className='w-full flex justify-center items-center min-h-[60px]'>
                            <div className='flex flex-col items-center w-full'>
                                {/* Progress bar */}
                                <div className='w-full text-[1rem] max-w-[300px] mb-4'>
                                    <div className='text-[#00BE78] text-[0.875rem] text-center mt-2'>
                                        {Math.round(initProgress)}%
                                    </div>
                                    <div className='w-full h-[8px] bg-[#000]/10 rounded-full overflow-hidden'>
                                        <div
                                            className='h-full  bg-[#00BE78] transition-all duration-100 ease-linear'
                                            style={{
                                                width: `${initProgress}%`,
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Loading text with fade animation */}
                                <div className='text-[#000]/80 text-[1.125rem] font-[500] animate-pulse'>
                                    Initializing...
                                </div>
                            </div>
                        </div>
                    ) : !showConfirmPassword ? (
                        <Password
                                key='password-input'
                                password={password}
                                className='w-full password-input-wrapper'
                                onChange={handlePasswordChange}
                                autoFocus
                            />
                        ) : (
                            <Password
                                    key='password-confirm'
                                    password={confirmPassword}
                                    className='w-full password-confirm-input-wrapper'
                                    errorIndex={errorIndex}
                                    onChange={handleConfirmPassword}
                                    autoFocus
                                />
                    )}
                </div>
                <div
                    className={
                        (errorIndex > -1 || initError
                            ? 'text-[#F0231E] '
                            : 'text-[#000]/60 ') +
                        ' text-center w-full px-[1.5rem] text-[1.3125rem] leading-[1.75]'
                    }>
                    {initError
                        ? initError
                        : isInitializing
                            ? 'Please wait while we set up your SealX Signer...'
                            : showConfirmPassword
                                ? errorIndex > -1
                                    ? 'PIN mismatch. Please press any key to re-enter.'
                                    : 'Re-enter the new 6-character PIN.'
                                : 'Set your 6-character PIN. It must include a mix of numbers (0-9), uppercase letters(A-Z), and lowercase letters (a-z).'}
                </div>
                <div className='absolute bottom-[24px] w-full text-center'>
                    <div className='text-[#000]/36 text-[1.5625rem] leading-[2.5] font-nanum-pen'>
                        What you see is what you sign
                    </div>
                    <VersionFooter />
                </div>
            </div>
        </div>
    );
}

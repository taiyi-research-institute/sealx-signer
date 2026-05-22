import { useRef, useMemo, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import './styles.css'

interface PasswordProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
    onChange?: (value: string) => void;
    errorIndex?: number;
    password?: string;
    readonly?: boolean;
    autoFocus?: boolean;
    clickToType?: boolean;
    clickToTypeKey?: string;
}

export const Password = ({
    onChange,
    readonly = false,
    errorIndex = -1,
    password = '',
    autoFocus = false,
    clickToType = false,
    clickToTypeKey = '',
    ...props
}: PasswordProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const passwordRef = useRef(password.slice(0, 6));
    const [draftPassword, setDraftPassword] = useState(password.slice(0, 6));
    const [isFocused, setIsFocused] = useState(false);
    const requestKey = clickToTypeKey || 'default';
    const activationKey = `${requestKey}:${clickToType ? 'manual' : 'direct'}`;
    const [activationState, setActivationState] = useState(() => ({
        key: activationKey,
        activated: !clickToType,
    }));
    const activeRequestKeyRef = useRef(requestKey);
    const isFocusedRef = useRef(false);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const retryCountRef = useRef(0);
    const retrySuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const userLeftRef = useRef(false);
    const previousRequiresClickToTypeRef = useRef(false);
    const MAX_RETRY = 6;
    const displayPassword = draftPassword || password.slice(0, 6);
    const requiresClickToType = clickToType && autoFocus && !readonly;
    const hasUserActivated =
        activationState.key === activationKey
            ? activationState.activated
            : !requiresClickToType;
    const isActivationPending = requiresClickToType && !hasUserActivated && !displayPassword;
    const shouldAutoFocus = autoFocus && !isActivationPending;
    const chars = useMemo(() => displayPassword.padEnd(6, '').split(''), [displayPassword]);
    const activeIndex = useMemo(() => {
        if (errorIndex > -1) return errorIndex;
        const firstEmpty = chars.findIndex(c => !c);
        return firstEmpty !== -1 ? firstEmpty : Math.min(displayPassword.length, 5);
    }, [chars, displayPassword.length, errorIndex]);

    const setUserActivated = useCallback((value: boolean) => {
        setActivationState({
            key: activationKey,
            activated: value,
        });
    }, [activationKey]);

    useEffect(() => {
        if (activeRequestKeyRef.current !== requestKey) {
            activeRequestKeyRef.current = requestKey;
            setActivationState({
                key: activationKey,
                activated: !requiresClickToType,
            });
        }
    }, [activationKey, requestKey, requiresClickToType]);

    useEffect(() => {
        const normalizedPassword = password.slice(0, 6);
        passwordRef.current = normalizedPassword;
        setDraftPassword(normalizedPassword);
        const enteredClickToTypeMode = requiresClickToType && !previousRequiresClickToTypeRef.current;
        const sameRequest = activeRequestKeyRef.current === requestKey;
        if (!normalizedPassword && enteredClickToTypeMode && sameRequest) {
            setUserActivated(false);
            setIsFocused(false);
            isFocusedRef.current = false;
        } else if (!requiresClickToType || normalizedPassword) {
            setUserActivated(true);
        }
        previousRequiresClickToTypeRef.current = requiresClickToType;
    }, [password, requestKey, requiresClickToType, setUserActivated]);

    const focusInput = useCallback(() => {
        if (readonly) return;
        if (isActivationPending) return;
        const input = inputRef.current;
        if (!input) return;
        window.focus();
        input.focus();
        if (document.activeElement === input) {
            input.setSelectionRange(input.value.length, input.value.length);
            if (!isFocusedRef.current) {
                setIsFocused(true);
                isFocusedRef.current = true;
            }
        }
    }, [isActivationPending, readonly]);

    useLayoutEffect(() => {
        if (!shouldAutoFocus) return;
        // Initial staggered retries (fast attempts)
        const timers = [0, 50, 120, 250, 500].map(delay => setTimeout(focusInput, delay));
        const frame = requestAnimationFrame(focusInput);
        // IntersectionObserver: focus when container becomes visible in viewport
        const container = containerRef.current;
        if (container) {
            observerRef.current = new IntersectionObserver(
                (entries) => {
                    if (entries[0]?.isIntersecting) {
                        setTimeout(focusInput, 100);
                    }
                },
                { threshold: 0.1 }
            );
            observerRef.current.observe(container);
        }
        return () => {
            timers.forEach(clearTimeout);
            cancelAnimationFrame(frame);
            observerRef.current?.disconnect();
            observerRef.current = null;
        };
    }, [shouldAutoFocus, focusInput]);

    // Keyboard relay for side panel in browser fullscreen:
    // The side panel doesn't receive keyboard events when the web page has focus.
    // Use chrome.storage.session — ALL tabs' content scripts hear onChanged,
    // so we don't need to know which tab has the content script.
    useEffect(() => {
        if (!shouldAutoFocus || readonly) return;
        if (document.body.getAttribute('popup-mode') !== 'sidepanel') return;
        console.log('[Password:relay] requesting ARM via storage.session');
        chrome.storage.session.set({ sealxArmKeyRelay: Date.now() }).catch(() => {});
        return () => {
            console.log('[Password:relay] unmounting — setting STOP via storage.session');
            chrome.storage.session.set({ sealxArmKeyRelay: 0 }).catch(() => {});
        };
    }, [shouldAutoFocus, readonly]);

    // Fallback polling: retry focus every 500ms for 5s after mount
    // Covers Chrome side panel in browser fullscreen where events may not fire
    useEffect(() => {
        if (!shouldAutoFocus) return;
        const interval = setInterval(focusInput, 500);
        const stopTimer = setTimeout(() => clearInterval(interval), 5000);
        return () => {
            clearInterval(interval);
            clearTimeout(stopTimer);
        };
    }, [shouldAutoFocus, focusInput]);

    // Refocus on visibility change and window events
    useEffect(() => {
        if (!shouldAutoFocus) return;
        const resetRetry = () => {
            retryCountRef.current = 0;
            userLeftRef.current = false;
        };
        const handleVisibility = () => {
            if (!document.hidden) {
                resetRetry();
                setTimeout(focusInput, 300);
            }
        };
        const handleWindowFocus = () => {
            resetRetry();
            setTimeout(focusInput, 200);
        };
        const handlePageShow = () => { setTimeout(focusInput, 30); };
        // Handle window resize — covers browser fullscreen transitions
        const handleResize = () => {
            resetRetry();
            setTimeout(focusInput, 300);
        };
        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('focus', handleWindowFocus);
        window.addEventListener('pageshow', handlePageShow);
        window.addEventListener('resize', handleResize);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('focus', handleWindowFocus);
            window.removeEventListener('pageshow', handlePageShow);
            window.removeEventListener('resize', handleResize);
        };
    }, [shouldAutoFocus, focusInput]);

    // Blur-based re-focus firewall (side panel Chrome focus defense)
    const handleBlurRefocus = useCallback(() => {
        if (readonly) return;
        if (!shouldAutoFocus) return;
        if (document.body.getAttribute('popup-mode') !== 'sidepanel') return;
        if (document.hidden) return;
        if (userLeftRef.current) return;
        if (retryCountRef.current >= MAX_RETRY) return;

        const active = document.activeElement;
        if (active && active !== inputRef.current) {
            const isInteractive =
                active instanceof HTMLInputElement ||
                active instanceof HTMLTextAreaElement ||
                active instanceof HTMLButtonElement ||
                active instanceof HTMLSelectElement ||
                active instanceof HTMLAnchorElement ||
                active.getAttribute('contenteditable') === 'true' ||
                (active as HTMLElement).tabIndex >= 0;
            if (isInteractive) return;
        }

        retryCountRef.current++;
        setTimeout(() => {
            if (inputRef.current && document.activeElement !== inputRef.current) {
                inputRef.current.focus({ preventScroll: true });
            }
        }, 50);
    }, [readonly, shouldAutoFocus]);

    // Pointerdown guard: detect user intentionally leaving the password area
    useEffect(() => {
        if (!shouldAutoFocus || readonly) return;
        const handlePointerDown = (e: PointerEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && containerRef.current?.contains(target)) {
                userLeftRef.current = false;
            } else {
                userLeftRef.current = true;
            }
        };
        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [shouldAutoFocus, readonly]);

    // Stable-focus reset timer (cleaned on unmount)
    const scheduleStableReset = useCallback(() => {
        if (retrySuccessTimerRef.current) clearTimeout(retrySuccessTimerRef.current);
        retrySuccessTimerRef.current = setTimeout(() => {
            retryCountRef.current = 0;
            userLeftRef.current = false;
        }, 500);
    }, []);
    useEffect(() => {
        return () => {
            if (retrySuccessTimerRef.current) clearTimeout(retrySuccessTimerRef.current);
        };
    }, []);

    const emitPasswordChange = useCallback((value: string) => {
        if (readonly) return;
        const nextPassword = value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6);
        if (nextPassword) {
            setUserActivated(true);
        }
        passwordRef.current = nextPassword;
        setDraftPassword(nextPassword);
        onChange?.(nextPassword);
        requestAnimationFrame(focusInput);
    }, [focusInput, onChange, readonly, setUserActivated]);

    const appendCharacter = useCallback((char: string) => {
        emitPasswordChange(`${passwordRef.current}${char}`);
    }, [emitPasswordChange]);

    const removeLastCharacter = useCallback(() => {
        emitPasswordChange(passwordRef.current.slice(0, -1));
    }, [emitPasswordChange]);

    useEffect(() => {
        if (!shouldAutoFocus || readonly) return;
        const handleRelayedKeyDown = (message: Record<string, unknown>) => {
            if (message?.type !== 'sealx-pin-keydown') return;
            const key = typeof message.key === 'string' ? message.key : '';
            console.log('[Password:relayedKey] received via relay:', key);

            if (/^[a-zA-Z0-9]$/.test(key)) {
                appendCharacter(key);
                return;
            }

            if (key === 'Backspace') {
                removeLastCharacter();
            }
        };
        const handleGlobalKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const isOwnInput = inputRef.current === target;
            const isInsidePassword = !!target && !!containerRef.current?.contains(target);
            const isEditableTarget =
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target?.isContentEditable;

            if (isOwnInput) return;
            if (isEditableTarget && !isInsidePassword) return;

            if (/^[a-zA-Z0-9]$/.test(event.key)) {
                event.preventDefault();
                appendCharacter(event.key);
                return;
            }

            if (event.key === 'Backspace') {
                event.preventDefault();
                removeLastCharacter();
            }
        };

        chrome.runtime.onMessage.addListener(handleRelayedKeyDown);
        window.addEventListener('keydown', handleGlobalKeyDown, true);
        return () => {
            chrome.runtime.onMessage.removeListener(handleRelayedKeyDown);
            window.removeEventListener('keydown', handleGlobalKeyDown, true);
        };
    }, [appendCharacter, readonly, removeLastCharacter, shouldAutoFocus]);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        e.preventDefault();
        emitPasswordChange(e.clipboardData.getData('text'));
    }, [emitPasswordChange]);

    const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        emitPasswordChange(event.target.value);
    }, [emitPasswordChange]);

    const isError = (index: number) => errorIndex > -1 && index <= errorIndex;
    const { className = '', onMouseDown, onClick, ...containerProps } = props;
    const activateInput = useCallback(() => {
        setUserActivated(true);
        requestAnimationFrame(focusInput);
    }, [focusInput, setUserActivated]);

    return (
        <div
            {...containerProps}
            ref={containerRef}
            className={`password-container max-w-[436px] mx-auto flex justify-between ${isActivationPending ? 'password-container--activation-pending' : ''} ${className}`}
            onMouseDown={(event) => {
                onMouseDown?.(event);
                activateInput();
            }}
            onClick={(event) => {
                onClick?.(event);
                activateInput();
            }}
            onPaste={handlePaste}
        >
            <input
                ref={inputRef}
                className="password-capture-input"
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={6}
                value={displayPassword}
                readOnly={readonly}
                autoFocus={shouldAutoFocus}
                tabIndex={readonly ? -1 : 0}
                aria-label="PIN"
                onFocus={(event) => {
                    event.currentTarget.setSelectionRange(displayPassword.length, displayPassword.length);
                    if (!isActivationPending) {
                        setIsFocused(true);
                        isFocusedRef.current = true;
                    }
                    scheduleStableReset();
                }}
                onBlur={() => {
                    setIsFocused(false);
                    isFocusedRef.current = false;
                    handleBlurRefocus();
                }}
                onChange={handleInputChange}
                onPaste={handlePaste}
            />
            {/* Always render 6 cells — semi-transparent when awaiting activation */}
            <div className={`password-cells ${isActivationPending ? 'password-cells--pending' : ''}`}>
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className={`password bg-surface-secondary flex items-center justify-center
                            ${i === activeIndex && !isActivationPending ? 'active' : ''}
                            ${isError(i) ? 'error' : ''}
                            ${isActivationPending && i === 0 ? 'password--invite' : ''}`}
                        aria-hidden="true"
                    >
                        {!isActivationPending && chars[i] && <span className="password-mask-dot" />}
                        {isFocused && !isActivationPending && i === activeIndex && displayPassword.length < 6 && (
                            <span className="password-caret" />
                        )}
                    </div>
                ))}
            </div>
            {/* Activation badge overlay — only shown when awaiting click */}
            {isActivationPending && (
                <div className="password-activation-badge" aria-hidden="true">
                    <span>Tap to type PIN</span>
                </div>
            )}
        </div>
    );
};

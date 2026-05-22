import { useRef, useMemo, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import './styles.css'

interface PasswordProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
    onChange?: (value: string) => void;
    errorIndex?: number;
    password?: string;
    readonly?: boolean;
    autoFocus?: boolean;
}

export const Password = ({
    onChange,
    readonly = false,
    errorIndex = -1,
    password = '',
    autoFocus = false,
    ...props
}: PasswordProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const passwordRef = useRef(password.slice(0, 6));
    const [draftPassword, setDraftPassword] = useState(password.slice(0, 6));
    const [isFocused, setIsFocused] = useState(false);
    const isFocusedRef = useRef(false);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const retryCountRef = useRef(0);
    const retrySuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const userLeftRef = useRef(false);
    const MAX_RETRY = 6;
    const displayPassword = draftPassword || password.slice(0, 6);
    const chars = useMemo(() => displayPassword.padEnd(6, '').split(''), [displayPassword]);
    const activeIndex = useMemo(() => {
        if (errorIndex > -1) return errorIndex;
        const firstEmpty = chars.findIndex(c => !c);
        return firstEmpty !== -1 ? firstEmpty : Math.min(displayPassword.length, 5);
    }, [chars, displayPassword.length, errorIndex]);

    useEffect(() => {
        const normalizedPassword = password.slice(0, 6);
        passwordRef.current = normalizedPassword;
        setDraftPassword(normalizedPassword);
    }, [password]);

    const focusInput = useCallback(() => {
        if (readonly) return;
        const input = inputRef.current;
        if (!input) { console.log('[Password:focusInput] no input ref, skipping'); return; }
        const hasDocFocus = document.hasFocus();
        const isHidden = document.hidden;
        const activeEl = document.activeElement?.tagName;
        console.log('[Password:focusInput] calling focus — doc.hasFocus:', hasDocFocus, 'doc.hidden:', isHidden, 'activeElement:', activeEl);
        window.focus();
        input.focus();
        const success = document.activeElement === input;
        console.log('[Password:focusInput] focus result:', success, 'activeElement now:', document.activeElement?.tagName);
        if (success) {
            input.setSelectionRange(input.value.length, input.value.length);
        }
    }, [readonly]);

    useLayoutEffect(() => {
        if (!autoFocus) return;
        console.log('[Password:useLayoutEffect] autoFocus mount — popup-mode:', document.body.getAttribute('popup-mode'), 'hasFocus:', document.hasFocus(), 'hidden:', document.hidden, 'readyState:', document.readyState, 'containerRect:', containerRef.current?.getBoundingClientRect());
        // Initial staggered retries (fast attempts)
        const timers = [0, 50, 120, 250, 500].map(delay => setTimeout(focusInput, delay));
        const frame = requestAnimationFrame(focusInput);
        // IntersectionObserver: focus when container becomes visible in viewport
        const container = containerRef.current;
        if (container) {
            observerRef.current = new IntersectionObserver(
                (entries) => {
                    const entry = entries[0];
                    console.log('[Password:IntersectionObserver] isIntersecting:', entry?.isIntersecting, 'intersectionRatio:', entry?.intersectionRatio);
                    if (entry?.isIntersecting) {
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
    }, [autoFocus, focusInput]);

    // Fallback polling: retry focus every 500ms for 5s after mount
    // Covers Chrome side panel in browser fullscreen where events may not fire
    useEffect(() => {
        if (!autoFocus) return;
        console.log('[Password:polling] starting 5s polling');
        let attempt = 0;
        const interval = setInterval(() => {
            attempt++;
            console.log('[Password:polling] attempt', attempt);
            focusInput();
        }, 500);
        const stopTimer = setTimeout(() => {
            console.log('[Password:polling] stopped after 5s');
            clearInterval(interval);
        }, 5000);
        return () => {
            clearInterval(interval);
            clearTimeout(stopTimer);
        };
    }, [autoFocus, focusInput]);

    // Refocus on visibility change and window events
    useEffect(() => {
        if (!autoFocus) return;
        const resetRetry = () => {
            retryCountRef.current = 0;
            userLeftRef.current = false;
        };
        const handleVisibility = () => {
                console.log('[Password:event] visibilitychange — hidden:', document.hidden, 'hasFocus:', document.hasFocus());
            if (!document.hidden) {
                resetRetry();
                setTimeout(focusInput, 300);
            }
        };
        const handleWindowFocus = () => {
            console.log('[Password:event] window.focus — hasFocus:', document.hasFocus());
            resetRetry();
            setTimeout(focusInput, 200);
        };
        const handlePageShow = () => {
            console.log('[Password:event] pageshow');
            setTimeout(focusInput, 30);
        };
        // Handle window resize — covers browser fullscreen transitions
        const handleResize = () => {
            console.log('[Password:event] resize —', window.innerWidth, 'x', window.innerHeight);
            resetRetry();
            setTimeout(focusInput, 300);
        };
        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('focus', handleWindowFocus);
        window.addEventListener('pageshow', handlePageShow);
        window.addEventListener('resize', handleResize);
        document.addEventListener('DOMContentLoaded', () => console.log('[Password:event] DOMContentLoaded'));
        console.log('[Password:events] listeners registered — readyState:', document.readyState);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('focus', handleWindowFocus);
            window.removeEventListener('pageshow', handlePageShow);
            window.removeEventListener('resize', handleResize);
        };
    }, [autoFocus, focusInput]);

    // Blur-based re-focus firewall (side panel Chrome focus defense)
    const handleBlurRefocus = useCallback(() => {
        console.log('[Password:blur] onBlur fired — retryCount:', retryCountRef.current, 'MAX:', MAX_RETRY);
        if (readonly) return;
        if (!autoFocus) return;
        if (document.body.getAttribute('popup-mode') !== 'sidepanel') { console.log('[Password:blur] not sidepanel, skipping'); return; }
        if (document.hidden) { console.log('[Password:blur] document hidden, skipping'); return; }
        if (userLeftRef.current) { console.log('[Password:blur] user left, skipping'); return; }
        if (retryCountRef.current >= MAX_RETRY) { console.log('[Password:blur] max retries reached, skipping'); return; }

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
    }, [autoFocus, readonly]);

    // Pointerdown guard: detect user intentionally leaving the password area
    useEffect(() => {
        if (!autoFocus || readonly) return;
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
    }, [autoFocus, readonly]);

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
        passwordRef.current = nextPassword;
        setDraftPassword(nextPassword);
        onChange?.(nextPassword);
        requestAnimationFrame(focusInput);
    }, [focusInput, onChange, readonly]);

    const appendCharacter = useCallback((char: string) => {
        emitPasswordChange(`${passwordRef.current}${char}`);
    }, [emitPasswordChange]);

    const removeLastCharacter = useCallback(() => {
        emitPasswordChange(passwordRef.current.slice(0, -1));
    }, [emitPasswordChange]);

    useEffect(() => {
        if (!autoFocus || readonly) return;
        const handleRelayedKeyDown = (message: Record<string, unknown>) => {
            if (message?.type !== 'sealx-pin-keydown') return;
            const key = typeof message.key === 'string' ? message.key : '';

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
    }, [appendCharacter, autoFocus, readonly, removeLastCharacter]);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        e.preventDefault();
        emitPasswordChange(e.clipboardData.getData('text'));
    }, [emitPasswordChange]);

    const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        emitPasswordChange(event.target.value);
    }, [emitPasswordChange]);

    const isError = (index: number) => errorIndex > -1 && index <= errorIndex;
    const { className = '', onMouseDown, onClick, ...containerProps } = props;

    return (
        <div
            {...containerProps}
            ref={containerRef}
            className={`password-container max-w-[436px] mx-auto flex justify-between ${className}`}
            onMouseDown={(event) => {
                onMouseDown?.(event);
                focusInput();
            }}
            onClick={(event) => {
                onClick?.(event);
                focusInput();
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
                autoFocus={autoFocus}
                tabIndex={readonly ? -1 : 0}
                aria-label="PIN"
                onFocus={(event) => {
                    event.currentTarget.setSelectionRange(displayPassword.length, displayPassword.length);
                    setIsFocused(true);
                    isFocusedRef.current = true;
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
            {Array.from({ length: 6 }).map((_, i) => (
                <div
                    key={i}
                    className={`password bg-surface-secondary flex items-center justify-center
                        ${i === activeIndex ? 'active' : ''}
                        ${isError(i) ? 'error' : ''}`}
                    aria-hidden="true"
                >
                    {chars[i] && <span className="password-mask-dot" />}
                    {isFocused && i === activeIndex && displayPassword.length < 6 && (
                        <span className="password-caret" />
                    )}
                </div>
            ))}
        </div>
    );
};

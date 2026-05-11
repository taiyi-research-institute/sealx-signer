import { useRef, useMemo, useCallback, useEffect } from 'react';
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
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const chars = useMemo(() => password.padEnd(6, '').split(''), [password]);

    // Auto-focus first empty input on mount
    useEffect(() => {
        if (!autoFocus) return;
        const timer = setTimeout(() => {
            const firstEmpty = chars.findIndex(c => !c || c === '\0');
            const idx = firstEmpty !== -1 ? firstEmpty : Math.min(password.length, 5);
            inputRefs.current[idx]?.focus();
        }, 100);
        return () => clearTimeout(timer);
    }, [autoFocus, chars, password.length]);

    // Refocus on visibility change
    useEffect(() => {
        const handleVisibility = () => {
            if (!document.hidden) {
                const firstEmpty = errorIndex > -1
                    ? errorIndex
                    : chars.findIndex(c => !c || c === '\0');
                const idx = firstEmpty !== -1 ? firstEmpty : Math.min(password.length, 5);
                setTimeout(() => inputRefs.current[idx]?.focus(), 100);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [chars, password, errorIndex]);

    const handleChange = useCallback((index: number, value: string) => {
        if (readonly) return;
        const char = value.slice(-1); // only take last character
        if (char && !/^[a-zA-Z0-9]$/.test(char)) return;

        const newChars = [...chars];
        if (char) {
            newChars[index] = char;
        } else {
            newChars[index] = '';
        }
        const newPassword = newChars.join('').replace(/\0/g, '').slice(0, 6);
        onChange?.(newPassword);

        // Auto-advance to next input
        if (char && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    }, [chars, readonly, onChange]);

    const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !chars[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === 'ArrowLeft' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    }, [chars]);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').slice(0, 6);
        if (/^[a-zA-Z0-9]{1,6}$/.test(pasted)) {
            onChange?.(pasted);
            // Focus the next empty or last position
            const idx = Math.min(pasted.length, 5);
            inputRefs.current[idx]?.focus();
        }
    }, [onChange]);

    const handleFocus = useCallback((index: number) => {
        // Select all text in the input for easy overwrite
        inputRefs.current[index]?.select();
    }, []);

    const isError = (index: number) => errorIndex > -1 && index <= errorIndex;

    return (
        <div {...props} className={`password-container flex justify-between ${props.className || ''}`}>
            {Array.from({ length: 6 }).map((_, i) => (
                <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el; }}
                    type="password"
                    inputMode="text"
                    autoComplete="off"
                    maxLength={1}
                    value={chars[i] || ''}
                    readOnly={readonly}
                    autoFocus={autoFocus && i === 0}
                    onChange={e => handleChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    onFocus={() => handleFocus(i)}
                    className={`password bg-surface-secondary flex items-center justify-center
                        ${isError(i) ? 'error' : ''}`}
                    aria-label={`PIN digit ${i + 1}`}
                />
            ))}
        </div>
    );
};

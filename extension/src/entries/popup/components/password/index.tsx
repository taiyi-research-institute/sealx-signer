import './styles.css'
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

interface PasswordProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
    onChange?: (value: string) => void;
    errorIndex?: number;
    password?: string;
    readonly?: boolean
    seePassword?: boolean
}

export const Password = ({ onChange, readonly = false, errorIndex = -1, password = '', seePassword = false, ...props }: PasswordProps) => {
    const [digits, setDigits] = useState<string[]>([...Array(6).fill('')]);
    const divRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [focusedIndex, setFocusedIndex] = useState<number>(0);
    const passwordRegex = useMemo(() => /^[0-9a-zA-Z]{1}$/, []);
    const [isPasting, setIsPasting] = useState(false);
    const lastInputTimeRef = useRef<number>(0);
    const pendingFocusIndexRef = useRef<number | null>(null);

    // 页面切换到前台时自动获取焦点
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                // 找到第一个为空的输入框
                const firstEmptyIndex = errorIndex > -1 ? errorIndex : digits.findIndex(digit => !digit);
                const targetIndex = firstEmptyIndex !== -1 ? firstEmptyIndex : Math.min(password.length, 5);
                setFocusedIndex(targetIndex);
                setTimeout(() => divRefs.current[targetIndex]?.focus(), 100);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [digits, password, errorIndex]);

    // 优化光标管理 - 处理错误状态和正常状态的光标
    useEffect(() => {
        // 清除所有输入框的光标
        divRefs.current.forEach((ref) => {
            if (ref) {
                // 移除光标span
                const caretSpan = ref.querySelector('.password-caret');
                if (caretSpan) {
                    caretSpan.remove();
                }

                // 重新设置内容，只显示字符
                const char = ref.getAttribute('data-char') || '';
                ref.textContent = char;
            }
        });

        // 错误状态下，光标在最后一个字符的位置
        if (errorIndex > -1) {
            const lastCharIndex = Math.max(0, password.length - 1);
            if (divRefs.current[lastCharIndex]) {
                const char = divRefs.current[lastCharIndex].getAttribute('data-char') || '';
                divRefs.current[lastCharIndex].textContent = '';
                const caretSpan = document.createElement('span');
                caretSpan.className = 'password-caret';
                divRefs.current[lastCharIndex].appendChild(document.createTextNode(char));
                divRefs.current[lastCharIndex].appendChild(caretSpan);
                divRefs.current[lastCharIndex]?.focus();
            }
        } else {
            // 正常状态下，只在当前焦点输入框显示光标
            if (divRefs.current[focusedIndex]) {
                const char = divRefs.current[focusedIndex].getAttribute('data-char') || '';
                divRefs.current[focusedIndex].textContent = '';
                const caretSpan = document.createElement('span');
                caretSpan.className = 'password-caret';
                divRefs.current[focusedIndex].appendChild(document.createTextNode(char));
                divRefs.current[focusedIndex].appendChild(caretSpan);
                divRefs.current[focusedIndex]?.focus();
            }
        }
    }, [focusedIndex, errorIndex, password]);

    // 优化密码同步逻辑 - 只更新字符显示，不操作光标
    useEffect(() => {
        const items = Array.from({ length: 6 }, (_, i) => password[i] || '');

        // 批量更新DOM，只更新字符显示，不操作光标
        items.forEach((char, index) => {
            if (divRefs.current[index]) {
                const displayChar = char ? (seePassword ? char : '*') : '';
                divRefs.current[index]?.setAttribute('data-char', displayChar);

                // 只更新字符内容，不添加光标
                const currentCaret = divRefs.current[index].querySelector('.password-caret');
                if (currentCaret) {
                    // 如果当前有光标，保留光标
                    divRefs.current[index].textContent = '';
                    const textNode = document.createTextNode(displayChar);
                    divRefs.current[index].appendChild(textNode);
                    divRefs.current[index].appendChild(currentCaret);
                } else {
                    // 如果没有光标，只显示字符
                    divRefs.current[index].textContent = displayChar;
                }
            }
        });

        // 优化焦点位置设置
        if (errorIndex === -1) {
            const newFocusedIndex = Math.min(password.length, 5);
            setFocusedIndex(newFocusedIndex);
        }

        setDigits(items);
    }, [focusedIndex, errorIndex, seePassword, password]);

    // 优化的键盘处理函数 - 防止长按连续输入
    const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLDivElement>) => {
        // 检查是否是粘贴快捷键 (Ctrl+V 或 Cmd+V)
        const isPasteShortcut = (e.ctrlKey || e.metaKey) && e.key === 'v';
        console.log('--------- key down ------', e.key, index, digits[index], '----------')
        // 如果不是粘贴快捷键，阻止默认行为
        if (!isPasteShortcut) {
            e.preventDefault();
        }

        lastInputTimeRef.current = Date.now();

        // 错误状态下只允许Backspace操作
        if (errorIndex > -1) {
            return;
        }

        if (e.key === 'Backspace') {
            const newDigits = [...digits];

            if (digits[index]) {
                // 清除当前数字
                newDigits[index] = '';
                updateDigitDisplay(index, '');
            } else if (index > 0) {
                // 清除前一个数字
                newDigits[index - 1] = '';
                updateDigitDisplay(index - 1, '');
                // 记录需要移动到的前一个输入框，在keyup时处理
                pendingFocusIndexRef.current = index - 1;
                setFocusedIndex(index - 1)
            }

            const newPassword = newDigits.join('');
            onChange?.(newPassword);
            setDigits(newDigits);

        } else if (e.key === 'Enter' || e.key === 'Tab') {
            if (digits.every(digit => digit)) {
                onChange?.(digits.join(''));
            }
        } else if (passwordRegex.test(e.key)) {
            // TODO 如果点击了其他按键index主动加1，定位到下一个输入框，不用等待keyup事件响应完成
            if (digits[index] !== e.key) {
                index++
                setFocusedIndex(index)
            }
            // 直接处理有效字符输入
            const newDigits = [...digits];
            newDigits[index] = e.key;
            updateDigitDisplay(index, e.key);

            const newPassword = newDigits.join('');
            console.log('---- change password ----', digits, newDigits, password, index)
            onChange?.(newPassword);
            setDigits(newDigits);

            // 记录需要移动到的下一个输入框，在keyup时处理
            if (index < 5) {
                pendingFocusIndexRef.current = index + 1;
            }
        }
    }, [digits, onChange, passwordRegex, errorIndex, password]);

    // 键盘释放处理函数 - 在按钮释放时设置下一个输入框的焦点
    const handleKeyUp = useCallback((index: number, e: React.KeyboardEvent<HTMLDivElement>) => {
        // 在有效字符按键或Backspace按键释放时处理焦点移动
        if (focusedIndex > index || password.length - 1 > index) {
            return
        }
        if ((passwordRegex.test(e.key) || e.key === 'Backspace') && pendingFocusIndexRef.current !== null) {
            const nextIndex = pendingFocusIndexRef.current;
            pendingFocusIndexRef.current = null;
            setFocusedIndex(nextIndex);
        }
    }, [passwordRegex, focusedIndex, password]);

    // 优化的输入处理函数
    const handleInput = useCallback((index: number, e: React.FormEvent<HTMLDivElement>) => {
        const text = e.currentTarget.textContent || '';

        if (isPasting) {
            if (text.length > 1 && divRefs.current[index]) {
                updateDigitDisplay(index, '*');
            }
            return;
        }

        if (text.length > 0 && errorIndex === -1) {
            const char = text[text.length - 1];

            if (passwordRegex.test(char)) {
                const newDigits = [...digits];
                newDigits[index] = char;
                updateDigitDisplay(index, char);

                const newPassword = newDigits.join('');
                onChange?.(newPassword);
                setDigits(newDigits);

                // 记录需要移动到的下一个输入框，在keyup时处理
                if (index < 5) {
                    pendingFocusIndexRef.current = index + 1;
                }
            }

            // 立即清空输入内容，避免重复处理
            e.currentTarget.textContent = '';
        }
    }, [isPasting, errorIndex, passwordRegex, digits, onChange]);

    // 统一的数字显示更新函数 - 只更新字符，不操作光标
    const updateDigitDisplay = useCallback((index: number, char: string) => {
        if (divRefs.current[index]) {
            const displayChar = char ? (seePassword ? char : '*') : '';
            divRefs.current[index].setAttribute('data-char', displayChar);

            // 只更新字符内容，不添加光标
            const currentCaret = divRefs.current[index].querySelector('.password-caret');
            if (currentCaret) {
                // 如果当前有光标，保留光标
                divRefs.current[index].textContent = '';
                const textNode = document.createTextNode(displayChar);
                divRefs.current[index].appendChild(textNode);
                divRefs.current[index].appendChild(currentCaret);
            } else {
                // 如果没有光标，只显示字符
                divRefs.current[index].textContent = displayChar;
            }
        }
    }, [seePassword]);

    // 优化的焦点处理 - 防止失焦
    const onFocus = useCallback((index: number) => {
        if (focusedIndex !== index) return;
        lastInputTimeRef.current = Date.now();
        setFocusedIndex(index);
    }, [focusedIndex]);

    // 防止失焦的处理 - 防止当前输入框失去焦点
    const onBlur = useCallback((_index: number) => {
        // 如果当前失去焦点的输入框是当前焦点索引，立即重新获取焦点
        if (focusedIndex === _index && focusedIndex< digits.length&&!digits[focusedIndex]) {
            // 使用setTimeout确保在React更新周期后重新获取焦点
            setTimeout(() => {
                if (divRefs.current[_index]) {
                    divRefs.current[_index]?.focus();
                }
            }, 0);
        }
    }, [focusedIndex]);

    // 移除全局焦点保护 - 允许用户手动控制焦点

    // 粘贴处理优化
    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
        e.stopPropagation();
        e.preventDefault();

        const pastedData = e.clipboardData?.getData('text');
        if (pastedData && pastedData.length <= 6) {
            setIsPasting(true);
            onChange?.(pastedData);
            setTimeout(() => setIsPasting(false), 100);
        }
    }, [onChange]);

    return (
        <div {...props} className={`password-container flex justify-between ${props.className || ''}`}>
            {digits.map((_, index) => (
                <div
                    key={index}
                    id={`password-item-${index}`}
                    ref={el => { if (el) divRefs.current[index] = el }}
                    contentEditable={!readonly}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onKeyUp={(e) => handleKeyUp(index, e)}
                    onInput={(e) => handleInput(index, e)}
                    onPaste={handlePaste}
                    onFocus={() => onFocus(index)}
                    onBlur={() => onBlur(index)}
                    aria-readonly={readonly}
                    data-char=""
                    className={`password bg-[#000]/[5%] flex items-center justify-center text-4xl ${errorIndex !== -1 && index <= errorIndex ? ' error' : ''
                        }`}
                    suppressContentEditableWarning
                >
                    <span className='password-caret'></span>
                </div>
            ))}
        </div>
    );
}

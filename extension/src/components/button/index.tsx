import type React from "react"
import './styles.css'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /** Button type - primary (black background) or secondary (outline) */
    variant?: 'primary' | 'secondary'
    /** Whether the button is disabled */
    disabled?: boolean
    /** Loading state - shows spinner and disables button */
    loading?: boolean
    /** Custom CSS class */
    className?: string
    /** Button content */
    children: React.ReactNode
    /** Click handler */
    onClick?: React.MouseEventHandler<HTMLButtonElement>
}

/**
 * A reusable button component with two variants: primary and secondary
 * 
 * Primary variant: Black background, white text, hover effects
 * Secondary variant: Transparent background, black border and text, green hover effects
 * 
 * @param {ButtonProps} props - Component props
 * @returns A styled button element
 */
const Button = ({
    variant = 'primary',
    disabled = false,
    loading = false,
    className = '',
    children,
    onClick,
    ...props
}: ButtonProps) => {
    // Base styles common to all buttons
    const baseStyles = 'sealx-button rounded-[10px] border font-[800] text-[1rem] leading-[1.5] min-h-[48px] pt-[0.625rem] pb-[0.625rem] transition-all duration-150'

    // Padding styles based on variant
    const paddingStyles = variant === 'primary'
        ? 'pl-[1.5rem] pr-[1.5rem] primary-padding'
        : 'pl-[1.5rem] pr-[1.5rem] secondary-padding'

    // Variant-specific styles
    const variantStyles = {
        primary: disabled || loading
            ? 'bg-[#101820]/56 text-[#fff] border-[#101820]/0 cursor-not-allowed shadow-none'
            : 'bg-[#101820] text-[#fff] border-[#101820] hover:border-[#101820]! hover:shadow-[0_10px_20px_rgba(16,24,32,0.14)] active:translate-y-[1px] cursor-pointer',
        secondary: disabled || loading
            ? 'bg-transparent text-[#5a6677]/56 border-[#dce3ea] cursor-not-allowed shadow-none'
            : 'bg-[#fff] text-[#344052] border-[#cfd8e2] hover:border-[#0aa06e]/50 hover:bg-[#ecf8f3] active:translate-y-[1px] cursor-pointer'
    }

    // Width styles - primary buttons have fixed width, secondary buttons adjust to content
    // const widthStyles = variant === 'primary' ? 'w-[346px]' : ''

    return (
        <button
            type="button"
            disabled={disabled || loading}
            onClick={onClick}
            className={`
        ${baseStyles}
        ${paddingStyles}
        ${variantStyles[variant]}
        ${className}
      `.trim()}
            {...props}
        >
            {loading && (
                <span className="inline-flex items-center mr-[0.5rem]" aria-hidden="true">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                </span>
            )}
            {children}
        </button>
    )
}

export default Button

import type React from "react"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /** Button type - primary (black background) or secondary (outline) */
    variant?: 'primary' | 'secondary'
    /** Whether the button is disabled */
    disabled?: boolean
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
    className = '',
    children,
    onClick,
    ...props
}: ButtonProps) => {
    // Base styles common to all buttons
    const baseStyles = 'rounded-[34px] border-2 font-[500] text-[1.5rem] leading-[1.75] pt-[1.125rem] pb-[1.375rem] transition-all duration-200'

    // Padding styles based on variant
    const paddingStyles = variant === 'primary'
        ? 'pl-[3.6106rem] pr-[3.6394rem]'
        : 'pl-[3.2981rem] pr-[3.3269rem]'

    // Variant-specific styles
    const variantStyles = {
        primary: disabled
            ? 'bg-gray-400 text-[#fff] border-inherit! hover:border-inherit!   bg-[#000]/60 cursor-not-allowed'
            : 'bg-[#000] text-[#fff] border-[#000] hover:border-[#000]! hover:scale-105 cursor-pointer',
        secondary: disabled
            ? 'bg-transparent text-[#000]/60 border-[rgba(0,0,0,0.3)] cursor-not-allowed'
            : 'bg-transparent text-[#000] border-[rgba(0,0,0,0.06)] hover:border-[#00be78]/30 hover:bg-[#00be78]/10 hover:scale-105 cursor-pointer'
    }

    // Width styles - primary buttons have fixed width, secondary buttons adjust to content
    // const widthStyles = variant === 'primary' ? 'w-[346px]' : ''

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={`
        ${baseStyles}
        ${paddingStyles}
        ${variantStyles[variant]}
        ${className}
      `.trim()}
            {...props}
        >
            {children}
        </button>
    )
}

export default Button

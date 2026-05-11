import type React from "react"

/**
 * A radio button component that allows selecting between multiple options
 * 
 * @template T - The type of the value for each radio item
 */
export interface RadioItem<T = unknown> {
    label: string
    value: T
}

interface RadioProps<T> extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
    /** Currently selected value */
    selected: T
    /** Array of items to display (can be strings or RadioItem objects) */
    items: Array<RadioItem<T> | string>
    /** Callback when selection changes */
    onChange?: (value: T) => void
}

/**
 * A customizable radio button component
 * 
 * @param {RadioProps} props - Component props
 * @returns A radio button control with the specified items
 */
const Radio = <T,>({ selected, items, onChange, ...props }: RadioProps<T>) => {
    return (
        <div {...props} className={`flex flex-col gap-[24px] ${props.className ?? ''}`}>
            {items.map((item, index) => {
                // Normalize item to handle both string and RadioItem cases
                // Handle both string and RadioItem cases with proper typing
                const normalizedItem = typeof item === 'string' ?
                    { label: item, value: item as T } :
                    item;

                // Determine if current item is selected
                const isSelected = selected === normalizedItem.value;

                return (
                    <div
                        key={index}
                        className="flex items-center gap-x-[6px] cursor-pointer"
                        onClick={() => {
                            if (onChange) {
                                onChange(normalizedItem.value);
                            }
                        }}
                    >
                        {/* Radio button circle */}
                        <div className={`w-[16px] h-[16px] rounded-full border-2 flex items-center justify-center mr-3 ${isSelected ? 'border-[#00be78]' : 'border border-black/20'}`}>
                            {isSelected && (
                                <div className="w-[10px] h-[10px] rounded-full bg-[#00be78]"></div>
                            )}
                        </div>
                        {/* Label */}
                        <span className={`text-[16px] font-[500] ${isSelected ? 'text-[#00be78]' : 'text-text-secondary'}`}>
                            {normalizedItem.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export default Radio;

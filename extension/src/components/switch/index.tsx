import type React from "react"

/**
 * A switch component that allows selecting between multiple options
 * 
 * @template T - The type of the value for each switch item
 */
export interface SwitchItem<T = unknown> {
    label: string
    value: T
}

interface SwitchProps<T> extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
    /** Currently selected value */
    selected: T
    /** Array of items to display (can be strings or SwitchItem objects) */
    items: Array<SwitchItem<T> | string>
    /** Callback when selection changes */
    onChange?: (value: T) => void
}

/**
 * A customizable switch/segmented control component
 * 
 * @param {SwitchProps} props - Component props
 * @returns A switch control with the specified items
 */
const Switch = <T,>({ selected, items, onChange, ...props }: SwitchProps<T>) => {
    return (
        <div {...props} className={`flex justify-between p-[3px] ${props.className ?? ''}`}>
            {items.map((item, index) => {
                // Normalize item to handle both string and SwitchItem cases
                // Handle both string and SwitchItem cases with proper typing
                const normalizedItem = typeof item === 'string' ?
                    { label: item, value: item as T } :
                    item;

                // Determine if current item is selected
                const isSelected = selected === normalizedItem.value;

                return (
                    <span
                        key={index}
                        className={`${isSelected ? 'switch-selected bg-[#fff]' : ''} switch-item flex-1 px-[13.5px] pt-[4px] pb-[5px] rounded-[17px] cursor-pointer`}
                        onClick={() => {
                            if (onChange) {
                                onChange(normalizedItem.value);
                            }
                        }}
                    >
                        {normalizedItem.label}
                    </span>
                );
            })}
        </div>
    );
};

export default Switch;

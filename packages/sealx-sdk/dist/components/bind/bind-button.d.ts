/**
 * @file SealX Bind Button Component
 * @module sealx-sdk/components/bind/bind-button
 * @description A custom HTML element for binding public keys with SealX extension
 *
 * @example
 * ```html
 * <!-- Basic usage -->
 * <sealx-bind-button user-id="user123"></sealx-bind-button>
 *
 * <!-- With custom text -->
 * <sealx-bind-button
 *   user-id="user123"
 *   button-text="Connect Wallet"
 *   loading-text="Binding..."
 *   success-text="Bound Successfully!"
 *   error-text="Binding Failed">
 * </sealx-bind-button>
 *
 * <!-- With event listeners -->
 * <script>
 *   const button = document.querySelector('sealx-bind-button');
 *   button.addEventListener('bind-success', (e) => {
 *     console.log('Public key bound:', e.detail.publicKey);
 *   });
 *   button.addEventListener('bind-error', (e) => {
 *     console.error('Binding failed:', e.detail.error);
 *   });
 * </script>
 * ```
 */
/**
 * Custom HTML element for SealX public key binding
 *
 * @element sealx-bind-button
 *
 * @attr {string} user-id - User identifier for binding
 * @attr {string} button-text - Text to display on the button (default: "Bind Public Key")
 * @attr {string} loading-text - Text to display while binding (default: "Binding...")
 * @attr {string} success-text - Text to display on success (default: "Bound Successfully!")
 * @attr {string} error-text - Text to display on error (default: "Binding Failed")
 * @attr {boolean} disabled - Whether the button is disabled
 * @attr {string} variant - Button style variant: "primary" | "secondary" | "outline" (default: "primary")
 * @attr {string} size - Button size: "small" | "medium" | "large" (default: "medium")
 *
 * @fires bind-start - Fired when binding process starts
 * @fires bind-success - Fired when binding succeeds, detail contains { publicKey: string }
 * @fires bind-error - Fired when binding fails, detail contains { error: Error }
 *
 * @csspart button - The internal button element for styling
 * @csspart text - The text content inside the button
 * @csspart spinner - The loading spinner (when loading)
 *
 * @example
 * ```css
 * sealx-bind-button {
 *   --sealx-primary-color: #007bff;
 *   --sealx-secondary-color: #6c757d;
 *   --sealx-border-radius: 4px;
 *   --sealx-font-family: inherit;
 * }
 *
 * sealx-bind-button::part(button) {
 *   font-weight: bold;
 * }
 * ```
 */
export declare class SealxBindButton extends HTMLElement {
    /**
     * Observed attributes for the custom element
     */
    static get observedAttributes(): string[];
    private _userId;
    private _buttonText;
    private _loadingText;
    private _successText;
    private _errorText;
    private _disabled;
    private _variant;
    private _size;
    private _isLoading;
    private _button;
    private _textSpan;
    private _spinner;
    constructor();
    /**
     * Lifecycle: Called when element is connected to DOM
     */
    connectedCallback(): void;
    /**
     * Lifecycle: Called when observed attributes change
     */
    attributeChangedCallback(name: string, oldValue: string, newValue: string): void;
    /**
     * Get the current user ID
     */
    get userId(): string;
    /**
     * Set the user ID
     */
    set userId(value: string);
    /**
     * Get the button text
     */
    get buttonText(): string;
    /**
     * Set the button text
     */
    set buttonText(value: string);
    /**
     * Get the disabled state
     */
    get disabled(): boolean;
    /**
     * Set the disabled state
     */
    set disabled(value: boolean);
    /**
     * Get the variant
     */
    get variant(): string;
    /**
     * Set the variant
     */
    set variant(value: string);
    /**
     * Get the size
     */
    get size(): string;
    /**
     * Set the size
     */
    set size(value: string);
    /**
     * Manually trigger the binding process
     * @returns Promise that resolves with the bound public key or rejects with error
     */
    bind(): Promise<string>;
    /**
     * Reset the button to its initial state
     */
    reset(): void;
    /**
     * Handle button click
     */
    private _handleClick;
    /**
     * Perform the actual binding process
     */
    private _performBinding;
    /**
     * Show success state
     */
    private _showSuccess;
    /**
     * Show error state
     */
    private _showError;
    /**
     * Update button state based on disabled flag
     */
    private _updateButtonState;
    /**
     * Update button styles based on variant and size
     */
    private _updateStyles;
    /**
     * Get CSS styles for the component
     */
    private _getStyles;
}
/**
 * Utility function to create a SealX bind button programmatically
 *
 * @param options - Configuration options for the button
 * @returns The created SealxBindButton element
 *
 * @example
 * ```typescript
 * const button = createSealxBindButton({
 *   userId: 'user123',
 *   buttonText: 'Connect Wallet',
 *   variant: 'primary',
 *   size: 'medium'
 * });
 *
 * document.body.appendChild(button);
 *
 * button.addEventListener('bind-success', (e) => {
 *   console.log('Bound public key:', e.detail.publicKey);
 * });
 * ```
 */
export declare function createSealxBindButton(options: {
    userId: string;
    buttonText?: string;
    loadingText?: string;
    successText?: string;
    errorText?: string;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'outline';
    size?: 'small' | 'medium' | 'large';
}): SealxBindButton;

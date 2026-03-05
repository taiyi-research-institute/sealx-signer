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

import { bindSealx, initSealx, isSealxActive } from '../../index.js';

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
export class SealxBindButton extends HTMLElement {
    /**
     * Observed attributes for the custom element
     */
    static get observedAttributes() {
        return [
            'user-id',
            'button-text',
            'loading-text',
            'success-text',
            'error-text',
            'disabled',
            'variant',
            'size'
        ];
    }

    private _userId: string = '';
    private _buttonText: string = 'Bind Public Key';
    private _loadingText: string = 'Binding...';
    private _successText: string = 'Bound Successfully!';
    private _errorText: string = 'Binding Failed';
    private _disabled: boolean = false;
    private _variant: 'primary' | 'secondary' | 'outline' = 'primary';
    private _size: 'small' | 'medium' | 'large' = 'medium';

    private _isLoading: boolean = false;
    private _button: HTMLButtonElement;
    private _textSpan: HTMLSpanElement;
    private _spinner: HTMLDivElement;

    constructor() {
        super();

        // Create shadow DOM for encapsulation
        const shadow = this.attachShadow({ mode: 'open' });

        // Create styles
        const style = document.createElement('style');
        style.textContent = this._getStyles();

        // Create button element
        this._button = document.createElement('button');
        this._button.setAttribute('part', 'button');
        this._button.type = 'button';

        // Create text span
        this._textSpan = document.createElement('span');
        this._textSpan.setAttribute('part', 'text');
        this._textSpan.textContent = this._buttonText;

        // Create spinner
        this._spinner = document.createElement('div');
        this._spinner.setAttribute('part', 'spinner');
        this._spinner.style.display = 'none';
        this._spinner.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.3"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
      </svg>
    `;

        // Assemble the button
        this._button.appendChild(this._spinner);
        this._button.appendChild(this._textSpan);

        // Add click handler
        this._button.addEventListener('click', () => this._handleClick());

        // Append to shadow DOM
        shadow.appendChild(style);
        shadow.appendChild(this._button);

        // Update initial styles
        this._updateStyles();
    }

    /**
     * Lifecycle: Called when element is connected to DOM
     */
    connectedCallback() {
        this._updateButtonState();
    }

    /**
     * Lifecycle: Called when observed attributes change
     */
    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if (oldValue === newValue) return;

        switch (name) {
            case 'user-id':
                this._userId = newValue;
                break;
            case 'button-text':
                this._buttonText = newValue || 'Bind Public Key';
                if (!this._isLoading) {
                    this._textSpan.textContent = this._buttonText;
                }
                break;
            case 'loading-text':
                this._loadingText = newValue || 'Binding...';
                break;
            case 'success-text':
                this._successText = newValue || 'Bound Successfully!';
                break;
            case 'error-text':
                this._errorText = newValue || 'Binding Failed';
                break;
            case 'disabled':
                this._disabled = newValue !== null && newValue !== 'false';
                this._updateButtonState();
                break;
            case 'variant':
                if (newValue === 'primary' || newValue === 'secondary' || newValue === 'outline') {
                    this._variant = newValue;
                    this._updateStyles();
                }
                break;
            case 'size':
                if (newValue === 'small' || newValue === 'medium' || newValue === 'large') {
                    this._size = newValue;
                    this._updateStyles();
                }
                break;
        }
    }

    /**
     * Get the current user ID
     */
    get userId(): string {
        return this._userId;
    }

    /**
     * Set the user ID
     */
    set userId(value: string) {
        this.setAttribute('user-id', value);
    }

    /**
     * Get the button text
     */
    get buttonText(): string {
        return this._buttonText;
    }

    /**
     * Set the button text
     */
    set buttonText(value: string) {
        this.setAttribute('button-text', value);
    }

    /**
     * Get the disabled state
     */
    get disabled(): boolean {
        return this._disabled;
    }

    /**
     * Set the disabled state
     */
    set disabled(value: boolean) {
        if (value) {
            this.setAttribute('disabled', '');
        } else {
            this.removeAttribute('disabled');
        }
    }

    /**
     * Get the variant
     */
    get variant(): string {
        return this._variant;
    }

    /**
     * Set the variant
     */
    set variant(value: string) {
        this.setAttribute('variant', value);
    }

    /**
     * Get the size
     */
    get size(): string {
        return this._size;
    }

    /**
     * Set the size
     */
    set size(value: string) {
        this.setAttribute('size', value);
    }

    /**
     * Manually trigger the binding process
     * @returns Promise that resolves with the bound public key or rejects with error
     */
    async bind(): Promise<string> {
        return this._performBinding();
    }

    /**
     * Reset the button to its initial state
     */
    reset(): void {
        this._isLoading = false;
        this._textSpan.textContent = this._buttonText;
        this._spinner.style.display = 'none';
        this._button.disabled = this._disabled;
        this._updateStyles();
    }

    /**
     * Handle button click
     */
    private async _handleClick(): Promise<void> {
        if (this._disabled || this._isLoading) return;

        try {
            await this._performBinding();
        } catch (error) {
            // Error is already handled in _performBinding
            console.error('SealX bind button click error:', error);
        }
    }

    /**
     * Perform the actual binding process
     */
    private async _performBinding(): Promise<string> {
        if (!this._userId) {
            const error = new Error('User ID is required for binding');
            this._showError(error);
            throw error;
        }

        // Dispatch bind-start event
        this.dispatchEvent(new CustomEvent('bind-start'));

        this._isLoading = true;
        this._textSpan.textContent = this._loadingText;
        this._spinner.style.display = 'inline-block';
        this._button.disabled = true;

        try {
            // Check if SealX is active
            const isActive = await isSealxActive();
            if (!isActive) {
                throw new Error('SealX extension is not installed or not active. Please install the SealX browser extension.');
            }

            // Initialize session if needed
            await initSealx(this._userId);

            // Bind public key
            const publicKey = await bindSealx(this._userId);

            // Show success
            this._showSuccess(publicKey);

            // Dispatch bind-success event
            this.dispatchEvent(new CustomEvent('bind-success', {
                detail: { publicKey }
            }));

            return publicKey;
        } catch (error) {
            this._showError(error as Error);

            // Dispatch bind-error event
            this.dispatchEvent(new CustomEvent('bind-error', {
                detail: { error: error as Error }
            }));

            throw error;
        }
    }

    /**
     * Show success state
     */
    private _showSuccess(publicKey: string): void {
        this._isLoading = false;
        this._textSpan.textContent = this._successText;
        this._spinner.style.display = 'none';

        // Temporarily change to success state
        const originalVariant = this._variant;
        this._variant = 'primary';
        this._updateStyles();

        // Reset after 2 seconds
        setTimeout(() => {
            this._textSpan.textContent = this._buttonText;
            this._variant = originalVariant;
            this._updateStyles();
            this._button.disabled = this._disabled;
        }, 2000);
    }

    /**
     * Show error state
     */
    private _showError(error: Error): void {
        this._isLoading = false;
        this._textSpan.textContent = this._errorText;
        this._spinner.style.display = 'none';

        // Temporarily change to error state
        const originalVariant = this._variant;
        this._variant = 'secondary';
        this._updateStyles();

        // Reset after 3 seconds
        setTimeout(() => {
            this._textSpan.textContent = this._buttonText;
            this._variant = originalVariant;
            this._updateStyles();
            this._button.disabled = this._disabled;
        }, 3000);
    }

    /**
     * Update button state based on disabled flag
     */
    private _updateButtonState(): void {
        this._button.disabled = this._disabled || this._isLoading;
    }

    /**
     * Update button styles based on variant and size
     */
    private _updateStyles(): void {
        // Remove existing variant classes
        this._button.classList.remove(
            'sealx-button-primary',
            'sealx-button-secondary',
            'sealx-button-outline',
            'sealx-button-small',
            'sealx-button-medium',
            'sealx-button-large'
        );

        // Add variant class
        this._button.classList.add(`sealx-button-${this._variant}`);

        // Add size class
        this._button.classList.add(`sealx-button-${this._size}`);
    }

    /**
     * Get CSS styles for the component
     */
    private _getStyles(): string {
        return `
      :host {
        display: inline-block;
        --sealx-primary-color: #007bff;
        --sealx-secondary-color: #6c757d;
        --sealx-outline-color: #007bff;
        --sealx-success-color: #28a745;
        --sealx-error-color: #dc3545;
        --sealx-border-radius: 4px;
        --sealx-font-family: inherit;
        --sealx-font-size-small: 12px;
        --sealx-font-size-medium: 14px;
        --sealx-font-size-large: 16px;
        --sealx-padding-small: 6px 12px;
        --sealx-padding-medium: 8px 16px;
        --sealx-padding-large: 12px 24px;
      }
      
      button {
        font-family: var(--sealx-font-family, inherit);
        border: none;
        border-radius: var(--sealx-border-radius);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.2s ease;
        font-weight: 500;
        line-height: 1.5;
      }
      
      button:disabled {
        cursor: not-allowed;
        opacity: 0.65;
      }
      
      /* Variant styles */
      .sealx-button-primary {
        background-color: var(--sealx-primary-color);
        color: white;
      }
      
      .sealx-button-primary:hover:not(:disabled) {
        background-color: #0056b3;
      }
      
      .sealx-button-secondary {
        background-color: var(--sealx-secondary-color);
        color: white;
      }
      
      .sealx-button-secondary:hover:not(:disabled) {
        background-color: #545b62;
      }
      
      .sealx-button-outline {
        background-color: transparent;
        color: var(--sealx-outline-color);
        border: 1px solid var(--sealx-outline-color);
      }
      
      .sealx-button-outline:hover:not(:disabled) {
        background-color: rgba(0, 123, 255, 0.1);
      }
      
      /* Size styles */
      .sealx-button-small {
        font-size: var(--sealx-font-size-small);
        padding: var(--sealx-padding-small);
      }
      
      .sealx-button-medium {
        font-size: var(--sealx-font-size-medium);
        padding: var(--sealx-padding-medium);
      }
      
      .sealx-button-large {
        font-size: var(--sealx-font-size-large);
        padding: var(--sealx-padding-large);
      }
      
      /* Spinner animation */
      @keyframes sealx-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      [part="spinner"] svg {
        animation: sealx-spin 1s linear infinite;
      }
      
      [part="text"] {
        white-space: nowrap;
      }
    `;
    }
}

// Register the custom element
if (!customElements.get('sealx-bind-button')) {
    customElements.define('sealx-bind-button', SealxBindButton);
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
export function createSealxBindButton(options: {
    userId: string;
    buttonText?: string;
    loadingText?: string;
    successText?: string;
    errorText?: string;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'outline';
    size?: 'small' | 'medium' | 'large';
}): SealxBindButton {
    const button = document.createElement('sealx-bind-button') as SealxBindButton;

    button.userId = options.userId;

    if (options.buttonText) button.buttonText = options.buttonText;
    if (options.loadingText) button.setAttribute('loading-text', options.loadingText);
    if (options.successText) button.setAttribute('success-text', options.successText);
    if (options.errorText) button.setAttribute('error-text', options.errorText);
    if (options.disabled !== undefined) button.disabled = options.disabled;
    if (options.variant) button.variant = options.variant;
    if (options.size) button.size = options.size;

    return button;
}

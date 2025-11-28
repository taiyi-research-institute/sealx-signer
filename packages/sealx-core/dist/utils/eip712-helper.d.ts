import { KeyMap, SignContent, SignLayoutRender, SignLayoutContext } from "../eip712/eip712-struct";
/**
 * Converts various time formats to human-readable format with current computer's timezone
 * @param timeValue - The time value to convert (can be timestamp, Date object, or ISO string)
 * @returns {string} Human-readable formatted time string with current timezone information
 * @example
 * // Returns "2025-10-17 18:01:15 UTC+8" (current timezone: UTC+8)
 * convertToISOFormat(1729152075000)
 * // Returns "2025-10-17 18:01:15 UTC+8" (current timezone: UTC+8)
 * convertToISOFormat("2025-10-17T10:01:15.000Z")
 * // Returns "2025-10-17 18:01:15 UTC+8" (current timezone: UTC+8)
 * convertToISOFormat(new Date("2025-10-17T10:01:15.000Z"))
 */
export declare function convertToISOFormat(timeValue: any): string;
/**
 * Parses EIP-712 signing content into a renderable format by:
 * 1. Validating the template using a cryptographic salt check
 * 2. Building a rendering context from the message data
 * 3. Applying the template to the context if valid
 *
 * @param signContent - Complete EIP-712 structured data including:
 *   - layout: Contains template and key mappings
 *   - message: The actual data to be signed
 *   - domain: Contains validation salt
 *   - validUntilTime: Timestamp for template validation
 * @returns {SignLayoutRender} Object containing:
 *   - signData: Original EIP-712 data structure
 *   - render: Rendered template string (empty if validation failed)
 *   - context: Processed context data (null if validation failed)
 * @throws {Error} If template validation fails
 */
export declare const parseSignContent: (signContent: SignContent) => SignLayoutRender;
/**
 * Validates that a template contains all required references for a given key mapping structure.
 * Recursively checks nested key mappings to ensure template completeness.
 *
 * @param keyMap - Key mapping structure to validate against template
 * @param template - Template string to validate
 * @param parentKey - Parent key path for nested validations (used internally)
 * @returns {boolean} True if template contains all required key references, false otherwise
 * @example
 * // Returns true if template contains 'user.name.label' and 'user.name.value'
 * checkTemplateArgValid(
 *   { '用户列表': { originKey: 'users', children:[{
 *      "用户名":{
 *          originKey:'name'
 *       }
 *      }] } },
 *   'Hello <%= users[i].name.value %>!'
 * )
 */
export declare const checkTemplateArgValid: (keyMap: KeyMap, template: string, parentKey?: string) => boolean;
/**
 * Builds a hierarchical rendering context from key mappings and message data.
 * Handles both single objects and arrays recursively.
 *
 * @param keyMap - Mapping configuration that defines:
 *   - originKey: Source field in message
 *   - children: Nested mappings (optional)
 * Can be single mapping or array of mappings
 * @param message - Source data to process. Can be:
 *   - Single object with key-value pairs
 *   - Array of objects
 * @returns {SignLayoutContext} Structured context with:
 *   - label: Display label from keyMap
 *   - value: Processed value (recursively handled if object/array)
 * @example
 * // Returns { name: { label: 'Full Name', value: 'John Doe' } }
 * buildSignRenderContext(
 *   { name: { originKey: 'userName' } },
 *   { userName: 'John Doe' }
 * )
 */
export declare const buildSignRenderContext: (keyMap: KeyMap, message: Record<string, any>) => SignLayoutContext;
/**
 * Synchronously renders a template string using lodash template syntax
 *
 * @param template - Template string with lodash interpolation tags:
 *   - <%= value %> for HTML-escaped output
 *   - <%- value %> for raw output
 * @param context - Data object containing values referenced in template
 * @returns {string} Rendered output
 * @example
 * // Returns "Hello, John!"
 * layoutRender("Hello, <%= user.value.name.value %>!", { user: { value:{ name: {value: "Json"} } } })
 */
export declare const layoutRender: (template: string, context: Record<string, any>) => string;

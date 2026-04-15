import { ethers } from "ethers"
import { Eip712Struct, KeyMap, SignContent, SignContentLayout, SignLayoutRender, SignLayoutContext, SignContextItem } from "../eip712/eip712-struct"
import { template as _template, includes } from 'lodash'
import CryptoJS from 'crypto-js'

/**
 * Escapes special regex characters in a string
 * @param string - The string to escape
 * @returns The escaped string ready for regex use
 */
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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
export function convertToISOFormat(timeValue: any): string {
    if (!timeValue) {
        return ''
    }

    try {
        let date: Date

        // Handle numeric timestamps (seconds or milliseconds)
        if (typeof timeValue === 'number') {
            // Check if it's seconds (typical Unix timestamp) or milliseconds
            date = timeValue > 1e12 ? new Date(timeValue) : new Date(timeValue * 1000)
        }
        // Handle Date objects
        else if (timeValue instanceof Date) {
            date = timeValue
        }
        // Handle string values
        else if (typeof timeValue === 'string') {
            // If it's already an ISO string with timezone, use it directly
            const isoWithTimezoneRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
            if (isoWithTimezoneRegex.test(timeValue)) {
                date = new Date(timeValue)
            }
            // Try to parse as timestamp string
            else {
                const timestamp = Number(timeValue)
                if (!isNaN(timestamp)) {
                    date = timestamp > 1e12 ? new Date(timestamp) : new Date(timestamp * 1000)
                } else {
                    // Attempt to parse as a human-readable date string
                    // Example: "2025-10-25 10:01:48 UTC+8.5" cannot be directly parsed into a Date object
                    const parts = timeValue.split(' ')
                    if (parts.length === 3 && parts[2].startsWith('UTC')) {
                        const timezoneOffsetMatch = parts[2].match(/UTC([+-]\d+(\.\d+)?)/)
                        if (timezoneOffsetMatch) {
                            const offset = parseFloat(timezoneOffsetMatch[1])
                            const offsetMilliseconds = offset * 60 * 60 * 1000
                            const baseDate = new Date(parts[0] + 'T' + parts[1] + 'Z')
                            if (!isNaN(baseDate.getTime())) {
                                date = new Date(baseDate.getTime() - offsetMilliseconds)
                            } else {
                                date = new Date(timeValue)
                            }
                        } else {
                            date = new Date(timeValue)
                        }
                    } else {
                        date = new Date(timeValue)
                    }
                    // Try to parse as date string
                    // date = new Date(timeValue)
                }
            }
        }
        // Handle other types
        else {
            date = new Date(timeValue)
        }

        // Check if the date is valid
        if (isNaN(date.getTime())) {
            return String(timeValue)
        }

        // Format the date with current computer's timezone
        const timezoneOffset = date.getTimezoneOffset()
        const offsetHours = Math.abs(Math.floor(timezoneOffset / 60))
        const offsetMinutes = Math.abs(timezoneOffset % 60)
        const offsetSign = timezoneOffset <= 0 ? '+' : '-'

        // Format timezone as UTC+X or UTC+X.5 for half-hour offsets
        let timezoneString: string
        if (offsetMinutes === 0) {
            timezoneString = `UTC${offsetSign}${offsetHours}`
        } else {
            timezoneString = `UTC${offsetSign}${offsetHours}.5`
        }

        // Get local date components
        const year = date.getFullYear()
        const month = (date.getMonth() + 1).toString().padStart(2, '0')
        const day = date.getDate().toString().padStart(2, '0')
        const hours = date.getHours().toString().padStart(2, '0')
        const minutes = date.getMinutes().toString().padStart(2, '0')
        const seconds = date.getSeconds().toString().padStart(2, '0')

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${timezoneString}`
    } catch (error) {
        // If conversion fails, return the original value as string
        return String(timeValue)
    }
}

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
export const parseSignContent = (signContent: SignContent): SignLayoutRender => {
    const contentLayout: SignContentLayout = signContent.layout
    const signData: Eip712Struct = signContent
    const template: string = contentLayout.template
    const keyMap: KeyMap = JSON.parse(contentLayout.keysMapStr) as KeyMap
    const message: Record<string, any> = signContent.message
    const keysHash = CryptoJS.MD5(contentLayout.keysMapStr).toString()

    // Validate template integrity using cryptographic salt check
    const validTemplate = signContent.domain.salt === ethers.id(
        CryptoJS.MD5(template + keysHash + signContent.validUntilTime).toString()
    )

    // Check template contains all required key references
    const templateCompleteness = checkTemplateArgValid(keyMap, template)

    // Build rendering context from message data
    const context = buildSignRenderContext(keyMap, message)

    // Only render if all validations pass (template integrity, completeness, and context exists)
    const render = context && templateCompleteness && validTemplate
        ? layoutRender(template, context)
        : ''
    return {
        signData,
        render,
        context
    }
}

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
export const checkTemplateArgValid = (keyMap: KeyMap, template: string, parentKey: string = ''): boolean => {
    const keys = Object.keys(keyMap)
    for (const key of keys) {
        const originKey = keyMap[key].originKey

        // Check for label/value paths, handling both direct and array references
        const labelPath = `${parentKey}${originKey}.label`
        const valuePath = `${parentKey}${originKey}.value`

        // Create regex patterns that match both direct and array references
        const labelPattern = new RegExp(escapeRegExp(labelPath))
        const valuePattern = new RegExp(escapeRegExp(valuePath))

        if (!labelPattern.test(template) || !valuePattern.test(template)) {
            return false
        }

        // Handle nested child mappings if they exist
        if (keyMap[key].children) {
            let child = null
            let newParentKey = parentKey

            // For array children, use any variable name in brackets (e.g. [index], [i], [idx])
            if (Array.isArray(keyMap[key].children)) {
                child = keyMap[key].children[0]
                // Match any valid JavaScript variable name inside brackets
                newParentKey = `${parentKey}${originKey}.value[\\w\\d_]+].`
            }
            // For object children, use dot notation
            else {
                child = keyMap[key].children
                newParentKey = `${parentKey}${originKey}.value.`
            }

            // Recursively validate child mappings
            const isValidChild = checkTemplateArgValid(child, template, newParentKey)
            if (!isValidChild) {
                return false
            }
        }
    }
    return true
}

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
export const buildSignRenderContext = (keyMap: KeyMap, message: Record<string, any>): SignLayoutContext => {
    try {
        const context: SignLayoutContext = {}
        Object.keys(keyMap).forEach((key: string) => {
            const originKey = keyMap[key].originKey
            const originType = keyMap[key].originType
            let value = message[key]
            if (originType === 'struct') {
                value = buildSignRenderContext(keyMap[key].children as KeyMap, value)
            } else if (originType === 'array') {
                const keys = Object.keys(value)
                const result = [] as any[]
                for (let i = 0; i < keys.length; i++) {
                    const v = value[keys[i]]
                    if (v === Object(v)) {
                        result.push(buildSignRenderContext(keyMap[key].children[keys[i]] as KeyMap, v))
                    } else {
                        result.push({
                            label: i + 1,
                            value: v
                        })
                    }

                }
                value = result
            } else if (originType === 'time' || originKey === 'valid_until_time') {
                // Convert time values to ISO format
                value = convertToISOFormat(value)
            }
            context[originKey] = {
                label: key,
                value: value,
                originKey: originKey
            }
        })
        return context
    } catch (e) {
        console.error(e, keyMap)
        throw e
    }
}

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
export const layoutRender = (template: string, context: Record<string, any>) => {
    const render = _template(template)
    return render(context)
}

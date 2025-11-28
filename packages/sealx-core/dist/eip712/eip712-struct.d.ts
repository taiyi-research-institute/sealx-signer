/**
 * Mapping between display keys and original message keys
 * @example
 * {
 *   "User Name": { originKey: "userName" },
 *   "Address": {
 *     originKey: "address",
 *     children: {
 *       "Street": { originKey: "street" }
 *     }
 *   }
 * }
 */
export type KeyMap = Record<string, KeyReflection>;
export type OrigionType = 'value' | 'struct' | 'array' | 'time';
/**
 * Defines how a key from the message maps to its display representation
 */
export interface KeyReflection {
    /** Original key name in the message object */
    originKey: string;
    /** Nested key mappings for object/array values */
    children: KeyMap | Record<string, KeyMap>;
    originType: OrigionType;
}
/**
 * Defines the layout structure for rendering signed content
 */
export interface SignContentLayout {
    /**
     * JSON string of KeyMap to preserve property order consistency
     * @see KeyMap
     */
    keysMapStr: string;
    /**
     * HTML template for rendering the signed content
     * @example
     * `<div style="font-size:12px">
     *    <span style="color:red">{user.name.label}</span>
     *    <span style="color:red">{user.name.value}</span>
     * </div>`
     *
     * Supports both direct references and array references:
     * - Direct: user.address.street.value
     * - Array: users[i].address.value
     */
    template: string;
}
export interface Eip712Struct {
    /**
 * The EIP-712 domain separator fields
 */
    readonly domain: {
        /** The name of the signing domain (e.g. "MyDApp") */
        readonly name: string;
        /** Current version of the domain (e.g. "1") */
        readonly version: string;
        /** The chainId where the verifying contract is deployed */
        readonly chainId: number;
        /** The address of the verifying contract */
        readonly verifyingContract: string;
        readonly salt: string;
    };
    /**
     * Type definitions for the message
     * @example {
     *   Person: [
     *     { name: 'name', type: 'string' },
     *     { name: 'wallet', type: 'address' }
     *   ]
     * }
     */
    readonly types: Record<string, Array<{
        name: string;
        type: string;
    }>>;
    /** The primary type of the message being signed */
    readonly primaryType: string;
    /** The message content to be signed */
    readonly message: Record<string, unknown>;
}
/**
 * EIP-712 Typed Structured Data for signing
 * @see https://eips.ethereum.org/EIPS/eip-712
 */
export interface SignContent extends Eip712Struct {
    readonly layout: SignContentLayout;
    readonly validUntilTime: string;
}
export interface SignContextItem {
    label: string;
    value: Record<string, SignContextItem> | string | number | boolean | SignLayoutContext[];
}
export type SignLayoutContext = Record<string, SignContextItem>;
export interface SignLayoutRender {
    readonly signData: Eip712Struct;
    readonly render: string;
    readonly context: SignLayoutContext | null;
}

import type { Eip712Struct } from "sealx-core";

export interface PolicyAsset {
    symbol?: string
    token?: string
    chainId?: number
    verifyingContract?: string
}

export interface PolicyAction {
    adapter: string
    amount: bigint | null
    asset: PolicyAsset | null
    chainId?: number
    verifyingContract?: string
}

export interface PolicyAdapter {
    match(signContent: Eip712Struct): boolean
    extract(signContent: Eip712Struct): PolicyAction
}

const normalizeKey = (key: string) => key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()

const getMessageValue = (message: Record<string, unknown>, keys: string[]) => {
    const normalizedKeys = new Map<string, unknown>()
    for (const [key, value] of Object.entries(message)) {
        normalizedKeys.set(normalizeKey(key), value)
    }
    for (const key of keys) {
        const value = normalizedKeys.get(normalizeKey(key))
        if (value !== undefined && value !== null && value !== '') {
            return value
        }
    }
    return null
}

const parseIntegerAmount = (value: unknown): bigint | null => {
    if (typeof value === 'bigint') return value >= 0n ? value : null
    if (typeof value === 'number') {
        if (!Number.isSafeInteger(value) || value < 0) return null
        return BigInt(value)
    }
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    if (!/^\d+$/.test(trimmed)) return null
    return BigInt(trimmed)
}

const getPrimaryTypeFieldType = (signContent: Eip712Struct, keys: string[]) => {
    const fields = signContent.types?.[signContent.primaryType] ?? []
    const normalizedKeys = new Set(keys.map(normalizeKey))
    const field = fields.find((item) => normalizedKeys.has(normalizeKey(item.name)))
    return field?.type ?? null
}

const isMinimalUnitAmountType = (fieldType: string | null, value: unknown) => {
    if (fieldType?.startsWith('uint')) return true
    return fieldType === 'string' && typeof value === 'string' && /^\d+$/.test(value.trim())
}

const hasTransferSignal = (signContent: Eip712Struct) => {
    const command = getMessageValue(signContent.message, ['command', 'commandName'])
    const commandText = typeof command === 'string' ? command.trim().toLowerCase() : ''
    return (
        signContent.primaryType.toLowerCase() === 'transfer' ||
        commandText === 'transfer' ||
        signContent.domain.name?.toLowerCase().includes('transfer')
    )
}

export const transferPolicyAdapter: PolicyAdapter = {
    match: hasTransferSignal,
    extract(signContent) {
        const message = signContent.message
        const amountKeys = ['amount']
        const amountValue = getMessageValue(message, amountKeys)
        const amountType = getPrimaryTypeFieldType(signContent, amountKeys)
        const amount = isMinimalUnitAmountType(amountType, amountValue)
            ? parseIntegerAmount(amountValue)
            : null
        const symbol = getMessageValue(message, ['coin_type', 'coinType', 'token'])
        const token = getMessageValue(message, ['contract', 'tokenAddress'])
        return {
            adapter: 'transfer',
            amount,
            asset: {
                symbol: typeof symbol === 'string' ? symbol : undefined,
                token: typeof token === 'string' ? token : undefined,
                chainId: signContent.domain.chainId,
                verifyingContract: signContent.domain.verifyingContract
            },
            chainId: signContent.domain.chainId,
            verifyingContract: signContent.domain.verifyingContract
        }
    }
}

const policyAdapters: PolicyAdapter[] = [
    transferPolicyAdapter
]

export const extractPolicyAction = (signContent: Eip712Struct): PolicyAction | null => {
    const adapter = policyAdapters.find((item) => item.match(signContent))
    return adapter ? adapter.extract(signContent) : null
}

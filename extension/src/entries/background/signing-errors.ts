export type SigningErrorCode =
    | 'SESSION_EXPIRED'
    | 'SESSION_MISMATCH'
    | 'MEMORY_KEY_MISSING'
    | 'CAPABILITY_MISSING'
    | 'CAPABILITY_EXPIRED'
    | 'CAPABILITY_BUSY'
    | 'USAGE_LIMIT_REACHED'
    | 'AMOUNT_LIMIT_EXCEEDED'
    | 'POLICY_MISMATCH'
    | 'SIGNING_FAILED'

export class SigningError extends Error {
    readonly code: SigningErrorCode

    constructor(code: SigningErrorCode, message: string) {
        super(message)
        this.name = 'SigningError'
        this.code = code
    }
}

export interface SigningFailure {
    signature: ''
    address: ''
    error: string
    errorCode: SigningErrorCode
}

export const toSigningError = (error: unknown): SigningError => {
    if (error instanceof SigningError) return error
    return new SigningError(
        'SIGNING_FAILED',
        error instanceof Error ? error.message : 'Signing failed'
    )
}

export const signingFailure = (error: unknown): SigningFailure => {
    const signingError = toSigningError(error)
    return {
        signature: '',
        address: '',
        error: signingError.message,
        errorCode: signingError.code
    }
}

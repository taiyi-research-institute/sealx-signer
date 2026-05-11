import type { Eip712Struct } from "sealx-core";
import { signTypeContent } from "./utils/crypto";

export type AuthMethod = 'pin' | 'webauthn' | 'native-biometric' | 'hardware'

export type SigningProviderType = 'memory' | 'native-app' | 'hardware'

export interface SigningResult {
    signature: string
    address: string
}

export interface SigningProvider {
    type: SigningProviderType
    signTypedData(signContent: Eip712Struct): Promise<SigningResult | null | undefined>
}

export class MemorySigningProvider implements SigningProvider {
    readonly type: SigningProviderType = 'memory'
    private readonly privateKey: string

    constructor(privateKey: string) {
        this.privateKey = privateKey
    }

    signTypedData(signContent: Eip712Struct) {
        return signTypeContent(signContent, this.privateKey)
    }
}

export const createMemorySigningProvider = (privateKey?: string | null) => {
    return privateKey ? new MemorySigningProvider(privateKey) : null
}

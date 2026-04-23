export declare const pinGenerator: () => string;
export declare const slatGenerator: () => string;
export declare const deriveKeyFromPin: (pin: string, slat: string) => Promise<CryptoKey>;
export declare const encryptPrivateKey: (privateKey: string, pin: string, slat: string) => Promise<{
    iv: string;
    encrypted: string;
}>;
export declare const decryptPrivateKey: (pin: string, encodePrivateKey: string, iv: string, slat: string) => Promise<string>;
//# sourceMappingURL=cropto.d.ts.map
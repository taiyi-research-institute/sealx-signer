import { SealxSigner } from "./sealx-signer";
declare global {
    interface Window {
        sealxSigner: SealxSigner;
    }
}
export declare class SealxProvider {
    static register(): SealxSigner;
}
//# sourceMappingURL=sealx-provider.d.ts.map
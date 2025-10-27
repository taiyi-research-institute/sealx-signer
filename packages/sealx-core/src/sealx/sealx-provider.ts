import { SealxSigner } from "./sealx-signer";

declare global {
    interface Window {
        sealxSigner: SealxSigner;
    }
}
export class SealxProvider {
    static register() {
        if (!window.sealxSigner) {
            window.sealxSigner = new SealxSigner();
        } else {
            console.warn("SealxSigner is already registered.");
        }
    }
}
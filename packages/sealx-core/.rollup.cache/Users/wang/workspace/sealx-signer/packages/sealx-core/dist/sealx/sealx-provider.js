import { SealxSigner } from "./sealx-signer";
export class SealxProvider {
    static register() {
        if (!window.sealxSigner) {
            window.sealxSigner = new SealxSigner();
        }
        else {
            console.warn("SealxSigner is already registered.");
        }
    }
}
//# sourceMappingURL=sealx-provider.js.map
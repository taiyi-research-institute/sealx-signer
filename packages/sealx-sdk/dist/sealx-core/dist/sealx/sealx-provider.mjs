import { SealxSigner } from './sealx-signer.mjs';

class SealxProvider {
    static register() {
        if (!window.sealxSigner) {
            window.sealxSigner = new SealxSigner();
        }
        else {
            console.warn("SealxSigner is already registered.");
        }
    }
}

export { SealxProvider };
//# sourceMappingURL=sealx-provider.mjs.map

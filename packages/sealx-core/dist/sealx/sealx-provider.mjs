import { SealxSigner } from './sealx-signer.mjs';

class SealxProvider {
    static register() {
        if (!window.sealxSigner) {
            window.sealxSigner = new SealxSigner();
        }
        return window.sealxSigner;
    }
}

export { SealxProvider };
//# sourceMappingURL=sealx-provider.mjs.map

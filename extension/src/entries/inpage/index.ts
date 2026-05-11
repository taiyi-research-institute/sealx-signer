import { SealxProvider } from "sealx-core";

const sealxSigner = SealxProvider.register()
// const messager: Messager = MessagerManager.getMessager()
sealxSigner.install()
sealxSigner.activate()

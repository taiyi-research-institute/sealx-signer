import { SealxProvider } from "sealx-core";



SealxProvider.register()
// const messager: Messager = MessagerManager.getMessager()
const sealxSigner = window.sealxSigner
sealxSigner.install()
sealxSigner.activate()



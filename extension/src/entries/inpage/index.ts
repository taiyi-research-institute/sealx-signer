import { SealxProvider } from "sealx-core";
// import { checkSealxSignerActive } from "sealx-message";
// import type { Messager } from "sealx-message";
// import { MessagerManager } from "sealx-message";



SealxProvider.register()
// const messager: Messager = MessagerManager.getMessager()
const sealxSigner = window.sealxSigner
sealxSigner.install()
sealxSigner.activate()

// checkSealxSignerActive(messager);


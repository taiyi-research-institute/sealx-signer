import { SealxTopic } from "../enums";
/**
 * Periodically checks if the SealxSigner extension is still active
 * @param messager - The messaging interface used to communicate with the extension
 */
export const checkSealxSignerActive = (messager) => {
    const sealxSigner = window.sealxSigner;
    if (sealxSigner.active) {
        // Check every 10 seconds if the extension is still active
        setTimeout(async () => {
            try {
                // Send a ping message to check if extension is responsive
                const res = await messager.send({ time: Date.now() }, SealxTopic.CHECK_ACTIVED);
                if (res.payload) {
                    console.log("SealxSigner is active");
                    // If active, schedule next check
                    checkSealxSignerActive(messager);
                }
                else {
                    console.warn("SealxSigner is not active, deactivating...");
                    // If not active, deactivate the signer
                    sealxSigner.deactivate();
                }
            }
            catch (error) {
                console.error("Error checking SealxSigner active state:", error);
                // On any error, deactivate the signer as a safety measure
                sealxSigner.deactivate();
            }
        }, 10000);
    }
};
//# sourceMappingURL=sealx-message-helper.js.map
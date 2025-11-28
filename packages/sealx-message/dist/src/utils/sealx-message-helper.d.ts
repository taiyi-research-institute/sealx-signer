import { Messager } from "../contracts";
/**
 * Periodically checks if the SealxSigner extension is still active
 * @param messager - The messaging interface used to communicate with the extension
 */
export declare const checkSealxSignerActive: (messager: Messager) => void;

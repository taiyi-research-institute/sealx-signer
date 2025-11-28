import type { SealxSigner } from "sealx-core";
import { SealxTopic } from "../enums";
import { SealxRequest } from "./request";
export interface SealxResponse<M = any, T = SealxTopic> extends SealxRequest<M, T> {
    responseId: string;
    session?: SealxSigner;
    error?: string;
    end: boolean;
}

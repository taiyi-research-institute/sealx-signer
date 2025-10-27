import type { SealxSession } from "sealx-core";
import { SealxTopic } from "../enums";
import { SealxRequest } from "./request";
export interface SealxResponse<M = any, T = SealxTopic> extends SealxRequest<M, T> {
    responseId: string;
    session?: SealxSession;
    error?: string;
    end: boolean;
}

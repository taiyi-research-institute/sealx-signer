declare module 'sealx-sdk' {
    export function bindSealx(): Promise<string>;
    export function initSealx(userId: string): Promise<void>;
}

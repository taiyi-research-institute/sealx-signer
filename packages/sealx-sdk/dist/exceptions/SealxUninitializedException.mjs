class SealxUninitializedException extends Error {
    constructor(message = 'SealX plugin not initialized. Please call initSealx() or connectSealx() first.') {
        super(message);
        this.name = 'SealxUninitializedException';
    }
}

export { SealxUninitializedException as default };
//# sourceMappingURL=SealxUninitializedException.mjs.map

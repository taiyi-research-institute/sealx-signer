class SealxUnavailableException extends Error {
    constructor(message = 'SealX extension is not installed or not active') {
        super(message);
        this.name = 'SealxUnavailableException';
    }
}

export { SealxUnavailableException as default };
//# sourceMappingURL=SealxUnavailableException.mjs.map

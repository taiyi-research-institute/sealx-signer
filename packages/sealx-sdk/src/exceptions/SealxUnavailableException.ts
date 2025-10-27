export default class SealxUnavailableException extends Error {
    constructor(message: string = 'SealX extension is not installed or not active') {
        super(message);
        this.name = 'SealxUnavailableException';
    }
}

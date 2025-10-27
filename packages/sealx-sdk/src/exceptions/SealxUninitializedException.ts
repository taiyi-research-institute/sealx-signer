export default class SealxUninitializedException extends Error {
    constructor(message: string = 'SealX plugin not initialized. Please call initSealx() or connectSealx() first.') {
        super(message);
        this.name = 'SealxUninitializedException';
    }
}

export default class PkException extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PkException';
    }
}

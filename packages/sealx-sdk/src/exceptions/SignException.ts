export default class SignException extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'SignException'
    }
}
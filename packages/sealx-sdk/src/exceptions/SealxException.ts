export default class SealxException extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'SealxException'
    }
}
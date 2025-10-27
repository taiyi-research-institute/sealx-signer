import { ethers } from "ethers";

export class Eip712Signer {
    keygen() {
        const wallet = ethers.Wallet.createRandom()
        const privateKey = wallet.privateKey
        const address = wallet.address
        return {
            privateKey,
            address
        }
    }
}
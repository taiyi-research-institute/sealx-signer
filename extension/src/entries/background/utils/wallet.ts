import { ethers } from "ethers"

/**
 * Creates an Ethereum wallet instance from a private key or generates a new random wallet.
 * 
 * @param privateKey - Optional private key string. If provided, creates wallet from this key.
 *                     If omitted or empty string, generates a new random wallet.
 * @returns An ethers.Wallet instance containing:
 *   - The wallet address
 *   - The private key (for the created wallet)
 *   - Signing capabilities
 * 
 * @example
 * // Create from existing private key
 * const wallet = createWallet('0x123...abc')
 * 
 * @example 
 * // Create new random wallet
 * const wallet = createWallet()
 */
export const createWallet = (privateKey: string = '') => {
    let wallet = null
    if (privateKey) {
        wallet = new ethers.Wallet(privateKey)
    } else {
        wallet = ethers.Wallet.createRandom()
    }
    return wallet
}

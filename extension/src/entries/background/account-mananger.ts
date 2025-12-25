import type { SealxAccount } from "sealx-core";

export default class AccountManager {
    accounts: SealxAccount[] = []
    login(account: SealxAccount) {
        this.accounts.push(account)
    }
}
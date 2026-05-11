import { localStorageWrapper } from "sealx-core"

export const loginUserId = async (host: string, userId?: string) => {
    const store = localStorageWrapper('sealx', 'login-user')
    if (userId === undefined) {
        const storedUserId = await store.getItem(host)
        userId = storedUserId ?? undefined
    } else {
        await store.setItem(host, userId)
    }
    return userId
}

export const lockLogin = async (expire: number) => {
    await localStorageWrapper('sealx', 'lock').setItem('login', expire);
    return expire
}

export const loginLockExpire = async () => {
    return await localStorageWrapper('sealx', 'lock').getItem('login');
}
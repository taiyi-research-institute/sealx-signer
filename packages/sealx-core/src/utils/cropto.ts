import PinError from "../exceptions/PinError";

export const pinGenerator = (): string => {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export const slatGenerator = (): string => {
    const array = new Uint8Array(16); // 16 字节的随机值
    crypto.getRandomValues(array);
    return Array.from(array).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export const deriveKeyFromPin = async (pin: string, slat: string) => {
    const encoder = new TextEncoder();
    // pin码加密
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(pin),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    return await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: encoder.encode(slat), // 固定盐值
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

// pin码加密私钥
export const encryptPrivateKey = async (privateKey: string, pin: string, slat: string) => {
    const key = await deriveKeyFromPin(pin, slat);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 生成随机 IV
    const encoder = new TextEncoder();

    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoder.encode(privateKey)
    );

    // 将 Uint8Array 转换为 Base64 字符串
    const base64Encode = (array: Uint8Array) => btoa(String.fromCharCode(...array));

    // 返回包含 iv 和 encrypted 的对象（作为 Base64 字符串）
    const data = {
        iv: base64Encode(iv),  // 将 IV 转换为 Base64
        encrypted: base64Encode(new Uint8Array(encrypted))  // 将加密后的数据转换为 Base64
    };
    return data
}

// pin码解密私钥
export const decryptPrivateKey = async (pin: string, encodePrivateKey: string, iv: string, slat: string) => {
    try {
        const key = await deriveKeyFromPin(pin, slat);
        const encrypted = new Uint8Array(new Uint8Array(atob(encodePrivateKey).split('').map(c => c.charCodeAt(0))));
        const ivBytes = new Uint8Array(atob(iv).split('').map(c => c.charCodeAt(0)))
        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: ivBytes },
            key,
            encrypted
        );

        return new TextDecoder().decode(decrypted);
    } catch (e) {
        throw new PinError(e as string)
    }
}

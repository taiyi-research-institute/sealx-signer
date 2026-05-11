import PinError from '../exceptions/PinError.mjs';
import DataCorruptedError from '../exceptions/DataCorruptedError.mjs';

const pinGenerator = () => {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};
const slatGenerator = () => {
    const array = new Uint8Array(16); // 16 字节的随机值
    crypto.getRandomValues(array);
    return Array.from(array).map(byte => byte.toString(16).padStart(2, '0')).join('');
};
const deriveKeyFromPin = async (pin, slat) => {
    const encoder = new TextEncoder();
    // pin码加密
    const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(pin), { name: "PBKDF2" }, false, ["deriveKey"]);
    return await crypto.subtle.deriveKey({
        name: "PBKDF2",
        salt: encoder.encode(slat), // 固定盐值
        iterations: 100000,
        hash: "SHA-256"
    }, keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
};
// pin码加密私钥
const encryptPrivateKey = async (privateKey, pin, slat) => {
    const key = await deriveKeyFromPin(pin, slat);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 生成随机 IV
    const encoder = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(privateKey));
    // 将 Uint8Array 转换为 Base64 字符串
    const base64Encode = (array) => btoa(String.fromCharCode(...array));
    // 返回包含 iv 和 encrypted 的对象（作为 Base64 字符串）
    const data = {
        iv: base64Encode(iv), // 将 IV 转换为 Base64
        encrypted: base64Encode(new Uint8Array(encrypted)) // 将加密后的数据转换为 Base64
    };
    return data;
};
// pin码解密私钥
const decryptPrivateKey = async (pin, encodePrivateKey, iv, slat) => {
    // Pre-decryption format validation: distinguish data corruption from wrong PIN
    let encrypted;
    let ivBytes;
    try {
        // Validate base64 format of ciphertext
        encrypted = new Uint8Array(atob(encodePrivateKey).split('').map(c => c.charCodeAt(0)));
    }
    catch {
        throw new DataCorruptedError('Invalid base64 encoding in encrypted data');
    }
    try {
        // Validate base64 format of IV
        ivBytes = new Uint8Array(atob(iv).split('').map(c => c.charCodeAt(0)));
    }
    catch {
        throw new DataCorruptedError('Invalid base64 encoding in IV');
    }
    // Validate IV length (AES-GCM requires 12 bytes)
    if (ivBytes.length !== 12) {
        throw new DataCorruptedError(`Invalid IV length: expected 12 bytes, got ${ivBytes.length}`);
    }
    try {
        const key = await deriveKeyFromPin(pin, slat);
        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBytes }, key, encrypted);
        return new TextDecoder().decode(decrypted);
    }
    catch (e) {
        throw new PinError(e);
    }
};

export { decryptPrivateKey, deriveKeyFromPin, encryptPrivateKey, pinGenerator, slatGenerator };
//# sourceMappingURL=cropto.mjs.map

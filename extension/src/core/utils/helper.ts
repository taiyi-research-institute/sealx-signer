import {
    decodeEncryptedPrivateKey,
    hexToStr,
    strToHex,
} from '@src/entries/background/utils/crypto';
import {
    decryptPrivateKey,
    encryptPrivateKey,
    slatGenerator,
    type SealxSession,
} from 'sealx-core';
import CryptoJS from 'crypto-js';
/**
 * Derives an HMAC key from a PIN using PBKDF2 key derivation
 * @param pin - The user's PIN used as the base key material
 * @returns Promise<CryptoKey> - The derived HMAC key
 */
export async function deriveHMACKeyFromPIN(pin: string) {
    const encoder = new TextEncoder();
    // Import the raw PIN as a base key for PBKDF2 derivation
    const baseKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(pin),
        'PBKDF2',
        false,
        ['deriveKey']
    );
    // Static key used as part of salt generation
    const key = `96b939a6abc19fc9269222f65c6d1dd096f57e25544fb2bc4a728222a5aba4a0`;
    // Generate salt by hashing PIN + static key
    const salt = CryptoJS.SHA256(pin + key).toString(CryptoJS.enc.Hex);

    // Derive HMAC key using PBKDF2 with high iteration count for security
    const derivedKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode(salt),
            iterations: 100_000,
            hash: 'SHA-256',
        },
        baseKey,
        {
            name: 'HMAC',
            hash: 'SHA-256',
            length: 256,
        },
        true,
        ['sign', 'verify']
    );

    return derivedKey;
}

/**
 * Signs a message using HMAC with a key derived from the user's PIN
 * @param pin - The user's PIN used to derive the signing key
 * @param message - The message to sign
 * @returns Promise<string> - Base64 encoded signature
 */
export async function signMessageWithPIN(pin: string, message: string) {
    const key = await deriveHMACKeyFromPIN(pin);
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(message)
    );
    return btoa(String.fromCharCode(...new Uint8Array(signature))); // Base64 输出
}

/**
 * Verifies a message signature using HMAC with a key derived from the user's PIN
 * @param pin - The user's PIN used to derive the verification key
 * @param message - The original message that was signed
 * @param base64Signature - The base64 encoded signature to verify
 * @returns Promise<boolean> - True if signature is valid, false otherwise
 */
export async function verifyMessageWithPIN(
    pin: string,
    message: string,
    base64Signature: string
) {
    const key = await deriveHMACKeyFromPIN(pin);
    const encoder = new TextEncoder();
    const signature = Uint8Array.from(atob(base64Signature), (c) =>
        c.charCodeAt(0)
    );
    return await crypto.subtle.verify(
        'HMAC',
        key,
        signature,
        encoder.encode(message)
    );
}

/**
 * Generates a unique session key string from host and user ID
 * @param host - The host domain (defaults to 'default' if empty)
 * @param userId - The user identifier (defaults to 'default' if empty)
 * @returns string - Formatted session key string "host:userId"
 */
export const sessionKey = (host: string = '', userId: string = '') => {
    return `${host ? host : 'default'}:${userId ? userId : 'default'}`;
};

/**
 * Decodes the encrypted private key from a SealxSession
 * @param session - The session containing the encrypted private key
 * @returns Promise<any> - The decoded private key object or null if no key exists
 */
export const decodeSessionPrivateKey = async (session: SealxSession) => {
    const pkStr = hexToStr(session.pk);
    const pkRecord = session.pk ? JSON.parse(pkStr) : null;
    const k = CryptoJS.MD5(
        session.sessionId + session.host + session.userId + session.expire
    ).toString();
    const pkObj = session.pk
        ? await decodeEncryptedPrivateKey(pkRecord, k, session.address)
        : null;
    return pkObj;
};

/**
 * Encrypts and encodes a SealxSession using the user's PIN
 * @param pin - The user's PIN used for encryption
 * @param session - The session object to encode
 * @returns Promise<string> - Hex encoded string containing encrypted session data
 */
export const encodeSession = async (pin: string, session: SealxSession) => {
    const jsonStr = JSON.stringify(session);
    const salt = slatGenerator();
    const res = await encryptPrivateKey(jsonStr, pin, salt);
    const encodeObj = {
        salt,
        ...res,
    };
    return strToHex(JSON.stringify(encodeObj));
};

/**
 * Decodes and decrypts an encoded SealxSession using the user's PIN
 * @param pin - The user's PIN used for decryption
 * @param encoded - Hex encoded string containing encrypted session data
 * @returns Promise<SealxSession> - The decrypted session object
 */
export const decodeSession = async (pin: string, encoded: string) => {
    const encodedStr = hexToStr(encoded);
    const { salt, iv, encrypted } = JSON.parse(encodedStr);
    const decrypted = await decryptPrivateKey(pin, encrypted, iv, salt);
    return JSON.parse(decrypted) as SealxSession;
};

export const exportPrivateKeyToGoogleDrive = async (
    privateKey: string,
    accessToken: string
) => {
    const folderName = 'sealx';
    const fileName = 'private.key';

    // 1. 搜索或创建 sealx 文件夹
    let folderId = '';
    try {
        // 搜索 sealx 文件夹
        const folderSearchResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(folderName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            {
                method: 'GET',
                headers: {
                    Authorization: 'Bearer ' + accessToken,
                },
            }
        );

        if (folderSearchResponse.ok) {
            const folderSearchResult = await folderSearchResponse.json();

            if (folderSearchResult.files && folderSearchResult.files.length > 0) {
                // 使用第一个找到的文件夹
                folderId = folderSearchResult.files[0].id;
                console.log(`Found existing folder: ${folderName} (${folderId})`);
            } else {
                // 创建新文件夹
                const createFolderResponse = await fetch(
                    'https://www.googleapis.com/drive/v3/files',
                    {
                        method: 'POST',
                        headers: {
                            Authorization: 'Bearer ' + accessToken,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            name: folderName,
                            mimeType: 'application/vnd.google-apps.folder',
                        }),
                    }
                );

                if (createFolderResponse.ok) {
                    const folderData = await createFolderResponse.json();
                    folderId = folderData.id;
                    console.log(`Created new folder: ${folderName} (${folderId})`);
                } else {
                    throw new Error(`Failed to create folder: ${createFolderResponse.statusText}`);
                }
            }
        }
    } catch (error) {
        console.warn('Error while searching/creating folder:', error);
        // 继续执行，尝试直接上传文件
    }

    // 2. 搜索并删除已存在的 private.key 文件
    try {
        // 搜索文件（在特定文件夹中，如果找到了文件夹）
        let searchQuery = `name='${encodeURIComponent(fileName)}' and trashed=false`;
        if (folderId) {
            searchQuery += ` and '${folderId}' in parents`;
        }

        const searchResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${searchQuery}`,
            {
                method: 'GET',
                headers: {
                    Authorization: 'Bearer ' + accessToken,
                },
            }
        );

        if (searchResponse.ok) {
            const searchResult = await searchResponse.json();

            // 删除所有找到的同名文件
            if (searchResult.files && searchResult.files.length > 0) {
                for (const file of searchResult.files) {
                    const deleteResponse = await fetch(
                        `https://www.googleapis.com/drive/v3/files/${file.id}`,
                        {
                            method: 'DELETE',
                            headers: {
                                Authorization: 'Bearer ' + accessToken,
                            },
                        }
                    );

                    if (!deleteResponse.ok) {
                        console.warn(`Failed to delete existing file ${file.id}: ${deleteResponse.statusText}`);
                    } else {
                        console.log(`Deleted existing file: ${file.name} (${file.id})`);
                    }
                }
            }
        }
    } catch (error) {
        console.warn('Error while searching/deleting existing files:', error);
        // 继续执行，尝试上传新文件
    }

    // 3. 上传新文件到文件夹中
    interface FileMetadata {
        name: string;
        mimeType: string;
        parents?: string[];
    }

    const fileMetadata: FileMetadata = {
        name: fileName,
        mimeType: 'text/plain',
    };

    // 如果找到了文件夹，将文件放入该文件夹
    if (folderId) {
        fileMetadata.parents = [folderId];
    }

    const fileContent = privateKey;
    const boundary = '-------314159265358979323846';
    const delimiter = '\r\n--' + boundary + '\r\n';
    const closeDelimiter = '\r\n--' + boundary + '--';

    const body =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(fileMetadata) +
        delimiter +
        'Content-Type: text/plain\r\n\r\n' +
        fileContent +
        closeDelimiter;

    const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + accessToken,
                'Content-Type': 'multipart/related; boundary=' + boundary,
            },
            body: body,
        }
    );

    if (!response.ok) {
        throw new Error(
            'Failed to upload file to Google Drive: ' + response.statusText
        );
    }

    const jsonResponse = await response.json();
    return jsonResponse;
};

import { encryptPrivateKey, slatGenerator, decryptPrivateKey, localStorageWrapper } from 'sealx-core';

export interface BackupInterface {
    backupData(data: string, pin: string): Promise<void>;
    restoreData(): Promise<string>;
    generateBackupPin(): string;
}

export abstract class BackupBase implements BackupInterface {
    folder: string = 'sealx_backups';
    fileName: string = 'sealx_private.txt';

    private storageKey = 'backup_encrypted_data';

    async backupData(data: string, pin: string): Promise<void> {
        // Generate salt for key derivation
        const salt = slatGenerator();

        // Encrypt data using pin and salt
        const encryptedResult = await encryptPrivateKey(data, pin, salt);

        // Create storage object containing encrypted data, IV, and salt
        const storageObject = {
            encrypted: encryptedResult.encrypted,
            iv: encryptedResult.iv,
            salt,
            timestamp: Date.now()
        };

        // Store in localStorage using the wrapper
        const storage = localStorageWrapper('sealx', 'backup');
        await storage.setItem(this.storageKey, JSON.stringify(storageObject));
    }

    async restoreData(): Promise<string> {
        // Retrieve from storage
        const storage = localStorageWrapper('sealx', 'backup');
        const storedData = await storage.getItem(this.storageKey);

        if (!storedData) {
            throw new Error('No backup data found');
        }

        // Note: The pin is not stored, so we cannot decrypt without it.
        // This is a design limitation of the interface.
        // For now, throw an error indicating pin is required.
        throw new Error('Restore requires pin. Interface needs update.');
    }

    async restoreDataWithPin(pin: string): Promise<string> {
        // Retrieve from storage
        const storage = localStorageWrapper('sealx', 'backup');
        const storedData = await storage.getItem(this.storageKey);

        if (!storedData) {
            throw new Error('No backup data found');
        }

        const { encrypted, iv, salt } = JSON.parse(storedData);

        // Decrypt using pin and salt
        const decrypted = await decryptPrivateKey(pin, encrypted, iv, salt);
        return decrypted;
    }

    generateBackupPin(): string {
        // Simple PIN generation logic (for demonstration purposes)
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
}

export class GoogleDriveBackup extends BackupBase {
    // Override backupData to upload to Google Drive
    async backupData(data: string, pin: string): Promise<void> {
        // Call base class method to encrypt and store locally
        await super.backupData(data, pin);

        // Additional logic to upload to Google Drive can be added here.
    }

    // Override restoreData to download from Google Drive
    async restoreData(): Promise<string> {
        throw new Error('Restore from Google Drive not implemented yet.');
    }
}

export class LocalStorageBackup extends BackupBase {
    // Inherits all methods from BackupBase without changes
}

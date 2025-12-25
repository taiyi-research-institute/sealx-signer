/**
 * GoogleDrive 配置选项
 */
export interface GoogleDriveOptions {
    /** 授权开始时的回调函数 */
    onAuthStart?: () => void;
    /** 授权结束时的回调函数（无论成功或失败） */
    onAuthEnd?: () => void;
}

/**
 * GoogleDrive 类提供了与 Google Drive API 交互的功能。
 * 主要功能包括：
 * - 自动获取和管理 OAuth token
 * - 创建和管理文件夹
 * - 上传文件到 Google Drive
 * - 从 Google Drive 下载文件
 * - 删除已存在的文件
 * - 支持重试机制和 token 刷新
 * - 提供完整的错误处理和日志记录
 */
export class GoogleDrive {

    private token: string = '';
    private folder: string = 'sealx';
    private baseUrl: string = 'https://www.googleapis.com/drive/v3/files';
    private uploadUrl: string = 'https://www.googleapis.com/upload/drive/v3/files';
    private maxRetries: number = 3;
    private retryDelay: number = 1000; // 1 second
    private onAuthStart?: () => void;
    private onAuthEnd?: () => void;

    /**
     * 创建 GoogleDrive 实例并初始化 OAuth token
     * @param folder - 可选的文件夹名称，默认为 'sealx'
     * @param options - 可选的配置选项
     */
    constructor(folder?: string, options?: GoogleDriveOptions) {
        if (folder) {
            this.folder = folder;
        }
        if (options) {
            this.onAuthStart = options.onAuthStart;
            this.onAuthEnd = options.onAuthEnd;
        }
        // this.initializeToken();
    }

    /**
     * 设置备份文件夹名称
     * @param folderName - 新的文件夹名称
     */
    setFolder(folderName: string): void {
        this.folder = folderName;
    }

    /**
     * 获取当前备份文件夹名称
     * @returns {string} 当前文件夹名称
     */
    getFolder(): string {
        return this.folder;
    }

    /**
     * 初始化 OAuth token，通过 Chrome identity API 获取访问令牌
     * @param interactive - 是否交互式获取 token（弹出授权窗口）
     * @throws {Error} 如果获取 token 失败
     * @private
     */
    private async initializeToken(interactive: boolean = false): Promise<void> {
        try {
            return new Promise((resolve, reject) => {
                chrome.identity?.getAuthToken({ interactive }, (token) => {
                    if (chrome.runtime.lastError) {
                        console.error("OAuth error:", chrome.runtime.lastError);
                        reject(new Error(`OAuth error: ${chrome.runtime.lastError.message}`));
                    } else if (!token) {
                        reject(new Error("No token received from Chrome identity API"));
                    } else {
                        this.token = token.token ? token.token : token as string;
                        console.log(`OAuth token initialized (interactive: ${interactive})`);
                        resolve();
                    }
                });
            });
        } catch (error) {
            console.error("Failed to initialize token:", error);
            throw error;
        }
    }

    /**
     * 确保 token 可用，如果 token 不存在则初始化
     * @returns {Promise<string>} 可用的 OAuth token
     */
    async ensureToken(): Promise<string> {
        if (!this.token) {
            // 触发授权开始回调
            if (this.onAuthStart) {
                this.onAuthStart();
            }

            try {
                await this.initializeToken();
            } finally {
                // 无论成功或失败，都触发授权结束回调
                if (this.onAuthEnd) {
                    this.onAuthEnd();
                }
            }
        }
        return this.token;
    }

    /**
     * 带重试机制的 fetch 请求，支持 token 过期自动刷新
     * @param url - 请求 URL
     * @param options - fetch 请求选项
     * @param retries - 最大重试次数，默认为 3
     * @returns {Promise<Response>} fetch 响应
     * @private
     */
    private async fetchWithRetry(url: string, options: RequestInit, retries: number = this.maxRetries): Promise<Response> {
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const response = await fetch(url, options);

                // 如果 token 过期，尝试刷新
                if (response.status === 401 && attempt < retries - 1) {
                    console.log("Token expired, attempting to refresh...");
                    await this.refreshToken();
                    // 更新 Authorization header
                    const token = await this.ensureToken();
                    options.headers = {
                        ...options.headers,
                        'Authorization': `Bearer ${token}`
                    };
                    continue;
                }

                return response;
            } catch (error) {
                console.warn(`Fetch attempt ${attempt + 1} failed:`, error);
                if (attempt < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
                } else {
                    throw error;
                }
            }
        }
        throw new Error(`Failed after ${retries} retries`);
    }

    /**
     * 刷新 OAuth token，移除缓存的 token 并重新获取
     * @param interactive - 是否交互式重新授权（弹出授权窗口）
     * @throws {Error} 如果刷新 token 失败
     * @private
     */
    private async refreshToken(interactive: boolean = true): Promise<void> {
        // 触发授权开始回调
        if (this.onAuthStart) {
            this.onAuthStart();
        }

        try {
            // 移除缓存的 token 以强制刷新
            chrome.identity?.removeCachedAuthToken({ token: this.token }, () => {
                console.log("Cached token removed for refresh");
            });

            // 重新获取 token，默认使用交互式以触发重新授权
            this.token = '';
            await this.initializeToken(interactive);
        } catch (error) {
            console.error("Failed to refresh token:", error);
            throw error;
        } finally {
            // 无论成功或失败，都触发授权结束回调
            if (this.onAuthEnd) {
                this.onAuthEnd();
            }
        }
    }

    /**
     * 获取或创建备份文件夹
     * @returns {Promise<string>} 文件夹 ID
     * @throws {Error} 如果搜索或创建文件夹失败
     */
    async getOrCreateFolder(): Promise<string> {
        const token = await this.ensureToken();

        // 搜索文件夹
        const searchResponse = await this.fetchWithRetry(
            `${this.baseUrl}?q=name='${encodeURIComponent(this.folder)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            }
        );

        if (!searchResponse.ok) {
            throw new Error(`Failed to search folder: ${searchResponse.statusText}`);
        }

        const searchResult = await searchResponse.json();

        if (searchResult.files && searchResult.files.length > 0) {
            // 返回第一个找到的文件夹
            const folderId = searchResult.files[0].id;
            console.log(`Found existing folder: ${this.folder} (${folderId})`);
            return folderId;
        }

        // 创建新文件夹
        const createResponse = await this.fetchWithRetry(this.baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: this.folder,
                mimeType: 'application/vnd.google-apps.folder',
            }),
        });

        if (!createResponse.ok) {
            throw new Error(`Failed to create folder: ${createResponse.statusText}`);
        }

        const folderData = await createResponse.json();
        console.log(`Created new folder: ${this.folder} (${folderData.id})`);
        return folderData.id;
    }

    /**
     * 删除已存在的同名文件，避免重复
     * @param fileName - 要删除的文件名
     * @param folderId - 可选的文件夹 ID，如果提供则只删除该文件夹内的文件
     * @returns {Promise<void>}
     */
    async deleteExistingFile(fileName: string, folderId?: string): Promise<void> {
        const token = await this.ensureToken();

        let searchQuery = `name='${encodeURIComponent(fileName)}' and trashed=false`;
        if (folderId) {
            searchQuery += ` and '${folderId}' in parents`;
        }

        try {
            const searchResponse = await this.fetchWithRetry(
                `${this.baseUrl}?q=${searchQuery}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );

            if (!searchResponse.ok) {
                console.warn(`Failed to search for existing files: ${searchResponse.statusText}`);
                return;
            }

            const searchResult = await searchResponse.json();

            if (searchResult.files && searchResult.files.length > 0) {
                for (const file of searchResult.files) {
                    try {
                        const deleteResponse = await this.fetchWithRetry(
                            `${this.baseUrl}/${file.id}`,
                            {
                                method: 'DELETE',
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                },
                            }
                        );

                        if (!deleteResponse.ok) {
                            console.warn(`Failed to delete existing file ${file.id}: ${deleteResponse.statusText}`);
                        } else {
                            console.log(`Deleted existing file: ${file.name} (${file.id})`);
                        }
                    } catch (error) {
                        console.warn(`Error deleting file ${file.id}:`, error);
                    }
                }
            }
        } catch (error) {
            console.warn('Error while searching/deleting existing files:', error);
        }
    }

    /**
     * 上传文件到 Google Drive
     * @param fileName - 文件名
     * @param content - 文件内容
     * @returns {Promise<string>} 上传文件的 ID
     * @throws {Error} 如果上传失败
     */
    async uploadFile(fileName: string, content: string): Promise<string> {
        const token = await this.ensureToken();

        // 获取或创建文件夹
        const folderId = await this.getOrCreateFolder();

        // 删除已存在的同名文件
        await this.deleteExistingFile(fileName, folderId);

        const metadata = {
            name: fileName,
            mimeType: 'text/plain',
            parents: [folderId]
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([content], { type: 'text/plain' }));

        const response = await this.fetchWithRetry(
            `${this.uploadUrl}?uploadType=multipart`,
            {
                method: 'POST',
                headers: new Headers({ 'Authorization': 'Bearer ' + token }),
                body: form
            }
        );

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('File uploaded successfully:', result.id);
        return result.id;
    }

    /**
     * 撤销 OAuth token，使其失效
     * @returns {Promise<void>}
     */
    async revokeToken(): Promise<void> {
        if (!this.token) {
            console.log('No token to revoke');
            return;
        }

        try {
            const revokeResponse = await fetch(
                `https://accounts.google.com/o/oauth2/revoke?token=${this.token}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            if (revokeResponse.ok) {
                console.log('Token revoked successfully');
                this.token = '';
            } else {
                console.error('Failed to revoke token:', revokeResponse.statusText);
            }
        } catch (error) {
            console.error('Error revoking token:', error);
        }
    }

    /**
     * 检查当前 token 是否有效
     * @returns {Promise<boolean>} token 是否有效
     */
    async checkTokenValidity(): Promise<boolean> {
        if (!this.token) {
            return false;
        }

        try {
            const response = await fetch(`${this.baseUrl}/about?fields=user`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                },
            });

            // 200-299 状态码表示 token 有效
            if (response.ok) {
                console.log('Token is valid');
                return true;
            }

            // 401 表示 token 过期或无效
            if (response.status === 401) {
                console.log('Token is invalid or expired');
                return false;
            }

            // 其他错误可能表示网络问题或 API 错误，但 token 可能仍然有效
            console.warn(`Unexpected response when checking token validity: ${response.status}`);
            return false;
        } catch (error) {
            console.error('Error checking token validity:', error);
            return false;
        }
    }

    /**
     * 强制重新授权（交互式获取新 token）
     * @returns {Promise<void>}
     */
    async reauthorize(): Promise<void> {
        try {
            await this.refreshToken(true);
            console.log('Reauthorization completed');
        } catch (error) {
            console.error('Failed to reauthorize:', error);
            throw error;
        }
    }

    /**
     * 清除所有认证信息，包括撤销 token 和移除缓存
     * @returns {Promise<void>}
     */
    async clearAuth(): Promise<void> {
        try {
            await this.revokeToken();
            if (this.token) {
                chrome.identity?.removeCachedAuthToken({ token: this.token }, () => {
                    console.log('Cached token removed');
                });
            }
        } catch (error) {
            console.error('Error clearing auth:', error);
        }
    }

    /**
     * 列出备份文件夹中的所有文件
     * @returns {Promise<Array<{id: string, name: string, createdTime: string}>>} 文件列表
     */
    async listFolderFiles(): Promise<Array<{ id: string, name: string, createdTime: string }>> {
        try {
            const token = await this.ensureToken();
            const folderId = await this.getOrCreateFolder();

            const searchQuery = `'${folderId}' in parents and trashed=false`;

            const searchResponse = await this.fetchWithRetry(
                `${this.baseUrl}?q=${searchQuery}&fields=files(id,name,createdTime)`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );

            if (!searchResponse.ok) {
                console.warn(`Failed to list files: ${searchResponse.statusText}`);
                return [];
            }

            const searchResult = await searchResponse.json();
            return searchResult.files || [];
        } catch (error) {
            console.error('Error listing backup files:', error);
            return [];
        }
    }

    /**
     * 从 Google Drive 读取文件内容
     * @param id - 文件 ID
     * @returns {Promise<string>} 文件内容
     * @throws {Error} 如果读取失败
     */
    async readFile(id: string): Promise<string> {
        const token = await this.ensureToken();

        const response = await this.fetchWithRetry(
            `${this.baseUrl}/${id}?alt=media`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to read file: ${response.statusText}`);
        }

        const content = await response.text();
        console.log(`File ${id} read successfully, length: ${content.length} characters`);
        return content;
    }
}

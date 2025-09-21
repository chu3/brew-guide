/**
 * S3同步管理器
 * 处理IndexedDB与S3之间的数据同步
 */

import S3Client, { S3Config } from './s3Client'
import { Storage } from '@/lib/core/storage'

export interface SyncResult {
    success: boolean
    message: string
    uploadedFiles: number
    downloadedFiles: number
    errors: string[]
}

export interface SyncMetadata {
    lastSyncTime: number
    version: string
    deviceId: string
    files?: string[]
    dataHash?: string
}

export class S3SyncManager {
    private client: S3Client | null = null
    private config: S3Config | null = null
    private syncInProgress = false

    /**
     * 初始化同步管理器
     */
    async initialize(config: S3Config): Promise<boolean> {
        try {
            this.config = config
            this.client = new S3Client(config)

            // 测试连接
            const connected = await this.client.testConnection()
            if (!connected) {
                throw new Error('无法连接到S3服务')
            }

            return true
        } catch (error) {
            console.error('S3同步管理器初始化失败:', error)
            return false
        }
    }

    /**
     * 执行数据同步
     */
    async sync(preferredDirection: 'auto' | 'upload' | 'download' = 'auto'): Promise<SyncResult> {
        if (this.syncInProgress) {
            return {
                success: false,
                message: '同步正在进行中',
                uploadedFiles: 0,
                downloadedFiles: 0,
                errors: ['同步正在进行中，请稍后再试']
            }
        }

        if (!this.client || !this.config) {
            return {
                success: false,
                message: '同步管理器未初始化',
                uploadedFiles: 0,
                downloadedFiles: 0,
                errors: ['S3同步管理器未正确初始化']
            }
        }

        this.syncInProgress = true
        const result: SyncResult = {
            success: false,
            message: '',
            uploadedFiles: 0,
            downloadedFiles: 0,
            errors: []
        }

        try {
            // 添加完整的诊断信息
            console.warn(`📋 S3同步完整诊断信息 [请复制此段给开发者]:`, {
                配置信息: {
                    endpoint: this.config.endpoint,
                    region: this.config.region,
                    bucketName: this.config.bucketName,
                    prefix: this.config.prefix,
                    accessKeyId: this.config.accessKeyId.substring(0, 8) + '***', // 只显示前8位
                },
                时间戳: new Date().toISOString(),
                用户代理: navigator.userAgent,
                页面URL: window.location.href
            })

            // 1. 获取本地数据
            console.warn('开始同步：获取本地数据...')
            const localData = await this.getLocalData()
            console.warn('本地数据获取完成，包含项目:', Object.keys(localData))
            const localFileManifest = this.getDataFileManifest(localData)

            // 2. 计算当前本地数据哈希
            const currentLocalDataHash = await this.generateDataHash(localData)
            console.warn('本地数据哈希:', currentLocalDataHash.substring(0, 8))

            // 3. 获取远程元数据
            console.warn('获取远程元数据...')
            const remoteMetadata = await this.getRemoteMetadata()
            console.warn('远程元数据:', remoteMetadata ? '存在' : '不存在')

            const localMetadata = await this.getLocalMetadata()
            console.warn('本地元数据:', localMetadata ? '存在' : '不存在')

            // 4. 决定同步方向（传入当前数据哈希）
            const shouldUpload = preferredDirection === 'upload'
                ? true
                : preferredDirection === 'download'
                    ? false
                    : this.shouldUploadData(localMetadata, remoteMetadata, currentLocalDataHash)

            if (preferredDirection !== 'auto') {
                console.warn('同步方向由调用方指定:', preferredDirection)
            }

            let manifestToPersist = localFileManifest

            if (shouldUpload) {
                // 上传本地数据到S3
                console.warn('执行上传操作...')
                await this.uploadData(localData, result)
            } else {
                // 从S3下载数据
                console.warn('执行下载操作...')
                const downloadedFiles = await this.downloadData(result, remoteMetadata)
                if (downloadedFiles.length > 0) {
                    manifestToPersist = downloadedFiles
                } else if (remoteMetadata?.files?.length) {
                    manifestToPersist = this.sanitizeManifestFiles(remoteMetadata.files)
                }
            }

            // 4. 更新同步元数据（传入实际同步的数据哈希）
            console.warn('更新同步元数据...')
            // 如果上传了，使用当前本地数据哈希；如果下载了，重新计算下载后的数据哈希
            const finalDataHash = shouldUpload ? currentLocalDataHash : await this.generateDataHash(await this.getLocalData())
            await this.updateSyncMetadata(manifestToPersist, finalDataHash)

            result.success = result.errors.length === 0
            result.message = result.success
                ? `同步完成：上传 ${result.uploadedFiles} 个文件，下载 ${result.downloadedFiles} 个文件`
                : `同步部分完成，遇到 ${result.errors.length} 个错误`

            console.warn('🎯 同步结果:', result)

            // 添加最终诊断结果
            console.warn(`📊 S3同步结果摘要 [请复制此段给开发者]:`, {
                成功状态: result.success,
                上传文件数: result.uploadedFiles,
                下载文件数: result.downloadedFiles,
                错误数量: result.errors.length,
                错误详情: result.errors,
                执行时间: new Date().toISOString()
            })

        } catch (error) {
            const errorMessage = `同步失败: ${error instanceof Error ? error.message : '未知错误'}`
            result.errors.push(errorMessage)
            result.message = '同步失败'
            console.error('同步过程中发生错误:', error)
        } finally {
            this.syncInProgress = false
        }

        return result
    }

    /**
     * 获取本地存储的所有数据
     */
    private async getLocalData(): Promise<Record<string, unknown>> {
        const data: Record<string, unknown> = {}

        try {
            // 使用DataManager导出完整的应用数据
            const { DataManager } = await import('@/lib/core/dataManager')
            const fullExportData = await DataManager.exportAllData()
            const exportDataObj = JSON.parse(fullExportData)

            // 保存完整的导出数据作为单个文件
            data['brew-guide-data'] = exportDataObj

            console.warn('获取到完整应用数据:', {
                exportDate: exportDataObj.exportDate,
                appVersion: exportDataObj.appVersion,
                dataKeys: Object.keys(exportDataObj.data),
                totalSize: (fullExportData.length / 1024).toFixed(2) + 'KB'
            })

        } catch (error) {
            console.error('获取完整应用数据失败，尝试获取基础设置:', error)

            // 如果完整导出失败，回退到只获取设置
            try {
                const value = await Storage.get('brewGuideSettings')
                if (value !== null) {
                    try {
                        data['brewGuideSettings'] = JSON.parse(value)
                    } catch {
                        data['brewGuideSettings'] = value
                    }
                }
            } catch (fallbackError) {
                console.error('获取基础设置也失败:', fallbackError)
            }
        }

        return data
    }

    private getDataFileManifest(localData: Record<string, unknown>): string[] {
        return Array.from(new Set(Object.keys(localData)))
            .filter(key => key)
            .map(key => `${key}.json`)
    }

    private sanitizeManifestFiles(files: string[]): string[] {
        const sanitized = new Set<string>()

        files.forEach(file => {
            if (!file) return

            const normalizedFileName = file.endsWith('.json') ? file : `${file}.json`
            const normalized = this.normalizeRemoteObjectKey(normalizedFileName)

            if (normalized) {
                sanitized.add(normalized)
            }
        })

        return Array.from(sanitized)
    }

    /**
     * 上传数据到S3
     */
    private async uploadData(localData: Record<string, unknown>, result: SyncResult): Promise<void> {
        if (!this.client) return

        // 上传每个数据文件
        for (const [key, value] of Object.entries(localData)) {
            try {
                const filename = `${key}.json`
                const content = JSON.stringify(value, null, 2)

                const success = await this.client.uploadFile(filename, content)
                if (success) {
                    result.uploadedFiles++
                } else {
                    result.errors.push(`上传 ${filename} 失败`)
                }
            } catch (error) {
                result.errors.push(`上传 ${key} 时出错: ${error instanceof Error ? error.message : '未知错误'}`)
            }
        }

        // 上传设备信息
        try {
            const deviceInfo = {
                deviceId: await this.getDeviceId(),
                lastSync: Date.now(),
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString()
            }

            await this.client.uploadFile('device-info.json', JSON.stringify(deviceInfo, null, 2))
        } catch (error) {
            console.warn('上传设备信息失败:', error)
        }
    }

    /**
     * 从S3下载数据
     */
    private async downloadData(result: SyncResult, remoteMetadata?: SyncMetadata | null): Promise<string[]> {
        if (!this.client) return []

        const filesToDownload = new Set<string>()
        const remoteManifestFiles = remoteMetadata?.files?.length
            ? this.sanitizeManifestFiles(remoteMetadata.files)
            : []

        remoteManifestFiles.forEach(file => filesToDownload.add(file))

        try {
            if (filesToDownload.size === 0) {
                // 列出远程文件（作为兜底方案）
                const files = await this.client.listObjects()
                files.forEach(file => {
                    if (
                        file.key.endsWith('.json') &&
                        !file.key.endsWith('sync-metadata.json') &&
                        !file.key.endsWith('device-info.json')
                    ) {
                        const normalizedKey = this.normalizeRemoteObjectKey(file.key)
                        if (normalizedKey) {
                            filesToDownload.add(normalizedKey)
                        }
                    }
                })
            }

            if (filesToDownload.size === 0) {
                filesToDownload.add('brew-guide-data.json')
            }

            const downloadedFiles: string[] = []

            // 下载每个数据文件
            for (const fileName of Array.from(filesToDownload)) {
                try {
                    console.warn(`下载文件: ${fileName}`)
                    const downloadKey = this.normalizeRemoteObjectKey(fileName)
                    if (!downloadKey) {
                        console.warn('远程对象键名无法规范化，跳过当前文件')
                        continue
                    }

                    const content = await this.client.downloadFile(downloadKey)
                    if (content) {
                        const key = downloadKey.replace(/\.json$/i, '')
                        if (!key) {
                            console.warn('下载到的文件缺少有效键名，跳过本地写入')
                            continue
                        }
                        console.warn(`成功下载文件 ${key}，内容长度: ${content.length}`)

                        try {
                            const data = JSON.parse(content)

                            // 检查是否是完整的导出数据格式
                            if (key === 'brew-guide-data' && data.data && data.exportDate) {
                                console.warn('检测到完整导出数据，开始恢复应用数据...')

                                // 使用DataManager导入完整数据
                                const { DataManager } = await import('@/lib/core/dataManager')
                                await DataManager.importAllData(content)

                                console.warn('完整应用数据导入成功')
                                result.downloadedFiles++
                                downloadedFiles.push('brew-guide-data.json')
                            } else {
                                // 兼容旧格式：直接保存到存储
                                await Storage.set(key, JSON.stringify(data))
                                console.warn(`成功保存 ${key} 到本地存储`)
                                result.downloadedFiles++
                                downloadedFiles.push(`${key}.json`)
                            }
                        } catch (parseError) {
                            console.error(`解析 ${key} 的JSON内容失败:`, parseError)
                            console.warn(`内容片段: ${content.substring(0, 200)}`)
                            result.errors.push(`解析 ${fileName} 的JSON内容失败`)
                        }
                    } else {
                        result.errors.push(`下载 ${fileName} 失败`)
                    }
                } catch (error) {
                    result.errors.push(`处理 ${fileName} 时出错: ${error instanceof Error ? error.message : '未知错误'}`)
                }
            }

            // 触发存储更新事件
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('storageChange', {
                    detail: { key: 's3-sync-complete' }
                }))
            }

            return Array.from(new Set(downloadedFiles))
        } catch (error) {
            result.errors.push(`下载数据失败: ${error instanceof Error ? error.message : '未知错误'}`)
            return []
        }
    }

    private normalizeRemoteObjectKey(objectKey: string): string {
        if (!this.config) {
            return objectKey
        }

        const rawPrefix = this.config.prefix
        const hasPrefix = rawPrefix.length > 0
        const normalizedPrefix = hasPrefix
            ? (rawPrefix.endsWith('/') ? rawPrefix : `${rawPrefix}/`)
            : ''

        let result = objectKey
        if (normalizedPrefix && result.startsWith(normalizedPrefix)) {
            result = result.slice(normalizedPrefix.length)
        } else if (hasPrefix && result.startsWith(rawPrefix)) {
            result = result.slice(rawPrefix.length)
        }

        return result.replace(/^\/+/, '')
    }

    /**
     * 获取远程同步元数据
     */
    private async getRemoteMetadata(): Promise<SyncMetadata | null> {
        if (!this.client) return null

        try {
            const content = await this.client.downloadFile('sync-metadata.json')

            if (content) {
                try {
                    const metadata = JSON.parse(content) as SyncMetadata
                    if (metadata.files && !Array.isArray(metadata.files)) {
                        metadata.files = []
                    }
                    return metadata
                } catch (parseError) {
                    console.warn('解析远程元数据失败，内容可能不是有效的JSON:', parseError)
                    console.warn('返回的内容片段:', content.substring(0, 200))
                    return null
                }
            }
        } catch (error) {
            console.warn('获取远程元数据失败:', error)
        }

        return null
    }

    /**
     * 获取本地同步元数据
     */
    private async getLocalMetadata(): Promise<SyncMetadata | null> {
        try {
            const metadata = await Storage.get('s3-sync-metadata')
            return metadata ? JSON.parse(metadata) : null
        } catch (_error) {
            return null
        }
    }

    /**
     * 判断是否应该上传数据（本地数据较新）
     */
    private shouldUploadData(localMetadata: SyncMetadata | null, remoteMetadata: SyncMetadata | null, currentDataHash: string): boolean {
        // 如果没有远程数据，说明是首次同步，上传本地数据
        if (!remoteMetadata) {
            console.warn('首次同步：上传本地数据到S3')
            return true
        }

        // 如果没有本地元数据，下载远程数据
        if (!localMetadata) {
            console.warn('本地无元数据：从S3下载数据')
            return false
        }

        // 核心逻辑：检测本地数据是否发生变化
        const localDataChanged = localMetadata.dataHash !== currentDataHash
        console.warn('数据变化检测:', {
            localStoredHash: localMetadata.dataHash?.substring(0, 8) || 'N/A',
            currentDataHash: currentDataHash.substring(0, 8),
            localChanged: localDataChanged,
            remoteHash: remoteMetadata.dataHash?.substring(0, 8) || 'N/A'
        })

        // 如果本地数据发生了变化，优先上传本地数据
        if (localDataChanged) {
            console.warn('本地数据已变化：上传到S3')
            return true
        }

        // 如果本地数据没有变化，比较远程数据是否更新
        if (remoteMetadata.dataHash && remoteMetadata.dataHash !== currentDataHash) {
            console.warn('远程数据更新且本地无变化：从S3下载')
            return false
        }

        // 如果双方数据都没有变化，检查时间戳作为兜底
        const timeDiff = remoteMetadata.lastSyncTime - localMetadata.lastSyncTime
        const shouldUpload = timeDiff <= 0
        console.warn(`数据无变化，基于时间戳：${shouldUpload ? '上传到S3' : '从S3下载'}`, {
            timeDiff: `${Math.round(timeDiff / 1000)}秒`
        })

        return shouldUpload
    }

    /**
     * 更新同步元数据
     */
    private async updateSyncMetadata(files: string[], dataHash: string): Promise<void> {
        const uniqueFiles = Array.from(new Set(files.filter(Boolean))).sort()

        const metadata: SyncMetadata = {
            lastSyncTime: Date.now(),
            version: '1.0.0',
            deviceId: await this.getDeviceId(),
            files: uniqueFiles,
            dataHash: dataHash
        }

        // 保存到本地
        await Storage.set('s3-sync-metadata', JSON.stringify(metadata))

        // 上传到S3
        if (this.client) {
            try {
                await this.client.uploadFile('sync-metadata.json', JSON.stringify(metadata, null, 2))
            } catch (error) {
                console.warn('上传同步元数据失败:', error)
            }
        }
    }

    /**
     * 生成数据内容哈希
     */
    private async generateDataHash(data: Record<string, unknown>): Promise<string> {
        try {
            // 将数据转换为稳定的字符串表示（排序键值）
            const sortedDataString = JSON.stringify(data, Object.keys(data).sort())

            // 使用Web Crypto API生成SHA-256哈希
            const encoder = new TextEncoder()
            const dataBuffer = encoder.encode(sortedDataString)
            const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)

            // 转换为十六进制字符串
            const hashArray = Array.from(new Uint8Array(hashBuffer))
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

            return hashHex
        } catch (error) {
            console.warn('生成数据哈希失败:', error)
            // 如果哈希生成失败，返回基于时间戳的简单标识
            return `fallback-${Date.now()}`
        }
    }

    /**
     * 获取设备ID
     */
    private async getDeviceId(): Promise<string> {
        let deviceId = await Storage.get('device-id')

        if (!deviceId) {
            // 生成基于浏览器指纹的设备ID
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            if (ctx) {
                ctx.textBaseline = 'top'
                ctx.font = '14px Arial'
                ctx.fillText('Device fingerprint', 2, 2)
            }

            const fingerprint = [
                navigator.userAgent,
                navigator.language,
                screen.width + 'x' + screen.height,
                new Date().getTimezoneOffset(),
                canvas.toDataURL()
            ].join('|')

            // 生成简单的hash
            let hash = 0
            for (let i = 0; i < fingerprint.length; i++) {
                const char = fingerprint.charCodeAt(i)
                hash = ((hash << 5) - hash) + char
                hash = hash & hash // 转换为32位整数
            }

            deviceId = `device-${Math.abs(hash).toString(36)}-${Date.now().toString(36)}`
            await Storage.set('device-id', deviceId)
        }

        return deviceId
    }

    /**
     * 检查同步状态
     */
    isSyncInProgress(): boolean {
        return this.syncInProgress
    }

    /**
     * 获取最后同步时间
     */
    async getLastSyncTime(): Promise<Date | null> {
        const metadata = await this.getLocalMetadata()
        return metadata ? new Date(metadata.lastSyncTime) : null
    }
}

export default S3SyncManager

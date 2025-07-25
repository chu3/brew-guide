'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DataManager as DataManagerUtil } from '@/lib/core/dataManager'
import { APP_VERSION } from '@/lib/core/config'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

interface DataManagerProps {
    isOpen: boolean
    onClose: () => void
    onDataChange?: () => void
}

const DataManager: React.FC<DataManagerProps> = ({ isOpen, onClose, onDataChange }) => {
    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info' | null; message: string }>({
        type: null,
        message: ''
    })


    const [showConfirmReset, setShowConfirmReset] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const isNative = Capacitor.isNativePlatform()

    const handleExport = async () => {
        try {

            const jsonData = await DataManagerUtil.exportAllData()
            const fileName = `brew-guide-data-${new Date().toISOString().slice(0, 10)}.json`

            if (isNative) {
                try {
                    // 先将文件写入临时目录
                    await Filesystem.writeFile({
                        path: fileName,
                        data: jsonData,
                        directory: Directory.Cache,
                        encoding: Encoding.UTF8
                    })

                    // 获取临时文件的URI
                    const uriResult = await Filesystem.getUri({
                        path: fileName,
                        directory: Directory.Cache
                    })

                    // 使用分享功能让用户选择保存位置
                    await Share.share({
                        title: '导出数据',
                        text: '请选择保存位置',
                        url: uriResult.uri,
                        dialogTitle: '导出数据'
                    })

                    // 清理临时文件
                    await Filesystem.deleteFile({
                        path: fileName,
                        directory: Directory.Cache
                    })

                    setStatus({
                        type: 'success',
                        message: '数据已成功导出'
                    })
                } catch (error) {
                    throw new Error(`保存文件失败: ${(error as Error).message}`)
                }
            } else {
                // Web平台的处理保持不变
                const blob = new Blob([jsonData], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = fileName
                document.body.appendChild(a)
                a.click()

                // 清理
                setTimeout(() => {
                    document.body.removeChild(a)
                    URL.revokeObjectURL(url)
                }, 100)

                setStatus({ type: 'success', message: '数据导出成功，文件已下载' })
            }
        } catch (_error) {
            setStatus({ type: 'error', message: `导出失败: ${(_error as Error).message}` })
        }
    }

    const handleImportClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click()
        }
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            const reader = new FileReader()
            reader.onload = async (event) => {
                try {
                    const jsonString = event.target?.result as string
                    const result = await DataManagerUtil.importAllData(jsonString)

                    if (result.success) {
                        setStatus({ type: 'success', message: result.message })
                        if (onDataChange) {
                            onDataChange()
                        }
                        
                        // 触发笔记全局缓存的重新初始化
                        try {
                            // 触发全局缓存重置事件
                            window.dispatchEvent(new CustomEvent('globalCacheReset'));
                            
                            // 异步重新初始化全局缓存，不阻塞UI
                            import('@/components/notes/List/globalCache')
                                .then(({ initializeGlobalCache }) => initializeGlobalCache())
                                .catch(err => console.error('重新初始化笔记缓存失败:', err));
                        } catch (cacheError) {
                            console.error('重置笔记缓存事件失败:', cacheError);
                        }
                    } else {
                        setStatus({ type: 'error', message: result.message })
                    }
                } catch (_error) {
                    setStatus({ type: 'error', message: `导入失败: ${(_error as Error).message}` })
                } finally {
                    // 重置文件输入，以便可以重新选择同一个文件
                    if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                    }
                }
            }

            reader.onerror = () => {
                setStatus({ type: 'error', message: '读取文件失败' })
            }

            reader.readAsText(file)
        } catch (_error) {
            setStatus({ type: 'error', message: `导入失败: ${(_error as Error).message}` })
        }
    }

    const handleReset = async () => {
        try {
            const result = await DataManagerUtil.resetAllData(true)

            if (result.success) {
                setStatus({ type: 'success', message: result.message })
                if (onDataChange) {
                    onDataChange()
                }
                
                // 重置时只需触发事件，页面刷新会重新初始化
                window.dispatchEvent(new CustomEvent('globalCacheReset'));

                // 设置一个短暂延迟后刷新页面
                setTimeout(() => {
                    window.location.reload()
                }, 1000) // 延迟1秒，让用户能看到成功消息
            } else {
                setStatus({ type: 'error', message: result.message })
            }
        } catch (_error) {
            setStatus({ type: 'error', message: `重置失败: ${(_error as Error).message}` })
        } finally {
            setShowConfirmReset(false)
        }
    }

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-800"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-medium">数据管理</h2>
                        <button
                            onClick={onClose}
                            className="rounded-full p-1 text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>

                    <div className="mb-6 text-xs text-neutral-500 dark:text-neutral-400">
                        <p>管理您的应用数据，包括导出、导入和重置</p>
                        <p className="mt-1">当前版本: v{APP_VERSION}</p>
                    </div>

                    {status.type && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`mb-4 rounded-md p-3 text-sm ${status.type === 'success'
                                ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                : status.type === 'error'
                                    ? 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                    : 'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                                }`}
                        >
                            {status.message}
                        </motion.div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <button
                                onClick={handleExport}
                                className="w-full rounded text-sm py-2 font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-500"
                            >
                                <span className="text-neutral-800 dark:text-neutral-200">导出</span>数据
                            </button>
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                {isNative
                                    ? '将数据导出到文档目录'
                                    : '将数据下载为 JSON 文件'}
                            </p>
                        </div>

                        <div>
                            <button
                                onClick={handleImportClick}
                                className="w-full rounded text-sm py-2 font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-500"
                            >
                               <span className="text-neutral-800 dark:text-neutral-200">导入</span>数据（<span className="text-neutral-800 dark:text-neutral-200">替换</span>）
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                导入数据将替换所有现有数据
                            </p>
                        </div>

                        <div>
                            {!showConfirmReset ? (
                                <button
                                    onClick={() => setShowConfirmReset(true)}
                                    className="w-full rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-800 transition-colors hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                                >
                                    重置数据
                                </button>
                            ) : (
                                <div className="mt-4">
                                    <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20">
                                        <div className="flex items-center space-x-2 mb-3">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-5 w-5 text-red-600 dark:text-red-400"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                                                确认重置数据
                                            </h3>
                                        </div>
                                        <p className="text-xs text-red-600 dark:text-red-400 mb-4">
                                            此操作无法撤销，数据将被删除。建议在重置前先导出备份。
                                        </p>
                                        
                                        <p className="text-xs text-red-600 dark:text-red-400 mb-4">
                                            将彻底重置数据，包括自定义器具、应用设置和导航状态。
                                        </p>
                                        
                                        <div className="flex space-x-2 justify-end">
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmReset(false)}
                                                className="px-3 py-1.5 text-xs rounded-md bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-600"
                                            >
                                                取消
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleReset}
                                                className="px-3 py-1.5 text-xs rounded-md bg-red-600 text-neutral-100 transition-colors hover:bg-red-700"
                                            >
                                                确认重置
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                完全删除数据并恢复到初始状态，包括设置和缓存
                            </p>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}

export default DataManager 
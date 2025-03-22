'use client'

import React, { useState } from 'react'
import { APP_VERSION } from '@/lib/config'
import { Storage } from '@/lib/storage'
import DataManager from './DataManager'
import hapticsUtils from '@/lib/haptics'

// 定义设置选项接口
export interface SettingsOptions {
    notificationSound: boolean
    hapticFeedback: boolean
}

// 默认设置
export const defaultSettings: SettingsOptions = {
    notificationSound: true,
    hapticFeedback: true,
}

interface SettingsProps {
    isOpen: boolean
    onClose: () => void
    settings: SettingsOptions
    setSettings: (settings: SettingsOptions) => void
    onDataChange?: () => void
}

const Settings: React.FC<SettingsProps> = ({
    isOpen,
    onClose,
    settings,
    setSettings,
    onDataChange,
}) => {
    // 添加数据管理状态
    const [isDataManagerOpen, setIsDataManagerOpen] = useState(false)

    // 处理设置变更
    const handleChange = async <K extends keyof SettingsOptions>(
        key: K,
        value: SettingsOptions[K]
    ) => {
        // 直接更新设置并保存到存储
        const newSettings = { ...settings, [key]: value }
        setSettings(newSettings)
        await Storage.set('brewGuideSettings', JSON.stringify(newSettings))
    }

    // 如果不是打开状态，不渲染任何内容
    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={onClose} // 点击背景关闭设置
        >
            <div
                className="w-full max-w-md rounded-lg bg-white/90 p-6 shadow-lg backdrop-blur-sm dark:bg-neutral-800/90"
                onClick={(e) => e.stopPropagation()} // 防止点击内容区域关闭设置
            >
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-light tracking-wide">设置</h2>
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

                <div className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
                    <p>双击应用标题可打开此面板，点击任意处关闭</p>
                </div>

                <div className="space-y-5">
                    {/* 通知设置 */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                            通知
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                                    提示音
                                </span>
                                <label className="relative inline-flex cursor-pointer items-center">
                                    <input
                                        type="checkbox"
                                        checked={settings.notificationSound}
                                        onChange={(e) =>
                                            handleChange('notificationSound', e.target.checked)
                                        }
                                        className="peer sr-only"
                                    />
                                    <div className="peer h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-500 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                                </label>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                                    震动反馈
                                </span>
                                <label className="relative inline-flex cursor-pointer items-center">
                                    <input
                                        type="checkbox"
                                        checked={settings.hapticFeedback}
                                        onChange={(e) => {
                                            // 如果开启触感反馈，提供一个预览
                                            if (e.target.checked) {
                                                hapticsUtils.medium();
                                                setTimeout(() => hapticsUtils.light(), 200);
                                            }
                                            handleChange('hapticFeedback', e.target.checked);
                                        }}
                                        className="peer sr-only"
                                    />
                                    <div className="peer h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-500 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* 数据管理 */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                            数据管理
                        </h3>
                        <div className="space-y-3">
                            <button
                                onClick={() => setIsDataManagerOpen(true)}
                                className="w-full rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600"
                            >
                                打开数据管理
                            </button>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                导入、导出或重置应用数据
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-5 text-center text-xs text-neutral-400 dark:text-neutral-500">
                    v{APP_VERSION}
                </div>
            </div>

            {/* 数据管理组件 */}
            {isDataManagerOpen && (
                <DataManager
                    isOpen={isDataManagerOpen}
                    onClose={() => setIsDataManagerOpen(false)}
                    onDataChange={onDataChange}
                />
            )}
        </div>
    )
}

export default Settings 
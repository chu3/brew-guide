'use client'

import React from 'react'
import { APP_VERSION } from '@/lib/config'

// 定义设置选项接口
export interface SettingsOptions {
    darkMode: 'system' | 'light' | 'dark'
    language: 'zh' | 'en'
    waterUnit: 'g' | 'ml'
    temperatureUnit: 'C' | 'F'
    notificationSound: boolean
    hapticFeedback: boolean
}

// 默认设置
export const defaultSettings: SettingsOptions = {
    darkMode: 'system',
    language: 'zh',
    waterUnit: 'g',
    temperatureUnit: 'C',
    notificationSound: true,
    hapticFeedback: true,
}

interface SettingsProps {
    isOpen: boolean
    onClose: () => void
    settings: SettingsOptions
    setSettings: (settings: SettingsOptions) => void
}

const Settings: React.FC<SettingsProps> = ({
    isOpen,
    onClose,
    settings,
    setSettings,
}) => {
    // 处理设置变更
    const handleChange = <K extends keyof SettingsOptions>(
        key: K,
        value: SettingsOptions[K]
    ) => {
        // 直接更新设置并保存到本地存储
        const newSettings = { ...settings, [key]: value }
        setSettings(newSettings)
        localStorage.setItem('brewGuideSettings', JSON.stringify(newSettings))
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
                    {/* 外观设置 */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                            外观
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                                    深色模式
                                </span>
                                <div className="flex overflow-hidden rounded-md border border-neutral-200 text-xs dark:border-neutral-700">
                                    <button
                                        className={`px-3 py-1.5 transition-colors ${settings.darkMode === 'light'
                                            ? 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200'
                                            : 'text-neutral-500 dark:text-neutral-500'
                                            }`}
                                        onClick={() => handleChange('darkMode', 'light')}
                                    >
                                        浅色
                                    </button>
                                    <button
                                        className={`px-3 py-1.5 transition-colors ${settings.darkMode === 'system'
                                            ? 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200'
                                            : 'text-neutral-500 dark:text-neutral-500'
                                            }`}
                                        onClick={() => handleChange('darkMode', 'system')}
                                    >
                                        系统
                                    </button>
                                    <button
                                        className={`px-3 py-1.5 transition-colors ${settings.darkMode === 'dark'
                                            ? 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200'
                                            : 'text-neutral-500 dark:text-neutral-500'
                                            }`}
                                        onClick={() => handleChange('darkMode', 'dark')}
                                    >
                                        深色
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                                    语言
                                </span>
                                <div className="flex overflow-hidden rounded-md border border-neutral-200 text-xs dark:border-neutral-700">
                                    <button
                                        className={`px-3 py-1.5 transition-colors ${settings.language === 'zh'
                                            ? 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200'
                                            : 'text-neutral-500 dark:text-neutral-500'
                                            }`}
                                        onClick={() => handleChange('language', 'zh')}
                                    >
                                        中文
                                    </button>
                                    <button
                                        className={`px-3 py-1.5 transition-colors ${settings.language === 'en'
                                            ? 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200'
                                            : 'text-neutral-500 dark:text-neutral-500'
                                            }`}
                                        onClick={() => handleChange('language', 'en')}
                                    >
                                        English
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 单位设置 */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                            单位
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                                    水量单位
                                </span>
                                <div className="flex overflow-hidden rounded-md border border-neutral-200 text-xs dark:border-neutral-700">
                                    <button
                                        className={`px-3 py-1.5 transition-colors ${settings.waterUnit === 'g'
                                            ? 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200'
                                            : 'text-neutral-500 dark:text-neutral-500'
                                            }`}
                                        onClick={() => handleChange('waterUnit', 'g')}
                                    >
                                        克(g)
                                    </button>
                                    <button
                                        className={`px-3 py-1.5 transition-colors ${settings.waterUnit === 'ml'
                                            ? 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200'
                                            : 'text-neutral-500 dark:text-neutral-500'
                                            }`}
                                        onClick={() => handleChange('waterUnit', 'ml')}
                                    >
                                        毫升(ml)
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                                    温度单位
                                </span>
                                <div className="flex overflow-hidden rounded-md border border-neutral-200 text-xs dark:border-neutral-700">
                                    <button
                                        className={`px-3 py-1.5 transition-colors ${settings.temperatureUnit === 'C'
                                            ? 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200'
                                            : 'text-neutral-500 dark:text-neutral-500'
                                            }`}
                                        onClick={() => handleChange('temperatureUnit', 'C')}
                                    >
                                        摄氏(°C)
                                    </button>
                                    <button
                                        className={`px-3 py-1.5 transition-colors ${settings.temperatureUnit === 'F'
                                            ? 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200'
                                            : 'text-neutral-500 dark:text-neutral-500'
                                            }`}
                                        onClick={() => handleChange('temperatureUnit', 'F')}
                                    >
                                        华氏(°F)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

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
                                        onChange={(e) =>
                                            handleChange('hapticFeedback', e.target.checked)
                                        }
                                        className="peer sr-only"
                                    />
                                    <div className="peer h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-500 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-5 text-center text-xs text-neutral-400 dark:text-neutral-500">
                    v{APP_VERSION}
                </div>
            </div>
        </div>
    )
}

export default Settings 
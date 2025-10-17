'use client'

import React, { useState, useEffect } from 'react'
import { SettingsOptions, defaultSettings } from '@/components/settings/Settings'
import fontZoomUtils from '@/lib/utils/fontZoomUtils'
// 移除未使用的confetti导入
import { availableGrinders } from '@/lib/core/config'

// 设置页面界面属性
interface OnboardingProps {
    onSettingsChange: (settings: SettingsOptions) => void
    onComplete: () => void
}

// 主组件
const Onboarding: React.FC<OnboardingProps> = ({ onSettingsChange, onComplete }) => {
    // 设置选项
    const [settings, setSettings] = useState<SettingsOptions>(defaultSettings)
    // 检查字体缩放功能是否可用
    const [isFontZoomEnabled, setIsFontZoomEnabled] = useState(false)
    // 是否显示磨豆机选择界面
    const [showGrinderSelect, setShowGrinderSelect] = useState(false)

    // 初始化
    useEffect(() => {
        // 检查字体缩放功能是否可用
        setIsFontZoomEnabled(fontZoomUtils.isAvailable());
    }, [])

    // 移除未使用的彩带特效函数

    // 处理设置变更
    const handleSettingChange = <K extends keyof SettingsOptions>(key: K, value: SettingsOptions[K]) => {
        setSettings(prev => {
            const newSettings = { ...prev, [key]: value }
            return newSettings
        })

        // 当改变字体缩放级别时立即应用
        if (key === 'textZoomLevel') {
            fontZoomUtils.set(value as number)
        }

        // 当选择特定磨豆机时可以提供反馈（移除硬编码特定品牌的特殊处理）
        // if (key === 'grindType' && value !== 'generic') {
        //     // 可以在这里添加通用的反馈逻辑
        // }
    }

    // 处理完成按钮点击
    const handleComplete = async () => {
        try {
            // 动态导入 Storage
            const { Storage } = await import('@/lib/core/storage');
            // 保存用户设置
            await Storage.set('brewGuideSettings', JSON.stringify(settings))
            // 标记引导已完成
            await Storage.set('onboardingCompleted', 'true')

            // 应用字体缩放级别
            if (settings.textZoomLevel) {
                fontZoomUtils.set(settings.textZoomLevel);
            }

            // 通知上层组件设置已变更
            onSettingsChange(settings)
            // 调用完成回调
            onComplete()
        } catch (error) {
            console.error('完成引导设置时发生错误:', error);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
            {/* 半透明背景 */}
            <div className="absolute inset-0 bg-neutral-900/30 dark:bg-neutral-950/50" />

            {/* 设置内容卡片 */}
            <div className="relative w-full bg-neutral-50 dark:bg-neutral-900 rounded-t-2xl pb-safe-bottom">
                {/* 内容容器 */}
                <div className="relative flex flex-col pt-4 pb-6 px-5">
                    {/* 上方把手示意 */}
                    <div className="flex justify-center mb-3">
                        <div className="w-10 h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full"></div>
                    </div>

                    {/* 内容区域 */}
                    <div className="relative">
                        <div className="flex flex-col w-full">
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-200">
                                    欢迎使用
                                </h2>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
                                    设置偏好，获得更好的使用体验
                                </p>
                            </div>

                            <div className="w-full space-y-4">

                                {/* 字体缩放选项 - 仅在可用时显示 */}
                                {isFontZoomEnabled && (
                                    <div className="flex items-center justify-between bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg">
                                        <div className="flex flex-col">
                                            <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                                字体大小
                                            </label>

                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => handleSettingChange('textZoomLevel', Math.max(0.8, settings.textZoomLevel - 0.1))}
                                                className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200"
                                                disabled={settings.textZoomLevel <= 0.8}
                                            >
                                                <span className="text-base font-semibold">−</span>
                                            </button>
                                            <button
                                                onClick={() => handleSettingChange('textZoomLevel', 1.0)}
                                                className="px-3 h-7 text-xs font-medium rounded-full transition-colors bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                                            >
                                                {settings.textZoomLevel.toFixed(1)}×
                                            </button>
                                            <button
                                                onClick={() => handleSettingChange('textZoomLevel', Math.min(1.4, settings.textZoomLevel + 0.1))}
                                                className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200"
                                                disabled={settings.textZoomLevel >= 1.4}
                                            >
                                                <span className="text-base font-semibold">+</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* 磨豆机选择 */}
                                <div id="onboarding-grinder-select-wrapper" className="bg-neutral-100 dark:bg-neutral-800 p-4 rounded-xl">
                                    <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-1 block">
                                        磨豆机
                                    </label>
                                    
                                    {/* 显示已选择的磨豆机 */}
                                    <div className="mt-3 space-y-2">
                                        {(settings.myGrinders || ['generic']).map((grinderId) => {
                                            const grinder = availableGrinders.find(g => g.id === grinderId)
                                            if (!grinder) return null
                                            
                                            return (
                                                <div
                                                    key={grinderId}
                                                    className="flex items-center justify-between py-2 px-3 bg-neutral-50 dark:bg-neutral-700 rounded-lg"
                                                >
                                                    <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                                        {grinder.name}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    
                                    {/* 添加磨豆机按钮 */}
                                    <button
                                        onClick={() => setShowGrinderSelect(true)}
                                        className="w-full mt-3 py-2 px-3 text-sm font-medium rounded-lg bg-neutral-50 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                                    >
                                        + 添加/移除磨豆机
                                    </button>
                                    
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                                        选择你拥有的磨豆机，后续可在设置中调整或添加自定义磨豆机
                                    </p>
                                </div>

                                {/* 用户名输入 */}
                                <div className="bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg">
                                    <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-1 block">
                                        用户名
                                    </label>
                                    <input
                                        type="text"
                                        value={settings.username}
                                        onChange={(e) => handleSettingChange('username', e.target.value)}
                                        placeholder="请输入您的用户名"
                                        className="w-full py-2 px-3 mt-1 text-sm font-medium rounded-lg bg-neutral-50 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 appearance-none focus:outline-hidden focus:ring-2 focus:ring-neutral-500"
                                    />
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                                        使用分享功能时，会显示您的用户名（选填）
                                    </p>
                                </div>
                            </div> 
                            {/* 底部按钮 */}
                            <div className="mt-8">
                                <button
                                    onClick={handleComplete}
                                    className="w-full py-3 px-4 bg-neutral-800 dark:bg-neutral-50 text-neutral-100 dark:text-neutral-900 rounded-lg font-medium hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors"
                                >
                                    开始使用
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 磨豆机选择弹窗 */}
            {showGrinderSelect && (
                <div className="absolute inset-0 z-10 flex flex-col bg-neutral-50 dark:bg-neutral-900">
                    {/* 头部 */}
                    <div className="flex items-center justify-between px-5 py-4">
                        <button
                            onClick={() => setShowGrinderSelect(false)}
                            className="text-sm font-medium text-neutral-600 dark:text-neutral-400"
                        >
                            返回
                        </button>
                        <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200">
                            选择磨豆机
                        </h3>
                        <div className="w-12" /> {/* 占位平衡布局 */}
                    </div>

                    {/* 磨豆机列表 */}
                    <div className="flex-1 overflow-y-auto px-5 space-y-2">
                        {availableGrinders.map((grinder) => {
                            const isSelected = (settings.myGrinders || ['generic']).includes(grinder.id)
                            const isOnlyOne = (settings.myGrinders || ['generic']).length === 1
                            
                            return (
                                <button
                                    key={grinder.id}
                                    onClick={() => {
                                        const currentList = settings.myGrinders || ['generic']
                                        let newList: string[]
                                        
                                        if (isSelected) {
                                            // 取消选择（至少保留一个）
                                            if (isOnlyOne) return
                                            newList = currentList.filter(id => id !== grinder.id)
                                        } else {
                                            // 添加选择
                                            newList = [...currentList, grinder.id]
                                        }
                                        
                                        handleSettingChange('myGrinders', newList)
                                        
                                        // 如果当前选中的 grindType 被移除，更新为列表中的第一个
                                        if (!newList.includes(settings.grindType)) {
                                            handleSettingChange('grindType', newList[0])
                                        }
                                    }}
                                    disabled={isSelected && isOnlyOne}
                                    className={`w-full py-3 px-4 text-sm font-medium rounded-lg transition-colors text-left flex items-center justify-between ${
                                        isSelected
                                            ? 'bg-neutral-800 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-800'
                                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                                    } ${isSelected && isOnlyOne ? 'opacity-50' : ''}`}
                                >
                                    <span>{grinder.name}</span>
                                    {isSelected && (
                                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {/* 提示信息 */}
                    <div className="px-5 pb-6 pt-4">
                        <p className="text-xs text-center text-neutral-500 dark:text-neutral-400">
                            至少选择一个磨豆机
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Onboarding 
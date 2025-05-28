'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { MainTabType, BrewingStep } from '@/lib/hooks/useBrewingState'
import { saveMainTabPreference } from '@/lib/navigation/navigationCache'
import hapticsUtils from '@/lib/ui/haptics'

interface BottomNavigationBarProps {
    activeMainTab: MainTabType
    setActiveMainTab: (tab: MainTabType) => void
    setShowHistory: (show: boolean) => void
    settings: { hapticFeedback?: boolean }
    // 添加导航逻辑相关的props
    activeBrewingStep: BrewingStep
    hasCoffeeBeans?: boolean
    _onBackClick?: () => void
}

// 极简底部导航按钮组件
interface BottomTabButtonProps {
    tab: string
    isActive: boolean
    onClick: () => void
}

const BottomTabButton: React.FC<BottomTabButtonProps> = ({
    tab, isActive, onClick
}) => {
    return (
        <button
            onClick={onClick}
            className="flex flex-col items-center justify-center py-3 px-4 min-w-0 flex-1"
        >
            <span className="text-[11px] tracking-widest text-neutral-800 dark:text-neutral-100 mb-2">
                {tab}
            </span>
            {/* 圆点指示器 - 始终存在，用透明度控制 */}
            <div
                className={`w-0.5 h-0.5 rounded-full bg-neutral-800 dark:bg-neutral-100 transition-opacity duration-200 ${
                    isActive ? 'opacity-100' : 'opacity-0'
                }`}
            />
        </button>
    )
}

// 导航相关常量和工具（复用NavigationBar的逻辑）
const NAVIGABLE_STEPS: Record<BrewingStep, BrewingStep | null> = {
    'brewing': 'method',
    'method': 'coffeeBean',
    'coffeeBean': null,
    'notes': 'brewing'
}

// 自定义Hook：处理导航逻辑（只在冲煮页面有效）
const useNavigation = (activeBrewingStep: BrewingStep, activeMainTab: MainTabType, hasCoffeeBeans?: boolean) => {
    const shouldHide = React.useCallback((): boolean => {
        // 只有在冲煮页面才考虑隐藏逻辑
        if (activeMainTab !== '冲煮') return false

        // 在冲煮页面的深层步骤时隐藏底部导航栏
        if (activeBrewingStep === 'method' && !hasCoffeeBeans) return false
        return NAVIGABLE_STEPS[activeBrewingStep] !== null
    }, [activeBrewingStep, activeMainTab, hasCoffeeBeans])

    return { shouldHide }
}

const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({
    activeMainTab, setActiveMainTab, setShowHistory, settings,
    activeBrewingStep, hasCoffeeBeans, _onBackClick
}) => {
    const t = useTranslations('nav')
    const { shouldHide } = useNavigation(activeBrewingStep, activeMainTab, hasCoffeeBeans)

    const handleMainTabClick = (tab: MainTabType) => {
        if (activeMainTab === tab) return

        if (settings.hapticFeedback) {
            hapticsUtils.light()
        }

        // 保存主标签页选择到缓存
        saveMainTabPreference(tab)

        setActiveMainTab(tab)
        if (tab === '笔记') {
            setShowHistory(true)
        } else if (activeMainTab === '笔记') {
            setShowHistory(false)
        }
    }

    // 如果应该隐藏，则不渲染（高度变化，不占位）
    if (shouldHide()) {
        return null
    }

    return (
        <div className="bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800">
            <div className="max-w-[500px] mx-auto flex">
                <BottomTabButton
                    tab={t('main.brewing')}
                    isActive={activeMainTab === '冲煮'}
                    onClick={() => handleMainTabClick('冲煮')}
                />
                <BottomTabButton
                    tab={t('main.beans')}
                    isActive={activeMainTab === '咖啡豆'}
                    onClick={() => handleMainTabClick('咖啡豆')}
                />
                <BottomTabButton
                    tab={t('main.notes')}
                    isActive={activeMainTab === '笔记'}
                    onClick={() => handleMainTabClick('笔记')}
                />
            </div>
            {/* 安全区域底部间距 */}
            <div className="h-[env(safe-area-inset-bottom)]" />
        </div>
    )
}

export default BottomNavigationBar

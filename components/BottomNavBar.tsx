'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { APP_VERSION } from '@/lib/config'
import hapticsUtils from '@/lib/haptics'
import { SettingsOptions } from '@/components/Settings'
import { MainTabType } from '@/lib/hooks/useBrewingState'

// 添加TabButton组件
const TabButton = ({
    tab,
    isActive,
    onClick,
    className = '',
}: {
    tab: string
    isActive: boolean
    onClick?: () => void
    className?: string
}) => {
    // 处理点击事件
    const handleClick = () => {
        if (onClick) {
            onClick();
        }
    };

    return (
        <div
            onClick={handleClick}
            className={`text-center flex-1 py-3 transition-all duration-300 ${className} ${isActive
                ? 'text-neutral-800 dark:text-neutral-100 border-t-2 border-neutral-800 dark:border-neutral-100'
                : 'text-neutral-400 dark:text-neutral-500 border-t border-transparent'
                }`}
        >
            <span className="text-[12px] tracking-widest">{tab}</span>
        </div>
    );
};

interface BottomNavBarProps {
    activeMainTab: MainTabType;
    setActiveMainTab: (tab: MainTabType) => void;
    setShowHistory: (show: boolean) => void;
    settings: SettingsOptions;
}

const BottomNavBar: React.FC<BottomNavBarProps> = ({
    activeMainTab,
    setActiveMainTab,
    setShowHistory,
    settings,
}) => {
    // 处理主导航标签点击
    const handleMainTabClick = (tab: MainTabType) => {
        // 如果已经在选中的标签，不做任何操作
        if (activeMainTab === tab) return;

        if (settings.hapticFeedback) {
            hapticsUtils.light(); // 添加轻触感反馈
        }

        if (tab === '首页') {
            setActiveMainTab('首页');
            // 从其他标签切换回首页时，确保关闭历史记录显示
            if (activeMainTab === '笔记') {
                setShowHistory(false);
            }
        } else if (tab === '冲煮') {
            setActiveMainTab('冲煮');
            // 从笔记切换回冲煮时，确保关闭历史记录显示
            if (activeMainTab === '笔记') {
                setShowHistory(false);
            }
        } else if (tab === '笔记') {
            setActiveMainTab('笔记');
            setShowHistory(true);
        }
    };

    return (
        <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-50/95 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 flex pb-safe"
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={{
                maxWidth: '500px',
                margin: '0 auto',
                width: '100%'
            }}
        >
            <TabButton
                tab="首页"
                isActive={activeMainTab === '首页'}
                onClick={() => handleMainTabClick('首页')}
                className="text-xs sm:text-sm"
            />
            <TabButton
                tab="冲煮"
                isActive={activeMainTab === '冲煮'}
                onClick={() => handleMainTabClick('冲煮')}
                className="text-xs sm:text-sm"
            />
            <TabButton
                tab="笔记"
                isActive={activeMainTab === '笔记'}
                onClick={() => handleMainTabClick('笔记')}
                className="text-xs sm:text-sm"
            />
        </motion.div>
    );
};

export default BottomNavBar; 
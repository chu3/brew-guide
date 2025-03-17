'use client'

import React from 'react'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

// 定义主导航类型
export type MainTabType = '首页' | '咖啡豆' | '冲煮' | '笔记' | '我的';

interface BottomNavBarProps {
    activeMainTab: MainTabType;
    setActiveMainTab: (tab: MainTabType) => void;
}

const BottomNavBar: React.FC<BottomNavBarProps> = ({
    activeMainTab,
    setActiveMainTab
}) => {
    // 导航项配置
    const navItems: MainTabType[] = ['首页', '咖啡豆', '冲煮', '笔记', '我的'];

    // 处理导航项点击，添加触感反馈
    const handleNavItemClick = async (item: MainTabType) => {
        if (item === activeMainTab) return; // 如果点击当前活动标签，不执行操作

        try {
            // 使用轻度触感反馈，更接近iOS原生体验
            await Haptics.impact({ style: ImpactStyle.Light });

            // 更新活动标签
            setActiveMainTab(item);
        } catch {
            // 如果触感反馈失败，仍然更新标签
            setActiveMainTab(item);
        }
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 pb-safe">
            <div className="flex items-center justify-between px-4 py-3">
                {navItems.map((item) => (
                    <button
                        key={item}
                        onClick={() => handleNavItemClick(item)}
                        className={`flex flex-col items-center justify-center px-2 py-1 ${activeMainTab === item
                            ? 'text-neutral-800 dark:text-neutral-100'
                            : 'text-neutral-400 dark:text-neutral-500'
                            }`}
                    >
                        <span className="text-xs tracking-wider">{item}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default BottomNavBar; 
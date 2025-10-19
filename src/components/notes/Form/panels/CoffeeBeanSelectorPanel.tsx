'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Shuffle, Search } from 'lucide-react'
import type { CoffeeBean } from '@/types/app'
import CoffeeBeanSelector from '../CoffeeBeanSelector'
import { useCoffeeBeanData } from '../hooks/useCoffeeBeanData'

interface CoffeeBeanSelectorPanelProps {
    selectedBean: CoffeeBean | null
    onSelect: (bean: CoffeeBean | null) => void
    onClose: () => void
    onRandomPick: () => void
}

const CoffeeBeanSelectorPanel: React.FC<CoffeeBeanSelectorPanelProps> = ({
    selectedBean,
    onSelect,
    onClose,
    onRandomPick
}) => {
    const { beans } = useCoffeeBeanData()
    const [searchQuery, setSearchQuery] = useState('')
    const searchInputRef = React.useRef<HTMLInputElement>(null)
    const scrollContainerRef = React.useRef<HTMLDivElement>(null)
    const [scrollParent, setScrollParent] = React.useState<HTMLElement | null>(null)

    // 在组件挂载后设置滚动父容器
    useEffect(() => {
        if (scrollContainerRef.current) {
            setScrollParent(scrollContainerRef.current)
        }
    }, [])

    // 处理搜索框的焦点
    const handleSearchBlur = () => {
        // 移除自动重新聚焦的逻辑，让用户控制焦点
    }

    // 处理关闭动画
    const handleClose = () => {
        onClose()
    }

    // 处理选择咖啡豆
    const handleSelect = (bean: CoffeeBean | null) => {
        onSelect(bean)
        onClose()
    }

    return (
        <>
            {/* 背景遮罩 - 使用 motion 动画 */}
            <motion.div
                initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                animate={{ opacity: 1, backdropFilter: "blur(4px)" }}
                exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="fixed inset-0 z-[60] bg-neutral-50/90 dark:bg-neutral-900/90"
                onClick={handleClose}
            />

            {/* 内容区域 - 使用 motion 动画 */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                animate={{ 
                    opacity: 1, 
                    scale: 1, 
                    filter: "blur(0px)"
                }}
                exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                transition={{ 
                    duration: 0.3,
                    ease: "easeOut"
                }}
                className="fixed inset-x-4 top-20 bottom-20 z-[61] border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-xl overflow-hidden flex flex-col max-w-md mx-auto"
            >
                {/* 顶部标题栏 */}
                <div className="flex items-center justify-between px-6 py-4 border-neutral-200 dark:border-neutral-700">
                    <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-200">
                        选择咖啡豆
                    </h3>
                    <div className="flex items-center gap-2">
                        {beans.length > 0 && (
                            <button
                                type="button"
                                onClick={onRandomPick}
                                className="p-2 text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 rounded-full transition-colors"
                                title="随机选择"
                            >
                                <Shuffle size={12} />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleClose}
                            className="p-2 text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 rounded-full transition-colors"
                        >
                            <X size={12} />
                        </button>
                    </div>
                </div>

                {/* 搜索框 */}
                <div className="px-5 pb-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none" size={16} />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onBlur={handleSearchBlur}
                            placeholder="搜索咖啡豆..."
                            className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-100 dark:bg-neutral-800 border-0 rounded-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-600 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-neutral-800 dark:text-neutral-200"
                        />
                    </div>
                </div>

                {/* 内容区域 - 可滚动 */}
                <div 
                    ref={scrollContainerRef} 
                    className="flex-1 overflow-y-auto px-6"
                    style={{
                        WebkitOverflowScrolling: 'touch'
                    }}
                >
                    {/* 咖啡豆列表 */}
                    {beans.length > 0 ? (
                        <CoffeeBeanSelector
                            coffeeBeans={beans}
                            selectedCoffeeBean={selectedBean}
                            onSelect={handleSelect}
                            searchQuery={searchQuery}
                            scrollParentRef={scrollParent || undefined}
                        />
                    ) : (
                        <div className="text-center py-12 text-sm text-neutral-400 dark:text-neutral-500">
                            暂无咖啡豆
                        </div>
                    )}
                </div>
            </motion.div>
        </>
    )
}

export default CoffeeBeanSelectorPanel

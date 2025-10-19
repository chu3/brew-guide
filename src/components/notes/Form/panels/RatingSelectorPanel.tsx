'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight } from 'lucide-react'
import { CustomFlavorDimensionsManager, FlavorDimension } from '@/lib/managers/customFlavorDimensions'

// 滑块样式 - 与 BrewingNoteForm 保持一致
const SLIDER_STYLES = `relative h-px w-full appearance-none bg-neutral-300 dark:bg-neutral-600 cursor-pointer touch-none
[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-solid
[&::-webkit-slider-thumb]:border-neutral-300 [&::-webkit-slider-thumb]:bg-neutral-50
[&::-webkit-slider-thumb]:shadow-none [&::-webkit-slider-thumb]:outline-none
dark:[&::-webkit-slider-thumb]:border-neutral-600 dark:[&::-webkit-slider-thumb]:bg-neutral-900
[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:appearance-none
[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-solid
[&::-moz-range-thumb]:border-neutral-300 [&::-moz-range-thumb]:bg-neutral-50
[&::-moz-range-thumb]:shadow-none [&::-moz-range-thumb]:outline-none
dark:[&::-moz-range-thumb]:border-neutral-600 dark:[&::-moz-range-thumb]:bg-neutral-900`

interface RatingSelectorPanelProps {
    rating: number
    tasteRatings: Record<string, number>
    onRatingChange: (rating: number) => void
    onTasteRatingsChange: (tasteRatings: Record<string, number>) => void
    onClose: () => void
}

const RatingSelectorPanel: React.FC<RatingSelectorPanelProps> = ({
    rating: initialRating,
    tasteRatings: initialTasteRatings,
    onRatingChange,
    onTasteRatingsChange,
    onClose
}) => {
    const [rating, setRating] = useState(initialRating)
    const [tasteRatings, setTasteRatings] = useState(initialTasteRatings)
    const [flavorDimensions, setFlavorDimensions] = useState<FlavorDimension[]>([])
    const [currentSliderValue, setCurrentSliderValue] = useState<number | null>(null)
    const [showFlavorRatings, setShowFlavorRatings] = useState(false)

    // 加载风味维度
    useEffect(() => {
        const loadFlavorDimensions = async () => {
            try {
                const dimensions = await CustomFlavorDimensionsManager.getFlavorDimensions()
                setFlavorDimensions(dimensions)
            } catch (error) {
                console.error('加载风味维度失败:', error)
            }
        }
        loadFlavorDimensions()
    }, [])

    // 如果有风味评分数据，默认展开
    useEffect(() => {
        if (Object.keys(initialTasteRatings).length > 0) {
            setShowFlavorRatings(true)
        }
    }, [initialTasteRatings])

    // 通用滑块触摸处理 - 与 BrewingNoteForm 保持一致
    const createSliderHandlers = useCallback((
        updateFn: (value: number) => void,
        min: number = 0,
        max: number = 5,
        step: number = 1
    ) => ({
        onTouchStart: (value: number) => (e: React.TouchEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setCurrentSliderValue(value);
        },
        onTouchMove: (e: React.TouchEvent) => {
            if (currentSliderValue === null) return;
            const touch = e.touches[0];
            const target = e.currentTarget as HTMLInputElement;
            const rect = target.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
            const newValue = min + Math.round(percentage * (max - min) / step) * step;
            if (newValue !== currentSliderValue) {
                updateFn(newValue);
                setCurrentSliderValue(newValue);
            }
        },
        onTouchEnd: () => setCurrentSliderValue(null)
    }), [currentSliderValue])

    // 总体评分滑块处理器
    const ratingHandlers = createSliderHandlers(setRating, 0, 5, 0.5)

    // 风味评分滑块处理器
    const tasteHandlers = useCallback((dimensionId: string) =>
        createSliderHandlers(
            (value) => setTasteRatings(prev => ({ ...prev, [dimensionId]: value })),
            0,
            5,
            1
        ),
        [createSliderHandlers]
    )

    const handleConfirm = () => {
        onRatingChange(rating)
        onTasteRatingsChange(tasteRatings)
        onClose()
    }

    // 处理关闭动画
    const handleClose = () => {
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

            {/* 内容容器 - 使用 flexbox 底部对齐 */}
            <div className="fixed inset-0 z-[61] flex items-end justify-center pb-20 pointer-events-none">
                <div className="w-full max-w-md mx-4 flex flex-col gap-3 pointer-events-auto">
                    {/* 标题栏 + 总体评分块 合并 */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                        transition={{
                            duration: 0.3,
                            ease: "easeOut"
                        }}
                        className="border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-xl"
                    >
                        {/* 标题栏 */}
                        <div className="flex items-center justify-between px-5 py-4">
                            <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-200">
                                评分
                            </h3>
                            <button
                                type="button"
                                onClick={handleClose}
                                className="p-2 text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 rounded-full transition-colors"
                            >
                                <X size={12} />
                            </button>
                        </div>

                        {/* 总体评分 */}
                        <div className="px-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                                    总体评分
                                </div>
                                <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                                    [ {rating.toFixed(1)} ]
                                </div>
                            </div>
                            <div className="relative py-4">
                                <input
                                    type="range"
                                    min="0"
                                    max="5"
                                    step="0.5"
                                    value={rating}
                                    onChange={(e) => setRating(parseFloat(e.target.value))}
                                    onTouchStart={ratingHandlers.onTouchStart(rating)}
                                    onTouchMove={ratingHandlers.onTouchMove}
                                    onTouchEnd={ratingHandlers.onTouchEnd}
                                    className={SLIDER_STYLES}
                                />
                            </div>
                        </div>
                    </motion.div>

                    {/* 风味评分块 - 可展开/收起 */}
                    {flavorDimensions.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                            exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                            transition={{
                                duration: 0.3,
                                ease: "easeOut",
                                delay: 0.05
                            }}
                            layout
                            className="border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-xl overflow-hidden"
                        >
                            <button
                                type="button"
                                onClick={() => setShowFlavorRatings(!showFlavorRatings)}
                                className="flex items-center justify-between px-5 py-4 w-full text-left"
                            >
                                <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                                    风味评分
                                </div>
                                <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 transition-colors">
                                    [ {showFlavorRatings ? '收起' : '展开'} ]
                                </div>
                            </button>

                            <AnimatePresence>
                                {showFlavorRatings && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                        className="overflow-hidden"
                                    >
                                        <div
                                            className="overflow-y-auto px-5 py-4"
                                            style={{
                                                WebkitOverflowScrolling: 'touch',
                                                maxHeight: '50vh'
                                            }}
                                        >
                                            <div className="grid grid-cols-2 gap-8">
                                                {flavorDimensions.map((dimension) => {
                                                    const value = tasteRatings[dimension.id] || 0
                                                    return (
                                                        <div key={dimension.id} className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                                                                    {dimension.label}
                                                                </div>
                                                                <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                                                                    [ {value} ]
                                                                </div>
                                                            </div>
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="5"
                                                                step="1"
                                                                value={value}
                                                                onChange={(e) =>
                                                                    setTasteRatings({
                                                                        ...tasteRatings,
                                                                        [dimension.id]: parseInt(e.target.value)
                                                                    })
                                                                }
                                                                onTouchStart={tasteHandlers(dimension.id).onTouchStart(value)}
                                                                onTouchMove={tasteHandlers(dimension.id).onTouchMove}
                                                                onTouchEnd={tasteHandlers(dimension.id).onTouchEnd}
                                                                className={SLIDER_STYLES}
                                                            />
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}

                    {/* 确认按钮 */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                        transition={{
                            duration: 0.3,
                            ease: "easeOut",
                            delay: 0.1
                        }}
                    >
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="w-full py-4 px-5 bg-white dark:bg-neutral-900 rounded-xl text-sm font-medium text-neutral-500 dark:text-neutral-200 tracking-widest hover:bg-neutral-200 dark:hover:bg-neutral-700 active:scale-95 transition-all border border-neutral-100 dark:border-neutral-800 flex items-center justify-between"
                    >
                            <span>添加评分</span>
                            <ChevronRight size={16} />
                        </button>
                    </motion.div>
                </div>
            </div>
        </>
    )
}

export default RatingSelectorPanel

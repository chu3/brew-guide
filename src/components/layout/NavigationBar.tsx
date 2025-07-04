'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { equipmentList, type CustomEquipment } from '@/lib/core/config'
import hapticsUtils from '@/lib/ui/haptics'
import { SettingsOptions } from '@/components/settings/Settings'
import { formatGrindSize } from '@/lib/utils/grindUtils'
import { BREWING_EVENTS, ParameterInfo } from '@/lib/brewing/constants'
import { listenToEvent } from '@/lib/brewing/events'
import { updateParameterInfo, getEquipmentName } from '@/lib/brewing/parameters'

import { Equal, ArrowLeft, ChevronsUpDown } from 'lucide-react'
import { saveStringState } from '@/lib/core/statePersistence'
import { saveMainTabPreference } from '@/lib/navigation/navigationCache'
import { ViewOption, VIEW_LABELS } from '@/components/coffee-bean/List/types'

// 统一类型定义
type TabType = '方案' | '注水' | '记录'
type MainTabType = '冲煮' | '咖啡豆' | '笔记'
type BrewingStep = 'coffeeBean' | 'method' | 'brewing' | 'notes'

interface EditableParams {
    coffee: string
    water: string
    ratio: string
    grindSize: string
    temp: string
}

// 优化的 TabButton 组件 - 使用更简洁的条件渲染和样式计算
interface TabButtonProps {
    tab: string
    isActive: boolean
    isDisabled?: boolean
    onClick?: () => void
    className?: string
    dataTab?: string
}

const TabButton: React.FC<TabButtonProps> = ({
    tab, isActive, isDisabled = false, onClick, className = '', dataTab
}) => {
    const baseClasses = 'text-xs font-medium tracking-widest whitespace-nowrap pb-3'
    const stateClasses = isActive
        ? 'text-neutral-800 dark:text-neutral-100'
        : isDisabled
            ? 'text-neutral-300 dark:text-neutral-600'
            : 'cursor-pointer text-neutral-500 dark:text-neutral-400'

    return (
        <div
            onClick={!isDisabled && onClick ? onClick : undefined}
            className={`${baseClasses} ${stateClasses} ${className}`}
            data-tab={dataTab}
        >
            <span className="relative inline-block">
                {tab}
            </span>
        </div>
    )
}

// 自定义Hook：处理触感反馈
const useHapticFeedback = (settings: { hapticFeedback?: boolean }) =>
    useCallback(async () => {
        if (settings?.hapticFeedback) hapticsUtils.light()
    }, [settings?.hapticFeedback])

// 自定义Hook：处理编辑模式状态
const useEditMode = () => {
    const [editingEquipment, setEditingEquipment] = useState<string | null>(null)

    const enterEditMode = useCallback((equipmentId: string) => {
        setEditingEquipment(equipmentId)
    }, [])

    const exitEditMode = useCallback(() => {
        setEditingEquipment(null)
    }, [])

    return { editingEquipment, enterEditMode, exitEditMode }
}

// 器具指示器组件接口
interface EquipmentIndicatorProps {
    selectedEquipment: string | null
    customEquipments: CustomEquipment[]
    onEquipmentSelect: (equipmentId: string) => void
    onAddEquipment: () => void
    onEditEquipment: (equipment: CustomEquipment) => void
    onDeleteEquipment: (equipment: CustomEquipment) => void
    onShareEquipment: (equipment: CustomEquipment) => void
    settings: { hapticFeedback?: boolean }
}

const EquipmentIndicator: React.FC<EquipmentIndicatorProps> = ({
    selectedEquipment, customEquipments, onEquipmentSelect, onAddEquipment,
    onEditEquipment, onDeleteEquipment, onShareEquipment, settings
}) => {
    const triggerHaptic = useHapticFeedback(settings)
    const { editingEquipment, enterEditMode, exitEditMode } = useEditMode()
    const scrollContainerRef = React.useRef<HTMLDivElement>(null)
    const [showLeftBorder, setShowLeftBorder] = React.useState(false)
    const [showRightBorder, setShowRightBorder] = React.useState(false)

    // 合并所有器具数据
    const allEquipments = [
        ...equipmentList.map((eq) => ({ ...eq, isCustom: false })),
        ...customEquipments
    ]

    // 创建处理函数的工厂
    const createHandler = <T extends unknown[]>(action: (...args: T) => void) => async (...args: T) => {
        await triggerHaptic()
        action(...args)
    }

    // 使用工厂函数创建处理器
    const handlers = {
        equipment: createHandler((id: string) => {
            // 检查是否是自定义器具且已选中，如果是则进入编辑模式
            const equipment = allEquipments.find(eq => eq.id === id)
            if (equipment?.isCustom && selectedEquipment === id) {
                enterEditMode(id)
            } else {
                onEquipmentSelect(id)
                // 保存器具选择到缓存
                saveStringState('brewing-equipment', 'selectedEquipment', id)
            }
        }),
        add: createHandler(() => onAddEquipment()),
        edit: createHandler((equipment: CustomEquipment) => onEditEquipment(equipment)),
        delete: createHandler((equipment: CustomEquipment) => onDeleteEquipment(equipment)),
        share: createHandler((equipment: CustomEquipment) => onShareEquipment(equipment)),
        exitEdit: createHandler(() => {
            exitEditMode()
            // 退出编辑模式后滚动到选中的器具
            setTimeout(scrollToSelected, 100)
        })
    }

    // 滚动到选中项的函数
    const scrollToSelected = React.useCallback(() => {
        if (!scrollContainerRef.current || !selectedEquipment) return

        const selectedElement = scrollContainerRef.current.querySelector(`[data-tab="${selectedEquipment}"]`)
        if (!selectedElement) return

        const container = scrollContainerRef.current
        const containerRect = container.getBoundingClientRect()
        const elementRect = selectedElement.getBoundingClientRect()

        // 计算元素相对于容器的位置
        const elementLeft = elementRect.left - containerRect.left + container.scrollLeft
        const elementWidth = elementRect.width
        const containerWidth = containerRect.width

        // 计算目标滚动位置（将选中项居中）
        const targetScrollLeft = elementLeft - (containerWidth - elementWidth) / 2

        // 平滑滚动到目标位置
        container.scrollTo({
            left: Math.max(0, targetScrollLeft),
            behavior: 'smooth'
        })
    }, [selectedEquipment])

    // 点击外部退出编辑模式
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement
            if (!target.closest('[data-edit-mode]') && editingEquipment) {
                exitEditMode()
                // 退出编辑模式后滚动到选中的器具
                setTimeout(scrollToSelected, 100)
            }
        }

        if (editingEquipment) {
            document.addEventListener('click', handleClickOutside)
            return () => document.removeEventListener('click', handleClickOutside)
        }
    }, [editingEquipment, exitEditMode, scrollToSelected])

    // 当选中项变化时滚动到选中项
    React.useEffect(() => {
        // 延迟执行以确保DOM已更新
        const timer = setTimeout(scrollToSelected, 100)
        return () => clearTimeout(timer)
    }, [scrollToSelected])

    // 当编辑模式状态变化时触发滚动（从编辑模式退出到正常模式时）
    React.useEffect(() => {
        if (!editingEquipment && selectedEquipment) {
            // 从编辑模式退出时，延迟更长时间确保AnimatePresence动画完成后DOM已更新
            const timer = setTimeout(scrollToSelected, 300)
            return () => clearTimeout(timer)
        }
    }, [editingEquipment, selectedEquipment, scrollToSelected])

    // 构建所有项目数据
    const allItems = [
        ...allEquipments.map(equipment => ({
            type: 'equipment' as const,
            id: equipment.id,
            name: equipment.name,
            isSelected: selectedEquipment === equipment.id,
            isCustom: equipment.isCustom || false,
            onClick: () => handlers.equipment(equipment.id)
        })),
        {
            type: 'addButton' as const,
            id: 'add',
            name: '添加器具',
            isSelected: false,
            isCustom: false,
            onClick: handlers.add
        }
    ]

    // 监听滚动事件来控制左右边框显示
    React.useEffect(() => {
        const container = scrollContainerRef.current
        if (!container) return

        const handleScroll = () => {
            const scrollLeft = container.scrollLeft
            const scrollWidth = container.scrollWidth
            const clientWidth = container.clientWidth

            // 左边框：当向右滚动时显示
            setShowLeftBorder(scrollLeft > 0)

            // 右边框：当还能继续向右滚动时显示
            const maxScrollLeft = scrollWidth - clientWidth
            const canScrollRight = maxScrollLeft > 0 && scrollLeft < maxScrollLeft - 1
            setShowRightBorder(canScrollRight)
        }

        // 延迟初始检查，确保DOM已完全渲染
        const timer = setTimeout(handleScroll, 100)

        container.addEventListener('scroll', handleScroll)
        window.addEventListener('resize', handleScroll)

        return () => {
            clearTimeout(timer)
            container.removeEventListener('scroll', handleScroll)
            window.removeEventListener('resize', handleScroll)
        }
    }, [allItems.length])

    return (
        <div className="relative w-full overflow-hidden">
            <div
                ref={scrollContainerRef}
                className="flex items-center gap-4 overflow-x-auto mt-2"
                style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch'
                }}
            >
                <style jsx>{`
                    div::-webkit-scrollbar {
                        display: none;
                    }
                `}</style>

                {/* 编辑模式和正常模式的简洁切换 */}
                <AnimatePresence mode="wait">
                    {editingEquipment ? (
                        <motion.div
                            key="edit-mode"
                            className="flex items-center gap-2 whitespace-nowrap"
                            data-edit-mode
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            {(() => {
                                const equipment = allEquipments.find(eq => eq.id === editingEquipment)
                                return equipment ? (
                                    <>
                                        <span className="text-xs font-medium tracking-widest text-neutral-800 dark:text-neutral-100 pb-3">
                                            {equipment.name}
                                        </span>
                                        <span className="text-[12px] tracking-widest text-neutral-400 dark:text-neutral-500 pb-3">｜</span>
                                        <button
                                            onClick={() => equipment.isCustom && handlers.edit(equipment as CustomEquipment)}
                                            className="text-xs font-medium tracking-widest cursor-pointer text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 pb-3 transition-colors duration-150"
                                        >
                                            编辑
                                        </button>
                                        <button
                                            onClick={() => equipment.isCustom && handlers.delete(equipment as CustomEquipment)}
                                            className="text-xs font-medium tracking-widest cursor-pointer text-neutral-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 pb-3 transition-colors duration-150"
                                        >
                                            删除
                                        </button>
                                        <button
                                            onClick={() => equipment.isCustom && handlers.share(equipment as CustomEquipment)}
                                            className="text-xs font-medium tracking-widest cursor-pointer text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 pb-3 transition-colors duration-150"
                                        >
                                            分享
                                        </button>
                                        <span className="text-[12px] tracking-widest text-neutral-400 dark:text-neutral-500 pb-3">｜</span>
                                        <button
                                            onClick={handlers.exitEdit}
                                            className="text-xs font-medium tracking-widest cursor-pointer text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 pb-3 transition-colors duration-150"
                                        >
                                            返回
                                        </button>
                                    </>
                                ) : null
                            })()}
                        </motion.div>
                    ) : (
                        /* 正常模式 */
                        <motion.div
                            key="normal-mode"
                            className="flex items-center gap-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            {allItems.map((item) => (
                                <div key={item.id} className="flex-shrink-0 flex items-center">
                                    {item.type === 'addButton' ? (
                                        <div
                                            onClick={item.onClick}
                                            className="text-xs font-medium tracking-widest cursor-pointer text-neutral-500 dark:text-neutral-400 flex items-center whitespace-nowrap pb-3 transition-colors duration-150"
                                        >
                                            添加器具
                                        </div>
                                    ) : (
                                        <div className="whitespace-nowrap flex items-center relative">
                                            <div
                                                onClick={item.onClick}
                                                className="text-xs font-medium tracking-widest whitespace-nowrap pb-3 relative cursor-pointer"
                                                data-tab={item.id}
                                            >
                                                <span className={`relative ${item.isSelected
                                                    ? 'text-neutral-800 dark:text-neutral-100'
                                                    : 'text-neutral-500 dark:text-neutral-400'
                                                }`}>
                                                    {item.name}
                                                </span>
                                                {item.isSelected && (
                                                    <span className="absolute bottom-0 left-0 w-full h-px bg-neutral-800 dark:bg-neutral-100"></span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* 左边框指示器 */}
                <div
                    className={`absolute top-0 left-0 w-6 h-full bg-gradient-to-r from-neutral-50/95 dark:from-neutral-900/95 to-transparent pointer-events-none transition-opacity duration-200 ease-out ${
                        showLeftBorder ? 'opacity-100' : 'opacity-0'
                    }`}
                />

                {/* 右边框指示器 */}
                <div
                    className={`absolute top-0 right-0 w-6 h-full bg-gradient-to-l from-neutral-50/95 dark:from-neutral-900/95 to-transparent pointer-events-none transition-opacity duration-200 ease-out ${
                        showRightBorder ? 'opacity-100' : 'opacity-0'
                    }`}
                />
            </div>


        </div>
    );
};



// 优化的EditableParameter组件 - 使用更简洁的逻辑和hooks
interface EditableParameterProps {
    value: string
    onChange: (value: string) => void
    unit: string
    className?: string
    prefix?: string
    disabled?: boolean
}

const EditableParameter: React.FC<EditableParameterProps> = ({
    value, onChange, unit, className = '', prefix = '', disabled = false
}) => {
    const [isEditing, setIsEditing] = useState(false)
    const inputRef = React.useRef<HTMLInputElement>(null)

    // 简化逻辑：编辑时也直接使用转换后的值，让用户输入更直观
    const [tempValue, setTempValue] = useState(value)

    // 自动聚焦和选择文本
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])

    // 同步编辑值 - 始终使用显示值
    useEffect(() => {
        setTempValue(value)
    }, [value])

    // 处理提交和取消的统一逻辑
    const handleSubmit = useCallback(() => {
        setIsEditing(false)
        if (tempValue !== value) onChange(tempValue)
    }, [tempValue, value, onChange])

    const handleCancel = useCallback(() => {
        setTempValue(value)
        setIsEditing(false)
    }, [value])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSubmit()
        else if (e.key === 'Escape') handleCancel()
    }, [handleSubmit, handleCancel])

    return (
        <span
            className={`group relative inline-flex items-center ${className} ${disabled ? 'cursor-default' : 'cursor-pointer'} min-w-0 ${disabled ? '' : 'border-b border-dashed border-neutral-300 dark:border-neutral-600 pb-0.5'}`}
            onClick={() => !disabled && setIsEditing(true)}
        >
            {prefix && <span className="shrink-0">{prefix}</span>}
            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={handleSubmit}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-transparent text-center text-xs font-medium outline-hidden px-0.5"
                />
            ) : (
                <span className="inline-flex items-center whitespace-nowrap">
                    {value}
                    {unit && <span className="ml-0.5 shrink-0">{unit}</span>}
                </span>
            )}
        </span>
    )
}

interface NavigationBarProps {
    activeMainTab: MainTabType;
    setActiveMainTab: (tab: MainTabType) => void;
    activeBrewingStep: BrewingStep;
    setActiveBrewingStep: (step: BrewingStep) => void;
    parameterInfo: ParameterInfo;
    setParameterInfo: (info: ParameterInfo) => void;
    editableParams: EditableParams | null;
    setEditableParams: (params: EditableParams | null) => void;
    isTimerRunning: boolean;
    showComplete: boolean;
    selectedEquipment: string | null;
    selectedMethod: {
        name: string;
        params: {
            coffee: string;
            water: string;
            ratio: string;
            grindSize: string;
            temp: string;
            stages: Array<{
                label: string;
                time: number;
                water: string;
                detail: string;
            }>;
        };
    } | null;
    handleParamChange: (type: keyof EditableParams, value: string) => void;
    setShowHistory: (show: boolean) => void;
    setActiveTab: (tab: TabType) => void;
    onTitleDoubleClick: () => void; // 添加双击标题的回调函数
    settings: SettingsOptions; // 添加settings属性
    // 添加咖啡豆相关字段
    selectedCoffeeBean: string | null;
    hasCoffeeBeans?: boolean; // 添加是否有咖啡豆的属性
    navigateToStep?: (step: BrewingStep, options?: {
        resetParams?: boolean,
        preserveMethod?: boolean,
        preserveEquipment?: boolean,
        preserveCoffeeBean?: boolean,
        force?: boolean
    }) => void; // 添加统一的步骤导航函数
    onStepClick?: (step: BrewingStep) => void; // 添加步骤点击回调
    // 添加替代头部内容支持
    alternativeHeader?: React.ReactNode; // 替代的头部内容
    showAlternativeHeader?: boolean; // 是否显示替代头部内容
    // 添加咖啡豆视图切换相关属性
    currentBeanView?: ViewOption; // 当前咖啡豆视图
    _onBeanViewChange?: (view: ViewOption) => void; // 视图切换回调
    showViewDropdown?: boolean; // 视图下拉菜单显示状态
    onToggleViewDropdown?: () => void; // 切换视图下拉菜单
    // 添加萃取时间变更处理函数
    handleExtractionTimeChange?: (time: number) => void;
    // 添加器具相关props
    customEquipments?: CustomEquipment[];
    onEquipmentSelect?: (equipmentId: string) => void;
    onAddEquipment?: () => void;
    onEditEquipment?: (equipment: CustomEquipment) => void;
    onDeleteEquipment?: (equipment: CustomEquipment) => void;
    onShareEquipment?: (equipment: CustomEquipment) => void;
    // 添加返回按钮相关props
    onBackClick?: () => void;
}

// 意式咖啡相关工具函数 - 优化为更简洁的实现
const espressoUtils = {
    isEspresso: (method: { params?: { stages?: Array<{ pourType?: string; [key: string]: unknown }> } } | null) =>
        method?.params?.stages?.some((stage) =>
            ['extraction', 'beverage'].includes(stage.pourType || '')) || false,

    getExtractionTime: (method: { params?: { stages?: Array<{ pourType?: string; time?: number; [key: string]: unknown }> } } | null) =>
        method?.params?.stages?.find((stage) => stage.pourType === 'extraction')?.time || 0,

    formatTime: (seconds: number) => `${seconds}`
}

// 导航相关常量和工具
const NAVIGABLE_STEPS: Record<BrewingStep, BrewingStep | null> = {
    'brewing': 'method',
    'method': 'coffeeBean',
    'coffeeBean': null,
    'notes': 'brewing'
}

// 自定义Hook：处理导航逻辑
const useNavigation = (activeBrewingStep: BrewingStep, activeMainTab: MainTabType, hasCoffeeBeans?: boolean) => {
    const canGoBack = useCallback((): boolean => {
        // 如果当前在笔记页面，不显示返回按钮
        if (activeMainTab === '笔记') return false

        // 如果当前在咖啡豆页面，不显示返回按钮
        if (activeMainTab === '咖啡豆') return false

        // 只有在冲煮页面才考虑返回逻辑
        if (activeMainTab !== '冲煮') return false

        if (activeBrewingStep === 'method' && !hasCoffeeBeans) return false
        return NAVIGABLE_STEPS[activeBrewingStep] !== null
    }, [activeBrewingStep, activeMainTab, hasCoffeeBeans])

    return { canGoBack }
}

const NavigationBar: React.FC<NavigationBarProps> = ({
    activeMainTab, setActiveMainTab, activeBrewingStep, setActiveBrewingStep,
    parameterInfo, setParameterInfo, editableParams, setEditableParams,
    isTimerRunning, showComplete, selectedEquipment, selectedMethod,
    handleParamChange, setShowHistory, setActiveTab, onTitleDoubleClick,
    settings, hasCoffeeBeans, alternativeHeader, showAlternativeHeader = false,
    currentBeanView, showViewDropdown, onToggleViewDropdown,
    handleExtractionTimeChange, customEquipments = [], onEquipmentSelect,
    onAddEquipment, onEditEquipment, onDeleteEquipment, onShareEquipment, onBackClick,
}) => {

    const { canGoBack } = useNavigation(activeBrewingStep, activeMainTab, hasCoffeeBeans)

    // 获取当前视图的显示名称
    const getCurrentViewLabel = () => {
        if (!currentBeanView) return '咖啡豆'
        return VIEW_LABELS[currentBeanView]
    }

    // 处理咖啡豆按钮点击
    const handleBeanTabClick = () => {
        if (activeMainTab === '咖啡豆') {
            // 如果已经在咖啡豆页面，切换下拉菜单显示状态
            onToggleViewDropdown?.()
        } else {
            // 如果不在咖啡豆页面，先切换到咖啡豆页面
            handleMainTabClick('咖啡豆')
        }
    }

    const handleTitleClick = () => {
        if (settings.hapticFeedback) {
            hapticsUtils.light()
        }

        if (canGoBack() && onBackClick) {
            onBackClick()
        } else {
            onTitleDoubleClick()
        }
    }



    useEffect(() => {
        const handleStepChanged = async (detail: { step: BrewingStep }) => {
            const methodForUpdate = selectedMethod ? {
                name: selectedMethod.name,
                params: {
                    ...selectedMethod.params,
                    videoUrl: ''
                }
            } : null

            try {
                const { loadCustomEquipments } = await import('@/lib/managers/customEquipments')
                const customEquipments = await loadCustomEquipments()
                updateParameterInfo(detail.step, selectedEquipment, methodForUpdate, equipmentList, customEquipments)
            } catch (error) {
                console.error('加载自定义设备失败:', error)
                updateParameterInfo(detail.step, selectedEquipment, methodForUpdate, equipmentList)
            }
        }

        return listenToEvent(BREWING_EVENTS.STEP_CHANGED, handleStepChanged)
    }, [selectedEquipment, selectedMethod])

    useEffect(() => {
        const handleParameterInfoUpdate = (detail: ParameterInfo) => {
            setParameterInfo(detail)
        }

        return listenToEvent(BREWING_EVENTS.PARAMS_UPDATED, handleParameterInfoUpdate)
    }, [setParameterInfo])

    const shouldHideHeader = activeBrewingStep === 'brewing' && isTimerRunning && !showComplete

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

    const shouldShowContent = activeMainTab === '冲煮' && (!isTimerRunning || showComplete || activeBrewingStep === 'notes')
    const shouldShowParams = parameterInfo.method
    const isParamsDisabled = activeBrewingStep === 'notes'

    const handleTimeChange = (value: string) => {
        if (handleExtractionTimeChange && selectedMethod) {
            const time = parseInt(value, 10) || 0
            handleExtractionTimeChange(time)
        }
    }

    // 获取器具名称
    const getSelectedEquipmentName = () => {
        if (!selectedEquipment) return null
        return getEquipmentName(selectedEquipment, equipmentList, customEquipments)
    }

    return (
        <motion.div
            className="sticky top-0 z-20 pt-safe-top bg-neutral-50/95 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800"
            transition={{ duration: 0.3, ease: "easeInOut" }}
        >

            {/* 修改：创建一个固定高度的容器，用于包含默认头部和替代头部 */}
            <div className="relative min-h-[30px] w-full">
                {/* 修改：将AnimatePresence用于透明度变化而非高度变化 */}
                <AnimatePresence mode="wait">
                    {showAlternativeHeader ? (
                        // 替代头部 - 使用绝对定位
                        <motion.div
                            key="alternative-header"
                            className="absolute top-0 left-0 right-0 w-full px-6"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                        >
                            {alternativeHeader}
                        </motion.div>
                    ) : (
                        // 默认头部 - 使用绝对定位
                        <motion.div
                            key="default-header"
                            className="absolute top-0 left-0 right-0 w-full px-6"
                            initial={{ opacity: shouldHideHeader ? 0 : 1 }}
                            animate={{ opacity: shouldHideHeader ? 0 : 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            style={{ pointerEvents: shouldHideHeader ? 'none' : 'auto' }}
                        >
                            <div className="flex items-start justify-between">
                                {/* 设置入口按钮图标 */}
                                <div
                                    onClick={handleTitleClick}
                                    className="cursor-pointer text-[12px] tracking-widest text-neutral-500 dark:text-neutral-400 flex items-center"
                                >
                                    {canGoBack() && onBackClick ? (
                                        <ArrowLeft className="w-4 h-4 mr-1" />
                                    ) : (
                                        <Equal className="w-4 h-4 mr-1" />
                                    )}
                                    {!(canGoBack() && onBackClick) && <span></span>}
                                </div>

                                {/* 主导航按钮 - 保持固定高度避免抖动 */}
                                <div className="flex items-center space-x-6">
                                    <div
                                        style={{
                                            opacity: !(canGoBack() && onBackClick) ? 1 : 0,
                                            pointerEvents: !(canGoBack() && onBackClick) ? 'auto' : 'none'
                                        }}
                                    >
                                        <TabButton
                                            tab="冲煮"
                                            isActive={activeMainTab === '冲煮'}
                                            onClick={() => handleMainTabClick('冲煮')}
                                            dataTab="冲煮"
                                        />
                                    </div>
                                    <div
                                        style={{
                                            opacity: !(canGoBack() && onBackClick) ? 1 : 0,
                                            pointerEvents: !(canGoBack() && onBackClick) ? 'auto' : 'none'
                                        }}
                                        className="relative"
                                    >
                                        {/* 咖啡豆按钮 - 带下拉菜单 */}
                                        <div
                                            ref={(el) => {
                                                // 将按钮引用传递给父组件
                                                if (el && typeof window !== 'undefined') {
                                                    (window as Window & { beanButtonRef?: HTMLDivElement }).beanButtonRef = el;
                                                }
                                            }}
                                            onClick={handleBeanTabClick}
                                            className="text-xs font-medium tracking-widest whitespace-nowrap pb-3 cursor-pointer flex items-center transition-opacity duration-100"
                                            style={{
                                                opacity: showViewDropdown && activeMainTab === '咖啡豆' ? 0 : 1,
                                                pointerEvents: showViewDropdown && activeMainTab === '咖啡豆' ? 'none' : 'auto',
                                                visibility: showViewDropdown && activeMainTab === '咖啡豆' ? 'hidden' : 'visible'
                                            }}
                                            data-view-selector
                                        >
                                            <span className={`relative inline-block ${
                                                activeMainTab === '咖啡豆'
                                                    ? 'text-neutral-800 dark:text-neutral-100'
                                                    : 'text-neutral-500 dark:text-neutral-400'
                                            }`}>
                                                {getCurrentViewLabel()}
                                            </span>

                                            {/* 下拉图标容器 - 使用动画宽度避免布局抖动 */}
                                            <motion.div
                                                className="flex items-center justify-center overflow-hidden"
                                                initial={false}
                                                animate={{
                                                    width: activeMainTab === '咖啡豆' ? '12px' : '0px',
                                                    marginLeft: activeMainTab === '咖啡豆' ? '4px' : '0px',
                                                    transition: {
                                                        duration: 0.35,
                                                        ease: [0.25, 0.46, 0.45, 0.94], // Apple的标准缓动
                                                    }
                                                }}
                                            >
                                                <AnimatePresence mode="wait">
                                                    {activeMainTab === '咖啡豆' && (
                                                        <motion.div
                                                            key="chevron-icon"
                                                            initial={{
                                                                opacity: 0,
                                                                scale: 0.8
                                                            }}
                                                            animate={{
                                                                opacity: 1,
                                                                scale: 1,
                                                                transition: {
                                                                    duration: 0.35,
                                                                    ease: [0.25, 0.46, 0.45, 0.94], // Apple的标准缓动
                                                                    opacity: { duration: 0.25, delay: 0.1 }, // 稍微延迟透明度动画
                                                                    scale: { duration: 0.35 }
                                                                }
                                                            }}
                                                            exit={{
                                                                opacity: 0,
                                                                scale: 0.8,
                                                                transition: {
                                                                    duration: 0.15,
                                                                    ease: [0.4, 0.0, 1, 1], // Apple的退出缓动
                                                                    opacity: { duration: 0.15 },
                                                                    scale: { duration: 0.15 }
                                                                }
                                                            }}
                                                            className="flex items-center justify-center w-3 h-3 shrink-0"
                                                        >
                                                            <ChevronsUpDown
                                                                size={12}
                                                                className="text-neutral-400 dark:text-neutral-600"
                                                                color="currentColor"
                                                            />
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </motion.div>
                                        </div>


                                    </div>
                                    <div
                                        style={{
                                            opacity: !(canGoBack() && onBackClick) ? 1 : 0,
                                            pointerEvents: !(canGoBack() && onBackClick) ? 'auto' : 'none'
                                        }}
                                    >
                                        <TabButton
                                            tab="笔记"
                                            isActive={activeMainTab === '笔记'}
                                            onClick={() => handleMainTabClick('笔记')}
                                            dataTab="笔记"
                                        />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 仅当不显示替代头部内容时才显示参数栏和步骤指示器 */}
            {!showAlternativeHeader && (
                <AnimatePresence mode="wait">
                    {shouldShowContent && (
                        <motion.div
                            key="content-container"
                            className="overflow-hidden"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{
                                duration: 0.25,
                                ease: "easeOut",
                                opacity: { duration: 0.15 }
                            }}
                        >
                            {/* 参数栏 - 添加高度动画 */}
                            <AnimatePresence mode="wait">
                                {shouldShowParams && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{
                                            duration: 0.3,
                                            ease: [0.4, 0, 0.2, 1],
                                            opacity: { duration: 0.2 }
                                        }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-6 py-2 mt-2 bg-neutral-100 dark:bg-neutral-800 text-xs font-medium text-neutral-500 dark:text-neutral-400 relative">
                                            <div className="flex items-center min-w-0 overflow-x-auto no-scrollbar max-w-full">
                                                {parameterInfo.method && (
                                                    <span
                                                        className="cursor-pointer whitespace-nowrap"
                                                        onClick={() => {
                                                            setActiveBrewingStep('method');
                                                            setActiveTab('方案');
                                                        }}
                                                    >
                                                        {getSelectedEquipmentName() && (
                                                            <>
                                                                {getSelectedEquipmentName()} ·
                                                            </>
                                                        )}
                                                        {parameterInfo.method}
                                                    </span>
                                                )}
                                            </div>

                                            {parameterInfo.params && (
                                                <div className="absolute top-2 right-6 min-w-0 max-w-full text-right z-10">
                                                    {editableParams ? (
                                                        <div className="flex items-center justify-end bg-neutral-100 dark:bg-neutral-800 space-x-1 sm:space-x-2 overflow-x-auto pl-3">
                                                            <EditableParameter
                                                                value={editableParams.coffee.replace('g', '')}
                                                                onChange={(v) => handleParamChange('coffee', v)}
                                                                unit="g"
                                                                className=""
                                                                disabled={isParamsDisabled}
                                                            />

                                                            {!espressoUtils.isEspresso(selectedMethod) && (
                                                                <>
                                                                    <span className="shrink-0">·</span>
                                                                    <EditableParameter
                                                                        value={editableParams.ratio.replace('1:', '')}
                                                                        onChange={(v) => handleParamChange('ratio', v)}
                                                                        unit=""
                                                                        prefix="1:"
                                                                        className=""
                                                                        disabled={isParamsDisabled}
                                                                    />
                                                                </>
                                                            )}

                                                            {parameterInfo.params?.grindSize && (
                                                                <>
                                                                    <span className="shrink-0">·</span>
                                                                    <EditableParameter
                                                                        value={formatGrindSize(editableParams.grindSize, settings.grindType)}
                                                                        onChange={(v) => handleParamChange('grindSize', v)}
                                                                        unit=""
                                                                        className=""
                                                                        disabled={isParamsDisabled}
                                                                    />
                                                                </>
                                                            )}

                                                            {espressoUtils.isEspresso(selectedMethod) ? (
                                                                <>
                                                                    <span className="shrink-0">·</span>
                                                                    <EditableParameter
                                                                        value={espressoUtils.formatTime(espressoUtils.getExtractionTime(selectedMethod))}
                                                                        onChange={(v) => handleTimeChange(v)}
                                                                        unit="秒"
                                                                        className=""
                                                                        disabled={isParamsDisabled}
                                                                    />
                                                                    <span className="shrink-0">·</span>
                                                                    <EditableParameter
                                                                        value={editableParams.water.replace('g', '')}
                                                                        onChange={(v) => handleParamChange('water', v)}
                                                                        unit="g"
                                                                        className=""
                                                                        disabled={isParamsDisabled}
                                                                    />
                                                                </>
                                                            ) : (
                                                                parameterInfo.params?.temp && (
                                                                    <>
                                                                        <span className="shrink-0">·</span>
                                                                        <EditableParameter
                                                                            value={editableParams.temp.replace('°C', '')}
                                                                            onChange={(v) => handleParamChange('temp', v)}
                                                                            unit="°C"
                                                                            className=""
                                                                            disabled={isParamsDisabled}
                                                                        />
                                                                    </>
                                                                )
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span
                                                            className="cursor-pointer flex items-center justify-end space-x-1 sm:space-x-2 overflow-x-auto pl-6"
                                                            onClick={() => {
                                                                if (selectedMethod && !isTimerRunning) {
                                                                    setEditableParams({
                                                                        coffee: selectedMethod.params.coffee,
                                                                        water: selectedMethod.params.water,
                                                                        ratio: selectedMethod.params.ratio,
                                                                        grindSize: selectedMethod.params.grindSize,
                                                                        temp: selectedMethod.params.temp,
                                                                    })
                                                                }
                                                            }}
                                                        >
                                                            {getSelectedEquipmentName() && (
                                                                <>
                                                                    <span className="whitespace-nowrap">{getSelectedEquipmentName()}</span>
                                                                    <span className="shrink-0">·</span>
                                                                </>
                                                            )}
                                                            {espressoUtils.isEspresso(selectedMethod) ? (
                                                                <>
                                                                    <span className="whitespace-nowrap">
                                                                        {formatGrindSize(parameterInfo.params.grindSize || "", settings.grindType)}
                                                                    </span>
                                                                    <span className="shrink-0">·</span>
                                                                    <span className="truncate max-w-[30px] sm:max-w-[40px]">{parameterInfo.params.coffee}</span>
                                                                    <span className="shrink-0">·</span>
                                                                    <span className="whitespace-nowrap">
                                                                        {espressoUtils.formatTime(espressoUtils.getExtractionTime(selectedMethod))}秒
                                                                    </span>
                                                                    <span className="shrink-0">·</span>
                                                                    <span className="whitespace-nowrap">{parameterInfo.params.water}</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span className="truncate max-w-[30px] sm:max-w-[40px]">{parameterInfo.params.coffee}</span>
                                                                    <span className="shrink-0">·</span>
                                                                    <span className="whitespace-nowrap">{parameterInfo.params.ratio}</span>
                                                                    <span className="shrink-0">·</span>
                                                                    <span className="whitespace-nowrap">
                                                                        {formatGrindSize(parameterInfo.params.grindSize || "", settings.grindType)}
                                                                    </span>
                                                                    <span className="shrink-0">·</span>
                                                                    <span className="whitespace-nowrap">{parameterInfo.params.temp}</span>
                                                                </>
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* 器具分类栏 - 只在方案步骤时显示，添加动画效果 */}
                            <AnimatePresence mode="wait">
                                {activeBrewingStep === 'method' && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{
                                            duration: 0.3,
                                            ease: [0.4, 0, 0.2, 1],
                                            opacity: { duration: 0.2 }
                                        }}
                                        className="overflow-hidden mx-6"
                                    >
                                            <EquipmentIndicator
                                                selectedEquipment={selectedEquipment}
                                                customEquipments={customEquipments}
                                                onEquipmentSelect={onEquipmentSelect || (() => {})}
                                                onAddEquipment={onAddEquipment || (() => {})}
                                                onEditEquipment={onEditEquipment || (() => {})}
                                                onDeleteEquipment={onDeleteEquipment || (() => {})}
                                                onShareEquipment={onShareEquipment || (() => {})}
                                                settings={settings}
                                            />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </motion.div>
    );
};

export default NavigationBar;
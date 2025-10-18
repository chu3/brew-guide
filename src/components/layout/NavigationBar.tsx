'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { equipmentList, type CustomEquipment } from '@/lib/core/config'
import hapticsUtils from '@/lib/ui/haptics'
import { SettingsOptions } from '@/components/settings/Settings'
import { formatGrindSize, parseGrindSize, getMyGrinders, combineGrindSize, smartConvertGrindSize, findGrinder, hasOnlyGenericGrinder } from '@/lib/utils/grindUtils'
import { getRecommendedGrinder } from '@/lib/utils/grinderRecommendation'
import { useGrinderRecommendationStore } from '@/lib/stores/grinderRecommendationStore'
import { BREWING_EVENTS, ParameterInfo } from '@/lib/brewing/constants'
import { listenToEvent } from '@/lib/brewing/events'
import { updateParameterInfo, getEquipmentName } from '@/lib/brewing/parameters'
import EquipmentBar from '@/components/equipment/EquipmentBar'
import EquipmentManagementDrawer from '@/components/equipment/EquipmentManagementDrawer'

import { Equal, ArrowLeft, ChevronsUpDown } from 'lucide-react'
import { saveMainTabPreference } from '@/lib/navigation/navigationCache'
import { ViewOption, VIEW_LABELS } from '@/components/coffee-bean/List/types'

// 统一类型定义
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
    const [tempValue, setTempValue] = useState(value)

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])

    useEffect(() => {
        setTempValue(value)
    }, [value])

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

    if (disabled) {
        return (
            <span className={`inline-flex items-center ${className}`}>
                {prefix && <span className="shrink-0">{prefix}</span>}
                <span className="whitespace-nowrap">{value}</span>
                {unit && <span className="ml-0.5 shrink-0">{unit}</span>}
            </span>
        )
    }

    return (
        <span
            className={`group relative inline-flex items-center cursor-pointer min-w-0 border-b border-dashed border-neutral-300 dark:border-neutral-600 pb-0.5 ${className}`}
            onClick={() => setIsEditing(true)}
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
                    className="bg-transparent text-center text-xs outline-hidden min-w-0 max-w-none"
                    size={Math.max(tempValue.length || 1, 2)}
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

// 磨豆机研磨度编辑组件
interface EditableGrindSizeProps {
    grindSize: string
    onGrindSizeChange: (value: string) => void
    settings: SettingsOptions
    className?: string
    disabled?: boolean
    selectedEquipment?: string | null
    customEquipments?: CustomEquipment[]
}

const EditableGrindSize: React.FC<EditableGrindSizeProps> = ({
    grindSize, onGrindSizeChange, settings, className = '', disabled = false, selectedEquipment, customEquipments
}) => {
    // 订阅 Zustand store
    const lastUsedGrinderByEquipment = useGrinderRecommendationStore(
        state => state.lastUsedGrinderByEquipment
    );
    
    // UI 状态
    const [isEditing, setIsEditing] = useState(false)
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const inputRef = React.useRef<HTMLInputElement>(null)
    const dropdownRef = React.useRef<HTMLDivElement>(null)
    const triggerRef = React.useRef<HTMLSpanElement>(null)
    const measureRef = React.useRef<HTMLSpanElement>(null)
    const inputMeasureRef = React.useRef<HTMLSpanElement>(null)
    
    // 🎯 核心：独立状态（完全参考 MethodSelector）
    const [selectedGrinderId, setSelectedGrinderId] = useState<string>('generic')
    const [tempValue, setTempValue] = useState<string>('0')
    const [selectWidth, setSelectWidth] = useState<number | undefined>(undefined)
    const [inputWidth, setInputWidth] = useState<number | undefined>(undefined)
    const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null)
    
    // 获取用户的磨豆机列表
    const myGrinders = getMyGrinders(settings.myGrinders || ['generic'], settings.customGrinders)
    const onlyHasGeneric = hasOnlyGenericGrinder(settings.myGrinders)
    
    // 解析当前 grindSize prop 判断是否显示选择器
    const { grinderId: propGrinderId } = parseGrindSize(grindSize)
    const hasMethodGrinder = propGrinderId && propGrinderId !== 'generic'
    const shouldShowGrinderSelector = hasMethodGrinder || !onlyHasGeneric
    
    // 获取当前磨豆机名称
    const currentGrinder = findGrinder(selectedGrinderId, settings.customGrinders, false)
    const currentGrinderName = currentGrinder?.name || '通用'
    
    // 🎯 核心：同步外部 grindSize 到本地状态
    useEffect(() => {
        const { grinderId, value } = parseGrindSize(grindSize)
        
        // 🎯 关键：使用智能推荐获取默认磨豆机（如果研磨度没有携带磨豆机ID）
        // 注意：这里使用当前的 lastUsedGrinderByEquipment 值，但不作为依赖项
        const recommendedGrinderId = getRecommendedGrinder(
            selectedEquipment || null,
            settings.myGrinders || ['generic'],
            lastUsedGrinderByEquipment,
            customEquipments
        )
        
        const actualGrinderId = grinderId || recommendedGrinderId
        setSelectedGrinderId(actualGrinderId)
        
        // 🎯 关键：如果使用了推荐的磨豆机（即方案本身没有携带磨豆机ID），需要转化研磨度
        let finalGrindSize = value || '0'
        if (!grinderId && actualGrinderId !== 'generic' && value) {
            // 将通用研磨度描述转换为推荐磨豆机的刻度
            finalGrindSize = smartConvertGrindSize(
                value,
                'generic',
                actualGrinderId,
                settings.customGrinders
            )
        }
        
        setTempValue(finalGrindSize)
    }, [grindSize, selectedEquipment, lastUsedGrinderByEquipment, settings.myGrinders, settings.customGrinders, customEquipments])
    
    // 测量宽度
    useEffect(() => {
        if (measureRef.current) {
            setSelectWidth(measureRef.current.offsetWidth)
        }
    }, [currentGrinderName])
    
    useEffect(() => {
        if (inputMeasureRef.current) {
            setInputWidth(Math.max(inputMeasureRef.current.offsetWidth, 20))
        }
    }, [tempValue])

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])
    
    // 注释掉自动转换逻辑，保留方案原本设定的磨豆机
    // 如果方案已经携带了磨豆机ID（如自定义方案的"幻刺 Pro:12"），就保持不变
    // 用户可以通过下拉菜单手动切换磨豆机
    // useEffect(() => {
    //     // 如果研磨度中没有携带磨豆机ID，且推荐的磨豆机不是通用的，需要转化
    //     if (!currentGrinderId && recommendedGrinderId !== 'generic' && currentGrindValue) {
    //         const convertedValue = smartConvertGrindSize(
    //             currentGrindValue,
    //             'generic',
    //             recommendedGrinderId,
    //             settings.customGrinders
    //         )
    //         const newGrindSize = combineGrindSize(recommendedGrinderId, convertedValue)
    //         // 只有当转化后的值不同时才更新
    //         if (newGrindSize !== grindSize) {
    //             onGrindSizeChange(newGrindSize)
    //         }
    //     }
    // }, [recommendedGrinderId, currentGrinderId, currentGrindValue, grindSize, settings.customGrinders, onGrindSizeChange])

    const handleSubmit = useCallback(() => {
        setIsEditing(false)
        // 即使值为空，也要保留磨豆机信息，使用 "0" 作为默认值
        const valueToUse = tempValue.trim() || '0'
        const newGrindSize = combineGrindSize(selectedGrinderId, valueToUse)
        if (newGrindSize !== grindSize) {
            onGrindSizeChange(newGrindSize)
        }
    }, [tempValue, grindSize, selectedGrinderId, onGrindSizeChange])

    const handleCancel = useCallback(() => {
        // 🎯 修复：取消时恢复到当前的研磨度值
        const { value } = parseGrindSize(grindSize)
        setTempValue(value || '0')
        setIsEditing(false)
    }, [grindSize])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSubmit()
        else if (e.key === 'Escape') handleCancel()
    }, [handleSubmit, handleCancel])

    // 🎯 处理磨豆机切换（参考 MethodSelector 的实现）
    const handleGrinderChange = useCallback(async (newGrinderId: string) => {
        const oldGrinderId = selectedGrinderId
        
        // 🎯 Step 1: 立即更新 Zustand store（这样其他组件能立即响应）
        const { useGrinderRecommendationStore } = await import('@/lib/stores/grinderRecommendationStore')
        const store = useGrinderRecommendationStore.getState()
        await store.updateLastUsedGrinder(
            selectedEquipment || null,
            newGrinderId,
            customEquipments
        )
        
        // 🎯 Step 2: 立即更新本地状态
        setSelectedGrinderId(newGrinderId)
        
        // 🎯 Step 3: 转换研磨度值
        const newGrindSizeValue = smartConvertGrindSize(
            tempValue,
            oldGrinderId,
            newGrinderId,
            settings.customGrinders
        )
        setTempValue(newGrindSizeValue)
        
        // 🎯 Step 4: 组合新的研磨度字符串并通知外部
        const newGrindSize = combineGrindSize(newGrinderId, newGrindSizeValue)
        onGrindSizeChange(newGrindSize)
        
        // 关闭下拉菜单
        setIsDropdownOpen(false)
    }, [selectedGrinderId, tempValue, settings.customGrinders, selectedEquipment, customEquipments, onGrindSizeChange])
    
    // 计算下拉菜单位置
    const updateDropdownPosition = useCallback(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect()
            setDropdownPosition({
                top: rect.bottom + 4,
                left: rect.left
            })
        }
    }, [])
    
    // 打开下拉菜单时计算位置
    useEffect(() => {
        if (isDropdownOpen) {
            updateDropdownPosition()
            window.addEventListener('scroll', updateDropdownPosition, true)
            window.addEventListener('resize', updateDropdownPosition)
            return () => {
                window.removeEventListener('scroll', updateDropdownPosition, true)
                window.removeEventListener('resize', updateDropdownPosition)
            }
        }
    }, [isDropdownOpen, updateDropdownPosition])
    
    // 点击外部关闭下拉菜单
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (isDropdownOpen && 
                dropdownRef.current && 
                !dropdownRef.current.contains(e.target as Node) &&
                triggerRef.current &&
                !triggerRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false)
            }
        }
        
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isDropdownOpen])

    if (disabled) {
        const displayValue = formatGrindSize(grindSize, settings.grindType, settings.customGrinders) || '未设置'
        return (
            <span className={`inline-flex items-center ${className}`}>
                <span className="whitespace-nowrap">{displayValue}</span>
            </span>
        )
    }

    return (
        <span className={`inline-flex items-center gap-1 ${className}`}>
            {/* 隐藏的测量元素 - 用于测量磨豆机名称宽度 */}
            {shouldShowGrinderSelector && (
                <span 
                    ref={measureRef}
                    className="absolute invisible text-xs whitespace-nowrap"
                    style={{ pointerEvents: 'none' }}
                >
                    {currentGrinderName}
                </span>
            )}
            
            {/* 隐藏的测量元素 - 用于测量输入值宽度 */}
            <span 
                ref={inputMeasureRef}
                className="absolute invisible text-xs whitespace-nowrap"
                style={{ pointerEvents: 'none' }}
            >
                {tempValue || '0'}
            </span>
            
            {/* 自定义磨豆机选择器 - 仅在方案有指定磨豆机或用户有多个磨豆机时显示 */}
            {shouldShowGrinderSelector && (
                <span className="relative inline-flex items-center">
                    <span
                        ref={triggerRef}
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className={`bg-transparent border-0 border-b border-dashed text-xs cursor-pointer outline-none pb-0.5 transition-colors duration-150 whitespace-nowrap overflow-hidden mr-1 ${
                            isDropdownOpen 
                                ? 'border-neutral-600 dark:border-neutral-400 text-neutral-800 dark:text-neutral-200'
                                : 'border-neutral-300 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400 hover:border-neutral-500 dark:hover:border-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                        }`}
                        style={{ 
                            width: selectWidth ? `${selectWidth}px` : 'auto',
                        }}
                    >
                        {currentGrinderName}
                    </span>
                </span>
            )}
            
            {/* 下拉菜单 - 极简风格设计 */}
            <AnimatePresence>
                {isDropdownOpen && dropdownPosition && (
                    <motion.div
                        ref={dropdownRef}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ 
                            duration: 0.2,
                            ease: [0.25, 0.46, 0.45, 0.94]
                        }}
                        className="fixed bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md shadow-sm z-[9999] min-w-[80px] max-h-[200px] overflow-hidden"
                        style={{
                            top: `${dropdownPosition.top}px`,
                            left: `${dropdownPosition.left}px`,
                        }}
                    >
                        <div className="overflow-y-auto max-h-[200px] scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                            {myGrinders.map((grinder) => (
                                <div
                                    key={grinder.id}
                                    onClick={() => handleGrinderChange(grinder.id)}
                                    className={`px-3 py-1.5 text-xs cursor-pointer transition-colors duration-100 ${
                                        grinder.id === selectedGrinderId
                                            ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
                                            : 'text-neutral-600 dark:text-neutral-400 '
                                    }`}
                                >
                                    {grinder.name}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* 分隔符 */}
            {/* <span className="shrink-0">·</span> */}
            
            {/* 研磨度值输入 */}
            <span
                className="group relative inline-flex items-center cursor-pointer min-w-0 border-b border-dashed border-neutral-300 dark:border-neutral-600 pb-0.5 overflow-hidden transition-all duration-200"
                onClick={() => setIsEditing(true)}
                style={{
                    width: inputWidth ? `${inputWidth}px` : 'auto',
                    minWidth: '20px', // 最小宽度确保始终可见
                }}
            >
                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onBlur={handleSubmit}
                        onKeyDown={handleKeyDown}
                        placeholder="0"
                        className="bg-transparent text-xs outline-hidden whitespace-nowrap overflow-hidden w-full placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
                    />
                ) : (
                    <span className={`whitespace-nowrap text-xs overflow-hidden ${!tempValue ? 'text-neutral-400 dark:text-neutral-600' : ''}`}>
                        {tempValue || '0'}
                    </span>
                )}
            </span>
        </span>
    )
}

interface NavigationBarProps {
    activeMainTab: MainTabType;
    setActiveMainTab: (tab: MainTabType) => void;
    activeBrewingStep: BrewingStep;
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
    onTitleDoubleClick: () => void;
    settings: SettingsOptions;
    hasCoffeeBeans?: boolean;
    alternativeHeader?: React.ReactNode;
    showAlternativeHeader?: boolean;
    currentBeanView?: ViewOption;
    showViewDropdown?: boolean;
    onToggleViewDropdown?: () => void;
    handleExtractionTimeChange?: (time: number) => void;
    customEquipments?: CustomEquipment[];
    onEquipmentSelect?: (equipmentId: string) => void;
    onAddEquipment?: () => void;
    onEditEquipment?: (equipment: CustomEquipment) => void;
    onDeleteEquipment?: (equipment: CustomEquipment) => void;
    onShareEquipment?: (equipment: CustomEquipment) => void;
    onBackClick?: () => void;
}

// 意式咖啡相关工具函数 - 优化为更简洁的实现
// const espressoUtils = {
//     isEspresso: (method: { params?: { stages?: Array<{ pourType?: string; [key: string]: unknown }> } } | null) =>
//         method?.params?.stages?.some((stage) =>
//             ['extraction', 'beverage'].includes(stage.pourType || '')) || false,

//     getExtractionTime: (method: { params?: { stages?: Array<{ pourType?: string; time?: number; [key: string]: unknown }> } } | null) =>
//         method?.params?.stages?.find((stage) => stage.pourType === 'extraction')?.time || 0,

//     formatTime: (seconds: number) => `${seconds}`
// }

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

        // 咖啡豆步骤是第一步，不显示返回按钮
        if (activeBrewingStep === 'coffeeBean') return false

        // 如果在方案步骤但没有咖啡豆，也是第一步，不显示返回按钮
        if (activeBrewingStep === 'method' && !hasCoffeeBeans) return false

        // 其他步骤检查是否有上一步
        return NAVIGABLE_STEPS[activeBrewingStep] !== null
    }, [activeBrewingStep, activeMainTab, hasCoffeeBeans])

    return { canGoBack }
}

const NavigationBar: React.FC<NavigationBarProps> = ({
    activeMainTab, setActiveMainTab, activeBrewingStep,
    parameterInfo, setParameterInfo, editableParams, setEditableParams,
    isTimerRunning, showComplete, selectedEquipment, selectedMethod,
    handleParamChange, setShowHistory, onTitleDoubleClick,
    settings, hasCoffeeBeans, alternativeHeader, showAlternativeHeader = false,
    currentBeanView, showViewDropdown, onToggleViewDropdown,
    handleExtractionTimeChange, customEquipments = [], onEquipmentSelect,
    onAddEquipment, onEditEquipment, onDeleteEquipment, onShareEquipment, onBackClick,
}) => {

    const { canGoBack } = useNavigation(activeBrewingStep, activeMainTab, hasCoffeeBeans)
    
    // 抽屉管理状态
    const [isManagementDrawerOpen, setIsManagementDrawerOpen] = useState(false)
    
    // 🎯 笔记步骤中参数显示的叠加层状态（仅用于UI显示，不影响实际数据）
    const [displayOverlay, setDisplayOverlay] = useState<Partial<EditableParams> | null>(null)

    // 处理抽屉开关
    const handleToggleManagementDrawer = () => {
        setIsManagementDrawerOpen(!isManagementDrawerOpen)
    }

    // 处理器具排序
    const handleReorderEquipments = async (newOrder: CustomEquipment[]) => {
        try {
            // 动态导入排序管理函数
            const { saveEquipmentOrder, loadEquipmentOrder } = await import('@/lib/managers/customEquipments')
            const { equipmentUtils } = await import('@/lib/equipment/equipmentUtils')
            
            // 获取当前完整的器具列表（保持现有顺序，只更新自定义器具部分）
            const currentOrder = await loadEquipmentOrder()
            const allCurrentEquipments = equipmentUtils.getAllEquipments(customEquipments, currentOrder)
            
            // 更新自定义器具的位置，保持系统器具的位置不变
            const updatedEquipments = allCurrentEquipments.map(eq => {
                if (!eq.isCustom) return eq; // 系统器具位置不变
                const reorderedCustomEq = newOrder.find(newEq => newEq.id === eq.id);
                return reorderedCustomEq ? { ...reorderedCustomEq, isCustom: true } : eq;
            });
            
            // 生成新的排序数据
            const newEquipmentOrder = equipmentUtils.generateEquipmentOrder(updatedEquipments)
            
            // 保存排序
            await saveEquipmentOrder(newEquipmentOrder)
        } catch (error) {
            console.error('保存器具排序失败:', error)
        }
    }

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
            // 直接调用返回函数，让父组件统一处理返回逻辑（包括历史栈管理）
            onBackClick()
        } else {
            onTitleDoubleClick()
        }
    }



    useEffect(() => {
        const handleStepChanged = async (detail: { step: BrewingStep }) => {
            // 🎯 简化：直接传递原始方案数据，不做任何转换
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
            
            // 步骤改变时清除显示叠加层
            setDisplayOverlay(null)
        }

        return listenToEvent(BREWING_EVENTS.STEP_CHANGED, handleStepChanged)
    }, [selectedEquipment, selectedMethod])

    useEffect(() => {
        const handleParameterInfoUpdate = (detail: ParameterInfo) => {
            setParameterInfo(detail)
        }

        return listenToEvent(BREWING_EVENTS.PARAMS_UPDATED, handleParameterInfoUpdate)
    }, [setParameterInfo])
    
    // 🎯 监听笔记步骤中的导航栏显示更新事件
    useEffect(() => {
        const handleNavbarDisplayUpdate = (e: CustomEvent) => {
            if (activeBrewingStep !== 'notes' || !editableParams) return
            
            const { type, value } = e.detail
            
            // 获取当前显示值（优先使用叠加层，否则使用原始值）
            const getCurrentDisplayValue = (key: keyof EditableParams) => {
                return displayOverlay?.[key] || editableParams[key]
            }
            
            const currentCoffeeNum = parseFloat(getCurrentDisplayValue('coffee').replace('g', ''))
            const currentRatioNum = parseFloat(getCurrentDisplayValue('ratio').split(':')[1])
            
            switch (type) {
                case 'coffee': {
                    const coffeeValue = parseFloat(value)
                    if (isNaN(coffeeValue) || coffeeValue <= 0) return
                    
                    const calculatedWater = Math.round(coffeeValue * currentRatioNum)
                    setDisplayOverlay(prev => ({
                        ...prev,
                        coffee: `${coffeeValue}g`,
                        water: `${calculatedWater}g`
                    }))
                    break
                }
                case 'ratio': {
                    const ratioValue = parseFloat(value)
                    if (isNaN(ratioValue) || ratioValue <= 0) return
                    
                    const calculatedWater = Math.round(currentCoffeeNum * ratioValue)
                    setDisplayOverlay(prev => ({
                        ...prev,
                        ratio: `1:${ratioValue}`,
                        water: `${calculatedWater}g`
                    }))
                    break
                }
                case 'grindSize': {
                    setDisplayOverlay(prev => ({
                        ...prev,
                        grindSize: value
                    }))
                    break
                }
                case 'temp': {
                    const formattedTemp = value.includes('°C') ? value : `${value}°C`
                    setDisplayOverlay(prev => ({
                        ...prev,
                        temp: formattedTemp
                    }))
                    break
                }
            }
        }
        
        window.addEventListener('brewing:updateNavbarDisplay', handleNavbarDisplayUpdate as EventListener)
        
        return () => {
            window.removeEventListener('brewing:updateNavbarDisplay', handleNavbarDisplayUpdate as EventListener)
        }
    }, [activeBrewingStep, editableParams, displayOverlay])
    
    // 🎯 当 editableParams 变为 null 或步骤不是 notes 时，清除显示叠加层
    useEffect(() => {
        if (!editableParams || activeBrewingStep !== 'notes') {
            setDisplayOverlay(null)
        }
    }, [editableParams, activeBrewingStep])

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

    const _handleTimeChange = (value: string) => {
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
            className={`sticky top-0 z-20 pt-safe-top border-b transition-colors duration-300 ease-in-out ${
                activeBrewingStep === 'brewing' || activeBrewingStep === 'notes'
                    ? 'border-transparent' 
                    : 'border-neutral-200 dark:border-neutral-800'
            }`}
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
                                        <Equal className="w-4 h-4" />
                                    )}
                                    {!(canGoBack() && onBackClick) && <span></span>}
                                </div>

                                {/* 主导航按钮 - 保持固定高度避免抖动 */}
                                <div 
                                    className="flex items-center space-x-6"
                                    style={{
                                        opacity: !(canGoBack() && onBackClick) ? 1 : 0,
                                        pointerEvents: !(canGoBack() && onBackClick) ? 'auto' : 'none',
                                        visibility: !(canGoBack() && onBackClick) ? 'visible' : 'hidden'
                                    }}
                                >
                                    <div>
                                        <TabButton
                                            tab="冲煮"
                                            isActive={activeMainTab === '冲煮'}
                                            onClick={() => handleMainTabClick('冲煮')}
                                            dataTab="冲煮"
                                        />
                                    </div>
                                    <div className="relative">
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
                                            style={
                                                // 只在非返回模式下处理下拉菜单的显示/隐藏
                                                !(canGoBack() && onBackClick) ? {
                                                    opacity: showViewDropdown && activeMainTab === '咖啡豆' ? 0 : 1,
                                                    pointerEvents: showViewDropdown && activeMainTab === '咖啡豆' ? 'none' : 'auto',
                                                    visibility: showViewDropdown && activeMainTab === '咖啡豆' ? 'hidden' : 'visible'
                                                } : undefined
                                            }
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
                                    <div>
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
                                        <div className="px-6 py-2 mt-2 bg-neutral-100 dark:bg-neutral-800 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                            <div className="flex items-center justify-between gap-3">
                                                {/* 左侧：方案名称区域 - 使用省略号 */}
                                                <div className="flex items-center min-w-0 flex-1 overflow-hidden">
                                                    {parameterInfo.method && (
                                                        <span className="truncate">
                                                            {getSelectedEquipmentName() && (
                                                                <span>{getSelectedEquipmentName()}<span className="mx-1">·</span></span>
                                                            )}
                                                            {parameterInfo.method}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* 右侧：参数区域 - 固定不压缩 */}
                                                {parameterInfo.params && (
                                                    <div className="flex items-center flex-shrink-0">
                                                        {editableParams ? (
                                                            <div className="flex items-center space-x-1 sm:space-x-2">
                                                                <EditableParameter
                                                                    value={(displayOverlay?.coffee || editableParams.coffee).replace('g', '')}
                                                                    onChange={(v) => handleParamChange('coffee', v)}
                                                                    unit="g"
                                                                />
                                                                <span className="shrink-0">·</span>
                                                                <EditableParameter
                                                                    value={(displayOverlay?.ratio || editableParams.ratio).replace('1:', '')}
                                                                    onChange={(v) => handleParamChange('ratio', v)}
                                                                    unit=""
                                                                    prefix="1:"
                                                                />
                                                                {parameterInfo.params?.grindSize && (
                                                                    <>
                                                                        <span className="shrink-0">·</span>
                                                                        <EditableGrindSize
                                                                            grindSize={displayOverlay?.grindSize || editableParams.grindSize}
                                                                            onGrindSizeChange={(v) => handleParamChange('grindSize', v)}
                                                                            settings={settings}
                                                                            selectedEquipment={selectedEquipment}
                                                                            customEquipments={customEquipments}
                                                                        />
                                                                    </>
                                                                )}
                                                                {parameterInfo.params?.temp && (
                                                                    <>
                                                                        <span className="shrink-0">·</span>
                                                                        <EditableParameter
                                                                            value={(displayOverlay?.temp || editableParams.temp).replace('°C', '')}
                                                                            onChange={(v) => handleParamChange('temp', v)}
                                                                            unit="°C"
                                                                        />
                                                                    </>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="cursor-pointer flex items-center space-x-1 sm:space-x-2 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                                                                onClick={() => {
                                                                    // 🎯 修复：直接从 parameterInfo.params 获取最新的参数值，而不是从 selectedMethod
                                                                    // 因为 parameterInfo 是通过事件更新的，包含了用户在方案列表中的所有修改
                                                                    if (parameterInfo.params && !isTimerRunning) {
                                                                        
                                                                        setEditableParams({
                                                                            coffee: parameterInfo.params.coffee || '',
                                                                            water: parameterInfo.params.water || '',
                                                                            ratio: parameterInfo.params.ratio || '',
                                                                            grindSize: parameterInfo.params.grindSize || '',
                                                                            temp: parameterInfo.params.temp || '',
                                                                        })
                                                                    }
                                                                }}
                                                            >
                                                                <span className="whitespace-nowrap">{parameterInfo.params.coffee}</span>
                                                                <span className="shrink-0">·</span>
                                                                <span className="whitespace-nowrap">{parameterInfo.params.ratio}</span>
                                                                <span className="shrink-0">·</span>
                                                                <span className="whitespace-nowrap">
                                                                    {formatGrindSize(parameterInfo.params.grindSize || "", settings.grindType, settings.customGrinders)}
                                                                </span>
                                                                <span className="shrink-0">·</span>
                                                                <span className="whitespace-nowrap">{parameterInfo.params.temp}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
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
                                            <EquipmentBar
                                                selectedEquipment={selectedEquipment}
                                                customEquipments={customEquipments}
                                                onEquipmentSelect={onEquipmentSelect || (() => {})}
                                                onToggleManagementDrawer={handleToggleManagementDrawer}
                                                settings={settings}
                                            />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}

            {/* 器具管理抽屉 */}
            <EquipmentManagementDrawer
                isOpen={isManagementDrawerOpen}
                onClose={() => setIsManagementDrawerOpen(false)}
                customEquipments={customEquipments}
                onAddEquipment={onAddEquipment || (() => {})}
                onEditEquipment={onEditEquipment || (() => {})}
                onDeleteEquipment={onDeleteEquipment || (() => {})}
                onShareEquipment={onShareEquipment || (() => {})}
                onReorderEquipments={handleReorderEquipments}
                settings={settings}
            />
        </motion.div>
    );
};

export default NavigationBar;
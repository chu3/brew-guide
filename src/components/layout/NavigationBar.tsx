'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Equal, ArrowLeft, ChevronsUpDown } from 'lucide-react'

import { equipmentList, type CustomEquipment } from '@/lib/core/config'
import hapticsUtils from '@/lib/ui/haptics'
import { SettingsOptions } from '@/components/settings/Settings'
import { 
    formatGrindSize, 
    parseGrindSize, 
    getMyGrinders, 
    combineGrindSize, 
    smartConvertGrindSize, 
    findGrinder, 
    hasOnlyGenericGrinder, 
    hasSpecificGrindScale, 
    getGrindScaleUnit 
} from '@/lib/utils/grindUtils'
import { getRecommendedGrinder } from '@/lib/utils/grinderRecommendation'
import { useGrinderRecommendationStore } from '@/lib/stores/grinderRecommendationStore'
import { BREWING_EVENTS, ParameterInfo } from '@/lib/brewing/constants'
import { listenToEvent } from '@/lib/brewing/events'
import { updateParameterInfo, getEquipmentName } from '@/lib/brewing/parameters'
import { saveMainTabPreference } from '@/lib/navigation/navigationCache'
import { ViewOption, VIEW_LABELS } from '@/components/coffee-bean/List/types'
import EquipmentBar from '@/components/equipment/EquipmentBar'
import EquipmentManagementDrawer from '@/components/equipment/EquipmentManagementDrawer'
import { isEspressoMachine } from '@/lib/utils/equipmentUtils'

// ==================== Types & Interfaces ====================
type MainTabType = '冲煮' | '咖啡豆' | '笔记'
type BrewingStep = 'coffeeBean' | 'method' | 'brewing' | 'notes'

interface EditableParams {
    coffee: string
    water: string
    ratio: string
    grindSize: string
    temp: string
    extractionTime?: string  // 意式器具专用：萃取时间
}

interface TabButtonProps {
    tab: string
    isActive: boolean
    onClick?: () => void
    dataTab?: string
}

interface EditableParameterProps {
    value: string
    onChange: (value: string) => void
    unit: string
    className?: string
    prefix?: string
    disabled?: boolean
}

interface EditableGrindSizeProps {
    grindSize: string
    onGrindSizeChange: (value: string) => void
    settings: SettingsOptions
    className?: string
    disabled?: boolean
    selectedEquipment?: string | null
    customEquipments?: CustomEquipment[]
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
                time?: number;
                water: string;
                detail: string;
                pourType?: string;
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

// ==================== Helper Functions ====================
const canGoBack = (activeBrewingStep: BrewingStep, activeMainTab: MainTabType, hasCoffeeBeans?: boolean): boolean => {
    if (activeMainTab !== '冲煮') return false
    if (activeBrewingStep === 'coffeeBean') return false
    if (activeBrewingStep === 'method' && !hasCoffeeBeans) return false
    return true
}

// 检查是否是意式器具
const checkIsEspressoEquipment = (
    selectedEquipment: string | null,
    customEquipments: CustomEquipment[]
): boolean => {
    if (!selectedEquipment) return false
    
    // 检查是否是系统预设的意式机
    if (selectedEquipment === 'Espresso') return true
    
    // 检查自定义器具
    const customEquipment = customEquipments.find(eq => eq.id === selectedEquipment)
    if (customEquipment && isEspressoMachine(customEquipment)) return true
    
    return false
}

// 格式化时间显示（秒转为可读格式）
const formatTimeDisplay = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0 ? `${minutes}m${remainingSeconds}s` : `${minutes}m`
}

// ==================== Sub-components ====================
const TabButton: React.FC<TabButtonProps> = ({ tab, isActive, onClick, dataTab }) => {
    return (
        <div
            onClick={onClick}
            className={`text-xs font-medium tracking-widest whitespace-nowrap pb-3 cursor-pointer ${
                isActive
                    ? 'text-neutral-800 dark:text-neutral-100'
                    : 'text-neutral-500 dark:text-neutral-400'
            }`}
            data-tab={dataTab}
        >
            <span className="relative inline-block">
                {tab}
            </span>
        </div>
    )
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

const EditableGrindSize: React.FC<EditableGrindSizeProps> = ({
    grindSize, onGrindSizeChange, settings, className = '', disabled = false, selectedEquipment, customEquipments
}) => {
    const lastUsedGrinderByEquipment = useGrinderRecommendationStore(
        state => state.lastUsedGrinderByEquipment
    );
    
    const [isEditing, setIsEditing] = useState(false)
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const inputRef = React.useRef<HTMLInputElement>(null)
    const dropdownRef = React.useRef<HTMLDivElement>(null)
    const triggerRef = React.useRef<HTMLSpanElement>(null)
    
    const myGrinders = getMyGrinders(settings.myGrinders || ['generic'], settings.customGrinders)
    const onlyHasGeneric = hasOnlyGenericGrinder(settings.myGrinders)
    
    const { grinderId: propGrinderId, value: propValue } = parseGrindSize(grindSize)
    const hasMethodGrinder = propGrinderId && propGrinderId !== 'generic'
    const shouldShowGrinderSelector = hasMethodGrinder || !onlyHasGeneric
    
    // 计算实际使用的磨豆机ID
    const recommendedGrinderId = getRecommendedGrinder(
        selectedEquipment || null,
        settings.myGrinders || ['generic'],
        lastUsedGrinderByEquipment,
        customEquipments
    )
    const actualGrinderId = propGrinderId || recommendedGrinderId
    
    // 计算显示的研磨度值
    let displayValue = propValue || ''
    if (!propGrinderId && actualGrinderId !== 'generic') {
        displayValue = smartConvertGrindSize(
            propValue || '',
            'generic',
            actualGrinderId,
            settings.customGrinders
        )
    }
    
    const [selectedGrinderId, setSelectedGrinderId] = useState(actualGrinderId)
    const [tempValue, setTempValue] = useState(displayValue)
    const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null)
    
    const currentGrinder = findGrinder(selectedGrinderId, settings.customGrinders, false)
    const currentGrinderName = currentGrinder?.name || '通用'
    
    // 同步外部变化
    useEffect(() => {
        setSelectedGrinderId(actualGrinderId)
        setTempValue(displayValue)
    }, [grindSize, actualGrinderId, displayValue])

    // 自动聚焦编辑输入框
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])
    
    const handleSubmit = useCallback(() => {
        setIsEditing(false)
        const valueToUse = tempValue.trim()
        const newGrindSize = combineGrindSize(selectedGrinderId, valueToUse)
        if (newGrindSize !== grindSize) {
            onGrindSizeChange(newGrindSize)
        }
    }, [tempValue, grindSize, selectedGrinderId, onGrindSizeChange])

    const handleCancel = useCallback(() => {
        setTempValue(displayValue)
        setIsEditing(false)
    }, [displayValue])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSubmit()
        else if (e.key === 'Escape') handleCancel()
    }, [handleSubmit, handleCancel])

    const handleGrinderChange = useCallback(async (newGrinderId: string) => {
        const oldGrinderId = selectedGrinderId
        
        const { useGrinderRecommendationStore } = await import('@/lib/stores/grinderRecommendationStore')
        const store = useGrinderRecommendationStore.getState()
        await store.updateLastUsedGrinder(
            selectedEquipment || null,
            newGrinderId,
            customEquipments
        )
        
        setSelectedGrinderId(newGrinderId)
        
        const newGrindSizeValue = smartConvertGrindSize(
            tempValue,
            oldGrinderId,
            newGrinderId,
            settings.customGrinders
        )
        setTempValue(newGrindSizeValue)
        
        const newGrindSize = combineGrindSize(newGrinderId, newGrindSizeValue)
        onGrindSizeChange(newGrindSize)
        
        setIsDropdownOpen(false)
    }, [selectedGrinderId, tempValue, settings.customGrinders, selectedEquipment, customEquipments, onGrindSizeChange])
    
    const updateDropdownPosition = useCallback(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect()
            setDropdownPosition({
                top: rect.bottom + 4,
                left: rect.left
            })
        }
    }, [])
    
    // 处理下拉框位置和外部点击
    useEffect(() => {
        if (!isDropdownOpen) return
        
        updateDropdownPosition()
        
        const handleScroll = () => updateDropdownPosition()
        const handleResize = () => updateDropdownPosition()
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false)
            }
        }
        
        window.addEventListener('scroll', handleScroll, true)
        window.addEventListener('resize', handleResize)
        document.addEventListener('mousedown', handleClickOutside)
        
        return () => {
            window.removeEventListener('scroll', handleScroll, true)
            window.removeEventListener('resize', handleResize)
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isDropdownOpen, updateDropdownPosition])

    if (disabled) {
        const displayValue = formatGrindSize(grindSize, settings.grindType, settings.customGrinders) || '未设置'
        return (
            <span className={`inline-flex items-center ${className}`}>
                <span className="whitespace-nowrap">{displayValue}</span>
            </span>
        )
    }

    const placeholderText = settings && hasSpecificGrindScale(selectedGrinderId) 
        ? `8${getGrindScaleUnit(selectedGrinderId)}` 
        : '中细'

    return (
        <span className={`inline-flex items-center gap-1 ${className}`}>
            {shouldShowGrinderSelector && (
                <span className="relative inline-flex items-center">
                    <span
                        ref={triggerRef}
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className={`bg-transparent border-0 border-b border-dashed text-xs cursor-pointer outline-none pb-0.5 transition-colors duration-150 whitespace-nowrap mr-1 ${
                            isDropdownOpen 
                                ? 'border-neutral-600 dark:border-neutral-400 text-neutral-800 dark:text-neutral-200'
                                : 'border-neutral-300 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400 hover:border-neutral-500 dark:hover:border-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                        }`}
                    >
                        {currentGrinderName}
                    </span>
                </span>
            )}
            
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
            
            <span
                className="group relative inline-flex items-center cursor-pointer min-w-[20px] border-b border-dashed border-neutral-300 dark:border-neutral-600 pb-0.5 transition-all duration-200"
                onClick={() => setIsEditing(true)}
            >
                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onBlur={handleSubmit}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholderText}
                        className="bg-transparent text-xs outline-hidden w-full min-w-[20px] placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
                    />
                ) : (
                    <span className={`whitespace-nowrap text-xs ${!tempValue ? 'text-neutral-400 dark:text-neutral-600' : ''}`}>
                        {tempValue || placeholderText}
                    </span>
                )}
            </span>
        </span>
    )
}

// ==================== Main Component ====================

const NavigationBar: React.FC<NavigationBarProps> = ({
    activeMainTab, setActiveMainTab, activeBrewingStep,
    parameterInfo, setParameterInfo, editableParams, setEditableParams,
    isTimerRunning, showComplete, selectedEquipment, selectedMethod,
    handleParamChange, setShowHistory, onTitleDoubleClick,
    settings, hasCoffeeBeans, alternativeHeader, showAlternativeHeader = false,
    currentBeanView, showViewDropdown, onToggleViewDropdown,
    handleExtractionTimeChange: _handleExtractionTimeChange, customEquipments = [], onEquipmentSelect,
    onAddEquipment, onEditEquipment, onDeleteEquipment, onShareEquipment, onBackClick,
}) => {
    // ========== State ==========
    const [isManagementDrawerOpen, setIsManagementDrawerOpen] = useState(false)
    const [displayOverlay, setDisplayOverlay] = useState<Partial<EditableParams> | null>(null)
    
    // ========== Computed Values ==========
    const showBackButton = canGoBack(activeBrewingStep, activeMainTab, hasCoffeeBeans) && onBackClick
    const shouldHideHeader = activeBrewingStep === 'brewing' && isTimerRunning && !showComplete
    const shouldShowContent = activeMainTab === '冲煮' && (!isTimerRunning || showComplete || activeBrewingStep === 'notes')
    const shouldShowParams = parameterInfo.method
    const isEspressoEquipment = checkIsEspressoEquipment(selectedEquipment, customEquipments)
    
    // ========== Helper Functions ==========
    const getCurrentViewLabel = () => currentBeanView ? VIEW_LABELS[currentBeanView] : '咖啡豆'
    
    const getSelectedEquipmentName = () => 
        selectedEquipment ? getEquipmentName(selectedEquipment, equipmentList, customEquipments) : null
    
    // 获取萃取时间（从方案的stages中提取）
    const getExtractionTime = () => {
        if (!selectedMethod || !isEspressoEquipment) return null
        const extractionStage = selectedMethod.params.stages?.find(stage => stage.pourType === 'extraction')
        return extractionStage?.time ?? null
    }
    
    // 获取格式化的萃取时间显示
    const getExtractionTimeDisplay = () => {
        const time = getExtractionTime()
        return time ? formatTimeDisplay(time) : null
    }
    
    // ========== Event Handlers ==========
    const handleToggleManagementDrawer = () => {
        setIsManagementDrawerOpen(!isManagementDrawerOpen)
    }

    const handleReorderEquipments = async (newOrder: CustomEquipment[]) => {
        try {
            const { saveEquipmentOrder, loadEquipmentOrder } = await import('@/lib/managers/customEquipments')
            const { equipmentUtils } = await import('@/lib/equipment/equipmentUtils')
            
            const currentOrder = await loadEquipmentOrder()
            const allCurrentEquipments = equipmentUtils.getAllEquipments(customEquipments, currentOrder)
            
            const updatedEquipments = allCurrentEquipments.map(eq => 
                eq.isCustom 
                    ? newOrder.find(newEq => newEq.id === eq.id) ?? { ...eq, isCustom: true }
                    : eq
            )
            
            await saveEquipmentOrder(equipmentUtils.generateEquipmentOrder(updatedEquipments))
        } catch (error) {
            console.error('保存器具排序失败:', error)
        }
    }

    const handleBeanTabClick = () => {
        if (activeMainTab === '咖啡豆') {
            onToggleViewDropdown?.()
        } else {
            handleMainTabClick('咖啡豆')
        }
    }

    const handleTitleClick = () => {
        if (settings.hapticFeedback) hapticsUtils.light()
        showBackButton ? onBackClick() : onTitleDoubleClick()
    }

    const handleMainTabClick = (tab: MainTabType) => {
        if (activeMainTab === tab) return

        if (settings.hapticFeedback) hapticsUtils.light()

        saveMainTabPreference(tab)
        setActiveMainTab(tab)
        
        if (tab === '笔记') {
            setShowHistory(true)
        } else if (activeMainTab === '笔记') {
            setShowHistory(false)
        }
    }

    // ========== Effects ==========
    // Effect: Listen to brewing events
    useEffect(() => {
        const handleStepChanged = async (detail: { step: BrewingStep }) => {
            updateParameterInfo(
                detail.step, 
                selectedEquipment, 
                selectedMethod, 
                equipmentList, 
                customEquipments
            )
        }

        const unsubscribeStepChanged = listenToEvent(BREWING_EVENTS.STEP_CHANGED, handleStepChanged)
        const unsubscribeParamsUpdated = listenToEvent(BREWING_EVENTS.PARAMS_UPDATED, setParameterInfo)
        
        return () => {
            unsubscribeStepChanged()
            unsubscribeParamsUpdated()
        }
    }, [selectedEquipment, selectedMethod, customEquipments, setParameterInfo])
    
    // Effect: Handle navbar display updates
    useEffect(() => {
        if (!editableParams || activeBrewingStep !== 'notes') {
            setDisplayOverlay(null)
            return
        }
        
        const handleNavbarDisplayUpdate = (e: CustomEvent) => {
            const { type, value } = e.detail
            
            setDisplayOverlay(currentOverlay => {
                const getCurrentValue = (key: keyof EditableParams) => 
                    currentOverlay?.[key] || editableParams[key] || ''
                
                const currentCoffee = parseFloat(getCurrentValue('coffee').replace('g', ''))
                const currentRatio = parseFloat(getCurrentValue('ratio').split(':')[1])
                
                switch (type) {
                    case 'coffee': {
                        const coffeeValue = parseFloat(value)
                        if (isNaN(coffeeValue) || coffeeValue <= 0) return currentOverlay
                        
                        // 对于意式机，更新咖啡量不影响水量（水量是液重，独立设置）
                        if (isEspressoEquipment) {
                            return {
                                ...currentOverlay,
                                coffee: `${coffeeValue}g`
                            }
                        }
                        
                        // 对于手冲，更新咖啡量会根据水粉比计算水量
                        return {
                            ...currentOverlay,
                            coffee: `${coffeeValue}g`,
                            water: `${Math.round(coffeeValue * currentRatio)}g`
                        }
                    }
                    case 'water': {
                        // 意式机专用：直接更新水量（液重）
                        const waterValue = parseFloat(value)
                        if (isNaN(waterValue) || waterValue <= 0) return currentOverlay
                        
                        return {
                            ...currentOverlay,
                            water: `${waterValue}g`
                        }
                    }
                    case 'ratio': {
                        const ratioValue = parseFloat(value)
                        if (isNaN(ratioValue) || ratioValue <= 0) return currentOverlay
                        
                        return {
                            ...currentOverlay,
                            ratio: `1:${ratioValue}`,
                            water: `${Math.round(currentCoffee * ratioValue)}g`
                        }
                    }
                    case 'extractionTime': {
                        // 意式机专用：萃取时间
                        return { ...currentOverlay, extractionTime: value }
                    }
                    case 'grindSize':
                        return { ...currentOverlay, grindSize: value }
                    case 'temp': {
                        const formattedTemp = value.includes('°C') ? value : `${value}°C`
                        return { ...currentOverlay, temp: formattedTemp }
                    }
                    default:
                        return currentOverlay
                }
            })
        }
        
        window.addEventListener('brewing:updateNavbarDisplay', handleNavbarDisplayUpdate as EventListener)
        
        return () => {
            window.removeEventListener('brewing:updateNavbarDisplay', handleNavbarDisplayUpdate as EventListener)
        }
    }, [activeBrewingStep, editableParams, isEspressoEquipment])

    // ========== Render ==========

    return (
        <motion.div
            className={`sticky top-0 z-20 pt-safe-top border-b transition-colors duration-300 ease-in-out ${
                activeBrewingStep === 'brewing' || activeBrewingStep === 'notes'
                    ? 'border-transparent' 
                    : 'border-neutral-200 dark:border-neutral-800'
            }`}
            transition={{ duration: 0.3, ease: "easeInOut" }}
        >

            <div className="relative min-h-[30px] w-full">
                <AnimatePresence mode="wait">
                    {showAlternativeHeader ? (
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
                                <div
                                    onClick={handleTitleClick}
                                    className="cursor-pointer text-[12px] tracking-widest text-neutral-500 dark:text-neutral-400 flex items-center -ml-3 -mt-3 pl-3 pt-3 pr-4 pb-3"
                                >
                                    {showBackButton ? (
                                        <ArrowLeft className="w-4 h-4 mr-1" />
                                    ) : (
                                        <Equal className="w-4 h-4" />
                                    )}
                                </div>

                                <div 
                                    className="flex items-center space-x-6"
                                    style={{
                                        opacity: showBackButton ? 0 : 1,
                                        pointerEvents: showBackButton ? 'none' : 'auto',
                                        visibility: showBackButton ? 'hidden' : 'visible'
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
                                        <div
                                            ref={(el) => {
                                                if (el && typeof window !== 'undefined') {
                                                    (window as Window & { beanButtonRef?: HTMLDivElement }).beanButtonRef = el;
                                                }
                                            }}
                                            onClick={handleBeanTabClick}
                                            className="text-xs font-medium tracking-widest whitespace-nowrap pb-3 cursor-pointer flex items-center transition-opacity duration-100"
                                            style={
                                                !showBackButton ? {
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

                                            <motion.div
                                                className="flex items-center justify-center overflow-hidden"
                                                initial={false}
                                                animate={{
                                                    width: activeMainTab === '咖啡豆' ? '12px' : '0px',
                                                    marginLeft: activeMainTab === '咖啡豆' ? '4px' : '0px',
                                                    transition: {
                                                        duration: 0.35,
                                                        ease: [0.25, 0.46, 0.45, 0.94],
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
                                                                    ease: [0.25, 0.46, 0.45, 0.94],
                                                                    opacity: { duration: 0.25, delay: 0.1 },
                                                                    scale: { duration: 0.35 }
                                                                }
                                                            }}
                                                            exit={{
                                                                opacity: 0,
                                                                scale: 0.8,
                                                                transition: {
                                                                    duration: 0.15,
                                                                    ease: [0.4, 0.0, 1, 1],
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

                                                {parameterInfo.params && (
                                                    <div className="flex items-center flex-shrink-0">
                                                        {editableParams ? (
                                                            <div className="flex items-center space-x-1 sm:space-x-2">
                                                                {/* 咖啡克重 - 所有器具都显示 */}
                                                                <EditableParameter
                                                                    value={(displayOverlay?.coffee || editableParams.coffee).replace('g', '')}
                                                                    onChange={(v) => handleParamChange('coffee', v)}
                                                                    unit="g"
                                                                />
                                                                <span className="shrink-0">·</span>
                                                                
                                                                {isEspressoEquipment ? (
                                                                    /* 意式器具：萃取时间、水量、研磨度、水温 */
                                                                    <>
                                                                        {/* 萃取时间 */}
                                                                        {getExtractionTime() !== null && (
                                                                            <>
                                                                                <EditableParameter
                                                                                    value={String(getExtractionTime())}
                                                                                    onChange={(v) => {
                                                                                        const timeValue = parseFloat(v)
                                                                                        if (!isNaN(timeValue) && timeValue > 0 && _handleExtractionTimeChange) {
                                                                                            _handleExtractionTimeChange(timeValue)
                                                                                        }
                                                                                    }}
                                                                                    unit="s"
                                                                                    disabled={false}
                                                                                />
                                                                                <span className="shrink-0">·</span>
                                                                            </>
                                                                        )}
                                                                        {/* 水量 */}
                                                                        <EditableParameter
                                                                            value={(displayOverlay?.water || editableParams.water).replace('g', '')}
                                                                            onChange={(v) => handleParamChange('water', v)}
                                                                            unit="g"
                                                                        />
                                                                        <span className="shrink-0">·</span>
                                                                        {/* 研磨度 */}
                                                                        <EditableGrindSize
                                                                            grindSize={displayOverlay?.grindSize || editableParams.grindSize}
                                                                            onGrindSizeChange={(v) => handleParamChange('grindSize', v)}
                                                                            settings={settings}
                                                                            selectedEquipment={selectedEquipment}
                                                                            customEquipments={customEquipments}
                                                                        />
                                                                        {/* 水温 */}
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
                                                                    </>
                                                                ) : (
                                                                    /* 手冲器具：水粉比、研磨度、水温 */
                                                                    <>
                                                                        <EditableParameter
                                                                            value={(displayOverlay?.ratio || editableParams.ratio).replace('1:', '')}
                                                                            onChange={(v) => handleParamChange('ratio', v)}
                                                                            unit=""
                                                                            prefix="1:"
                                                                        />
                                                                        <span className="shrink-0">·</span>
                                                                        <EditableGrindSize
                                                                            grindSize={displayOverlay?.grindSize || editableParams.grindSize}
                                                                            onGrindSizeChange={(v) => handleParamChange('grindSize', v)}
                                                                            settings={settings}
                                                                            selectedEquipment={selectedEquipment}
                                                                            customEquipments={customEquipments}
                                                                        />
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
                                                                    </>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="cursor-pointer flex items-center space-x-1 sm:space-x-2 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                                                                onClick={() => {
                                                                    if (parameterInfo.params && !isTimerRunning) {
                                                                        setEditableParams({
                                                                            coffee: parameterInfo.params.coffee || '',
                                                                            water: parameterInfo.params.water || '',
                                                                            ratio: parameterInfo.params.ratio || '',
                                                                            grindSize: parameterInfo.params.grindSize || '',
                                                                            temp: parameterInfo.params.temp || ''
                                                                        })
                                                                    }
                                                                }}
                                                            >
                                                                {/* 咖啡克重 - 所有器具都显示 */}
                                                                <span className="whitespace-nowrap">{parameterInfo.params.coffee}</span>
                                                                <span className="shrink-0">·</span>
                                                                
                                                                {isEspressoEquipment ? (
                                                                    /* 意式器具：萃取时间、水量、研磨度、水温 */
                                                                    <>
                                                                        {getExtractionTimeDisplay() && (
                                                                            <>
                                                                                <span className="whitespace-nowrap">{getExtractionTimeDisplay()}</span>
                                                                                <span className="shrink-0">·</span>
                                                                            </>
                                                                        )}
                                                                        <span className="whitespace-nowrap">{parameterInfo.params.water}</span>
                                                                        <span className="shrink-0">·</span>
                                                                        <span className="whitespace-nowrap">
                                                                            {formatGrindSize(parameterInfo.params.grindSize || "", settings.grindType, settings.customGrinders)}
                                                                        </span>
                                                                        <span className="shrink-0">·</span>
                                                                        <span className="whitespace-nowrap">{parameterInfo.params.temp}</span>
                                                                    </>
                                                                ) : (
                                                                    /* 手冲器具：水粉比、研磨度、水温 */
                                                                    <>
                                                                        <span className="whitespace-nowrap">{parameterInfo.params.ratio}</span>
                                                                        <span className="shrink-0">·</span>
                                                                        <span className="whitespace-nowrap">
                                                                            {formatGrindSize(parameterInfo.params.grindSize || "", settings.grindType, settings.customGrinders)}
                                                                        </span>
                                                                        <span className="shrink-0">·</span>
                                                                        <span className="whitespace-nowrap">{parameterInfo.params.temp}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

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
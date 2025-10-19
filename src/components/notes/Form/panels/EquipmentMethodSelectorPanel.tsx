'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { X, Search, ChevronRight } from 'lucide-react'
import { commonMethods, type Method, type CustomEquipment } from '@/lib/core/config'
import { loadCustomEquipments } from '@/lib/managers/customEquipments'
import { loadCustomMethods } from '@/lib/managers/customMethods'
import { useEquipmentList } from '@/lib/equipment/useEquipmentList'
import { useScrollToSelected } from '@/lib/equipment/useScrollToSelected'
import { getSelectedEquipmentPreference, saveSelectedEquipmentPreference } from '@/lib/hooks/useBrewingState'

interface EquipmentMethodSelectorPanelProps {
    selectedEquipment: string
    selectedMethod: string
    onSelect: (equipment: string, method: string, params?: Method['params']) => void
    onClose: () => void
}

const EquipmentMethodSelectorPanel: React.FC<EquipmentMethodSelectorPanelProps> = ({
    selectedEquipment: initialEquipment,
    selectedMethod: initialMethod,
    onSelect,
    onClose
}) => {
    const [customEquipments, setCustomEquipments] = useState<CustomEquipment[]>([])
    const [availableMethods, setAvailableMethods] = useState<Method[]>([])
    const [customMethodsData, setCustomMethodsData] = useState<Record<string, Method[]>>({})
    
    // 使用缓存逻辑：优先使用传入的器具，否则使用缓存中的器具
    const [selectedEquipment, setSelectedEquipment] = useState(
        initialEquipment || getSelectedEquipmentPreference()
    )
    const [selectedMethod, setSelectedMethod] = useState(initialMethod)
    const [searchQuery, setSearchQuery] = useState('')
    
    // 参数编辑状态
    const [coffeeAmount, setCoffeeAmount] = useState<string>('15')
    const [ratioAmount, setRatioAmount] = useState<string>('15')
    const [waterAmount, setWaterAmount] = useState<string>('225g')
    const [grindSize, setGrindSize] = useState<string>('中细')
    const [editedParams, setEditedParams] = useState<Method['params'] | null>(null)
    
    const searchInputRef = useRef<HTMLInputElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const equipmentScrollRef = useRef<HTMLDivElement>(null)

    // 使用自定义Hook管理器具列表
    const { allEquipments } = useEquipmentList({ customEquipments })
    
    // 使用自定义Hook管理器具栏滚动
    useScrollToSelected({
        selectedItem: selectedEquipment,
        containerRef: equipmentScrollRef
    })

    // 加载器具和方案数据
    useEffect(() => {
        const loadData = async () => {
            try {
                const customEquips = await loadCustomEquipments()
                setCustomEquipments(customEquips)

                const customMethodsDataLoaded = await loadCustomMethods()
                setCustomMethodsData(customMethodsDataLoaded)
            } catch (error) {
                console.error('加载器具数据失败:', error)
            }
        }
        loadData()
    }, [])

    // 当选择器具时，加载对应的方案
    useEffect(() => {
        if (selectedEquipment) {
            const equipmentCustomMethods = customMethodsData[selectedEquipment] || []
            const equipmentCommonMethods = commonMethods[selectedEquipment] || []
            const allMethods = [...equipmentCustomMethods, ...equipmentCommonMethods]
            setAvailableMethods(allMethods)
            
            // 如果当前选中的方案不在新的方案列表中，清空选择
            if (selectedMethod && !allMethods.some(m => (m.name || m.id) === selectedMethod)) {
                setSelectedMethod('')
            }
        }
    }, [selectedEquipment, customMethodsData, selectedMethod])

    // 处理器具选择
    const handleEquipmentSelect = (equipmentId: string) => {
        setSelectedEquipment(equipmentId)
        // 保存器具选择到缓存，实现记忆功能
        saveSelectedEquipmentPreference(equipmentId)
        // 切换器具时重置参数
        setEditedParams(null)
    }

    // 处理方案选择（点击选中但不关闭）
    const handleMethodSelect = (methodId: string, method: Method) => {
        setSelectedMethod(methodId)
        
        // 初始化参数编辑状态
        const coffee = extractNumber(method.params.coffee)
        const ratio = extractRatioNumber(method.params.ratio)
        
        setCoffeeAmount(coffee)
        setRatioAmount(ratio)
        setWaterAmount(method.params.water)
        setGrindSize(method.params.grindSize)
        setEditedParams(null) // 重置编辑状态
    }

    // 确认选择并关闭
    const handleConfirm = () => {
        const finalParams = editedParams || getCurrentMethodParams()
        onSelect(selectedEquipment, selectedMethod, finalParams)
        onClose()
    }

    // 获取当前方案的参数
    const getCurrentMethodParams = (): Method['params'] | undefined => {
        const allMethods = [...(customMethodsData[selectedEquipment] || []), ...(commonMethods[selectedEquipment] || [])]
        const method = allMethods.find(m => (m.name || m.id) === selectedMethod)
        return method?.params
    }

    // 辅助函数：提取数字部分
    const extractNumber = (str: string): string => {
        const match = str.match(/(\d+(\.\d+)?)/);
        return match ? match[0] : '';
    }

    // 辅助函数：从水粉比中提取数字部分
    const extractRatioNumber = (ratio: string): string => {
        const match = ratio.match(/1:(\d+(\.\d+)?)/);
        return match ? match[1] : '';
    }

    // 处理咖啡粉量变化
    const handleCoffeeAmountChange = (value: string) => {
        const regex = /^$|^[0-9]*\.?[0-9]*$/;
        if (regex.test(value)) {
            setCoffeeAmount(value)

            // 计算并更新水量
            if (value && ratioAmount && value !== '.') {
                const coffeeValue = parseFloat(value)
                const ratioValue = parseFloat(ratioAmount)

                if (!isNaN(coffeeValue) && !isNaN(ratioValue) && coffeeValue > 0) {
                    const waterValue = coffeeValue * ratioValue
                    const roundedWaterValue = Math.round(waterValue)
                    setWaterAmount(`${roundedWaterValue}g`)
                    
                    // 更新编辑的参数
                    const currentParams = getCurrentMethodParams()
                    if (currentParams) {
                        setEditedParams({
                            ...currentParams,
                            coffee: `${value}g`,
                            water: `${roundedWaterValue}g`,
                            ratio: `1:${ratioAmount}`,
                            grindSize: grindSize
                        })
                    }
                }
            }
        }
    }

    // 处理水粉比变化
    const handleRatioAmountChange = (value: string) => {
        const regex = /^$|^[0-9]*\.?[0-9]*$/;
        if (regex.test(value)) {
            setRatioAmount(value)

            // 计算并更新水量
            if (coffeeAmount && value && value !== '.') {
                const coffeeValue = parseFloat(coffeeAmount)
                const ratioValue = parseFloat(value)

                if (!isNaN(coffeeValue) && !isNaN(ratioValue) && coffeeValue > 0) {
                    const waterValue = coffeeValue * ratioValue
                    const roundedWaterValue = Math.round(waterValue)
                    setWaterAmount(`${roundedWaterValue}g`)
                    
                    // 更新编辑的参数
                    const currentParams = getCurrentMethodParams()
                    if (currentParams) {
                        setEditedParams({
                            ...currentParams,
                            coffee: `${coffeeAmount}g`,
                            water: `${roundedWaterValue}g`,
                            ratio: `1:${value}`,
                            grindSize: grindSize
                        })
                    }
                }
            }
        }
    }

    // 处理研磨度变化
    const handleGrindSizeChange = (value: string) => {
        setGrindSize(value)
        
        // 更新编辑的参数
        const currentParams = getCurrentMethodParams()
        if (currentParams) {
            setEditedParams({
                ...currentParams,
                coffee: `${coffeeAmount}g`,
                water: waterAmount,
                ratio: `1:${ratioAmount}`,
                grindSize: value
            })
        }
    }

    // 处理关闭动画
    const handleClose = () => {
        onClose()
    }

    // 区分自定义方案和通用方案
    const customMethodsList = (customMethodsData[selectedEquipment] || []).filter(method => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        return (method.name?.toLowerCase().includes(query))
    })

    const commonMethodsList = (commonMethods[selectedEquipment] || []).filter(method => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        return (method.name?.toLowerCase().includes(query))
    })

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

            {/* 内容区域 - 使用 motion 动画和布局动画 */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                transition={{ 
                    duration: 0.3,
                    ease: "easeOut"
                }}
                layout
                className={`fixed inset-x-4 z-[61] border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-xl overflow-hidden flex flex-col max-w-md mx-auto ${
                    selectedMethod ? 'top-20 bottom-36' : 'top-20 bottom-20'
                }`}
                style={{
                    transition: 'top 0.3s ease-out, bottom 0.3s ease-out'
                }}
            >
                {/* 顶部标题栏 */}
                <div className="flex items-center justify-between px-5 py-4 border-neutral-200 dark:border-neutral-800">
                    <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-200">
                        选择器具和方案
                    </h3>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="p-2 text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 rounded-full transition-colors"
                    >
                        <X size={12} />
                    </button>
                </div>

                {/* 器具横向滚动栏 */}
                <div className="relative w-full overflow-hidden px-5">
                    <div
                        ref={equipmentScrollRef}
                        className="flex items-center gap-4 overflow-x-auto"
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

                        {allEquipments.map((equipment) => (
                            <div key={equipment.id} className="flex-shrink-0 flex items-center">
                                <button
                                    onClick={() => handleEquipmentSelect(equipment.id)}
                                    className="whitespace-nowrap text-xs font-medium tracking-widest pb-3 relative"
                                    data-tab={equipment.id}
                                >
                                    <span className={`${
                                        selectedEquipment === equipment.id
                                            ? 'text-neutral-800 dark:text-neutral-100'
                                            : 'text-neutral-500 dark:text-neutral-400'
                                    }`}>
                                        {equipment.name}
                                    </span>
                                    <span className={`absolute -bottom-3 left-0 right-0 z-10 h-px bg-neutral-800 dark:bg-neutral-100 transition-all duration-200 ${
                                        selectedEquipment === equipment.id ? 'opacity-100 w-full' : 'opacity-0 w-0'
                                    }`} />
                                </button>
                            </div>
                        ))}

                        {/* 右侧渐变效果 */}
                        {allEquipments.length > 3 && (
                            <div className="absolute top-0 right-0 w-6 h-full bg-gradient-to-l from-white dark:from-neutral-900 to-transparent pointer-events-none" />
                        )}
                    </div>
                </div>

                {/* 搜索框 */}
                {availableMethods.length > 0 && (
                    <div className="px-3 py-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none" size={16} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="搜索方案..."
                                className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-100 dark:bg-neutral-800 border-0 rounded-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-600 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-neutral-800 dark:text-neutral-200"
                            />
                        </div>
                    </div>
                )}

                {/* 方案列表 - 可滚动，使用左侧边框样式 */}
                <div 
                    ref={scrollContainerRef} 
                    className="flex-1 overflow-y-auto px-5 py-4"
                    style={{
                        WebkitOverflowScrolling: 'touch'
                    }}
                >
                    {availableMethods.length > 0 ? (
                        <div className="space-y-5">
                            {/* 自定义方案 */}
                            {customMethodsList.length > 0 && (
                                customMethodsList.map((method) => {
                                    const isSelected = selectedMethod === (method.name || method.id)
                                    
                                    return (
                                        <div
                                            key={method.id || method.name}
                                            className="group relative"
                                        >
                                            <div
                                                className={`relative border-l ${
                                                    isSelected
                                                        ? 'border-neutral-800 dark:border-white'
                                                        : 'border-neutral-200 dark:border-neutral-800'
                                                } pl-6 ${!isSelected ? 'cursor-pointer' : ''}`}
                                                onClick={() => !isSelected && handleMethodSelect(method.name || method.id || '', method)}
                                            >
                                                {isSelected && (
                                                    <div className="absolute -left-px top-0 h-full w-px bg-neutral-800 dark:bg-white"></div>
                                                )}
                                                
                                                <div className="text-xs font-medium tracking-wider text-neutral-800 dark:text-neutral-100">
                                                    {method.name}
                                                </div>
                                                
                                                {!isSelected && method.params && (
                                                    <div className="mt-1.5 space-y-0.5 text-neutral-500 dark:text-neutral-400">
                                                        <div className="flex items-center">
                                                            <span className="text-xs font-medium w-14">咖啡粉:</span>
                                                            <span className="text-xs font-medium">{method.params.coffee}</span>
                                                        </div>
                                                        <div className="flex items-center">
                                                            <span className="text-xs font-medium w-14">水量:</span>
                                                            <span className="text-xs font-medium">{method.params.water}</span>
                                                        </div>
                                                        <div className="flex items-center">
                                                            <span className="text-xs font-medium w-14">粉水比:</span>
                                                            <span className="text-xs font-medium">{method.params.ratio}</span>
                                                        </div>
                                                        <div className="flex items-center">
                                                            <span className="text-xs font-medium w-14">研磨度:</span>
                                                            <span className="text-xs font-medium">{method.params.grindSize}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {isSelected && (
                                                    <div className="mt-2 pt-2 border-t border-dashed border-neutral-200 dark:border-neutral-700" onClick={(e) => e.stopPropagation()}>
                                                        <div className="space-y-2">
                                                            {/* 咖啡粉量 */}
                                                            <div className="flex items-center">
                                                                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 w-14">咖啡粉:</label>
                                                                <div className="w-20 flex justify-end">
                                                                    <input
                                                                        type="text"
                                                                        value={coffeeAmount}
                                                                        onChange={(e) => handleCoffeeAmountChange(e.target.value)}
                                                                        className="w-12 py-0.5 px-1 border border-neutral-300 dark:border-neutral-700 rounded-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-right text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                                                        placeholder="15"
                                                                    />
                                                                    <span className="ml-0.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">g</span>
                                                                </div>
                                                            </div>

                                                            {/* 水量 - 不可编辑 */}
                                                            <div className="flex items-center">
                                                                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 w-14">水量:</label>
                                                                <div className="w-20 flex justify-end">
                                                                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{waterAmount}</span>
                                                                </div>
                                                            </div>

                                                            {/* 粉水比 */}
                                                            <div className="flex items-center">
                                                                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 w-14">粉水比:</label>
                                                                <div className="w-20 flex justify-end items-center">
                                                                    <span className="mr-0.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">1:</span>
                                                                    <input
                                                                        type="text"
                                                                        value={ratioAmount}
                                                                        onChange={(e) => handleRatioAmountChange(e.target.value)}
                                                                        className="w-10 py-0.5 px-1 border border-neutral-300 dark:border-neutral-700 rounded-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-right text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                                                        placeholder="15"
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* 研磨度 */}
                                                            <div className="flex items-center">
                                                                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 w-14">研磨度:</label>
                                                                <div className="w-20 flex justify-end">
                                                                    <input
                                                                        type="text"
                                                                        value={grindSize}
                                                                        onChange={(e) => handleGrindSizeChange(e.target.value)}
                                                                        className="w-16 py-0.5 px-1 border border-neutral-300 dark:border-neutral-700 rounded-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-right text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                                                        placeholder="中细"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            )}

                            {/* 分隔符 */}
                            {customMethodsList.length > 0 && commonMethodsList.length > 0 && (
                                <div className="py-0 flex items-center">
                                    <div className="grow h-px bg-neutral-200 dark:bg-neutral-800"></div>
                                    <span className="px-2 text-xs text-neutral-500 dark:text-neutral-400">通用方案</span>
                                    <div className="grow h-px bg-neutral-200 dark:bg-neutral-800"></div>
                                </div>
                            )}

                            {/* 通用方案 */}
                            {commonMethodsList.length > 0 && (
                                commonMethodsList.map((method) => {
                                    const isSelected = selectedMethod === method.name
                                    
                                    return (
                                        <div
                                            key={method.name}
                                            className="group relative"
                                        >
                                            <div
                                                className={`relative border-l ${
                                                    isSelected
                                                        ? 'border-neutral-800 dark:border-white'
                                                        : 'border-neutral-200 dark:border-neutral-800'
                                                } pl-6 ${!isSelected ? 'cursor-pointer' : ''}`}
                                                onClick={() => !isSelected && handleMethodSelect(method.name || '', method)}
                                            >
                                                {isSelected && (
                                                    <div className="absolute -left-px top-0 h-full w-px bg-neutral-800 dark:bg-white"></div>
                                                )}
                                                
                                                <div className="text-xs font-medium tracking-wider text-neutral-800 dark:text-neutral-100">
                                                    {method.name}
                                                </div>
                                                
                                                {!isSelected && method.params && (
                                                    <div className="mt-1.5 space-y-0.5 text-neutral-500 dark:text-neutral-400">
                                                        <div className="flex items-center">
                                                            <span className="text-xs font-medium w-14">咖啡粉:</span>
                                                            <span className="text-xs font-medium">{method.params.coffee}</span>
                                                        </div>
                                                        <div className="flex items-center">
                                                            <span className="text-xs font-medium w-14">水量:</span>
                                                            <span className="text-xs font-medium">{method.params.water}</span>
                                                        </div>
                                                        <div className="flex items-center">
                                                            <span className="text-xs font-medium w-14">粉水比:</span>
                                                            <span className="text-xs font-medium">{method.params.ratio}</span>
                                                        </div>
                                                        <div className="flex items-center">
                                                            <span className="text-xs font-medium w-14">研磨度:</span>
                                                            <span className="text-xs font-medium">{method.params.grindSize}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {isSelected && (
                                                    <div className="mt-2 pt-2 border-t border-dashed border-neutral-200 dark:border-neutral-700" onClick={(e) => e.stopPropagation()}>
                                                        <div className="space-y-2">
                                                            {/* 咖啡粉量 */}
                                                            <div className="flex items-center">
                                                                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 w-14">咖啡粉:</label>
                                                                <div className="w-20 flex justify-end">
                                                                    <input
                                                                        type="text"
                                                                        value={coffeeAmount}
                                                                        onChange={(e) => handleCoffeeAmountChange(e.target.value)}
                                                                        className="w-12 py-0.5 px-1 border border-neutral-300 dark:border-neutral-700 rounded-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-right text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                                                        placeholder="15"
                                                                    />
                                                                    <span className="ml-0.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">g</span>
                                                                </div>
                                                            </div>

                                                            {/* 水量 - 不可编辑 */}
                                                            <div className="flex items-center">
                                                                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 w-14">水量:</label>
                                                                <div className="w-20 flex justify-end">
                                                                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{waterAmount}</span>
                                                                </div>
                                                            </div>

                                                            {/* 粉水比 */}
                                                            <div className="flex items-center">
                                                                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 w-14">粉水比:</label>
                                                                <div className="w-20 flex justify-end items-center">
                                                                    <span className="mr-0.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">1:</span>
                                                                    <input
                                                                        type="text"
                                                                        value={ratioAmount}
                                                                        onChange={(e) => handleRatioAmountChange(e.target.value)}
                                                                        className="w-10 py-0.5 px-1 border border-neutral-300 dark:border-neutral-700 rounded-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-right text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                                                        placeholder="15"
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* 研磨度 */}
                                                            <div className="flex items-center">
                                                                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 w-14">研磨度:</label>
                                                                <div className="w-20 flex justify-end">
                                                                    <input
                                                                        type="text"
                                                                        value={grindSize}
                                                                        onChange={(e) => handleGrindSizeChange(e.target.value)}
                                                                        className="w-16 py-0.5 px-1 border border-neutral-300 dark:border-neutral-700 rounded-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 text-right text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-neutral-500"
                                                                        placeholder="中细"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            )}

                            {/* 没有找到匹配的方案 */}
                            {customMethodsList.length === 0 && commonMethodsList.length === 0 && searchQuery && (
                                <div className="text-xs text-neutral-500 dark:text-neutral-400 border-l border-neutral-200 dark:border-neutral-800 pl-6">
                                    没有找到匹配的方案
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 border-l border-neutral-200 dark:border-neutral-800 pl-6">
                            该器具暂无方案
                        </div>
                    )}
                </div>

                {/* 底部确认按钮 - 独立显示在外面 */}
            </motion.div>

            {/* 确认按钮 - 独立浮动在底部，带动画 */}
            {selectedMethod && (
                <motion.div
                    key="confirm-button"
                    initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                    transition={{ 
                        duration: 0.3,
                        ease: "easeOut"
                    }}
                    className="fixed inset-x-4 bottom-20 z-[61] max-w-md mx-auto"
                >
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="w-full py-4 px-5 bg-white dark:bg-neutral-900 rounded-xl text-sm font-medium text-neutral-500 dark:text-neutral-200 tracking-widest hover:bg-neutral-200 dark:hover:bg-neutral-700 active:scale-95 transition-all border border-neutral-100 dark:border-neutral-800 flex items-center justify-between"
                    >
                        <span>添加方案</span>
                        <ChevronRight size={16} />
                    </button>
                </motion.div>
            )}
        </>
    )
}

export default EquipmentMethodSelectorPanel

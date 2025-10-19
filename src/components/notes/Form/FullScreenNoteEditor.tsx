'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowUp, Camera, Image as ImageIcon } from 'lucide-react'
import Image from 'next/image'
import type { BrewingNoteData, CoffeeBean } from '@/types/app'
import AutoResizeTextarea from '@/components/common/forms/AutoResizeTextarea'
import CoffeeBeanRandomPicker from '@/components/coffee-bean/RandomPicker/CoffeeBeanRandomPicker'
import { useCoffeeBeanData } from './hooks/useCoffeeBeanData'
import { getEquipmentNameById } from '@/lib/utils/equipmentUtils'
import { loadCustomEquipments } from '@/lib/managers/customEquipments'
import type { CustomEquipment, Method } from '@/lib/core/config'
import { CustomFlavorDimensionsManager, type FlavorDimension } from '@/lib/managers/customFlavorDimensions'
import { captureImage, compressBase64Image } from '@/lib/utils/imageCapture'
import { Calendar } from '@/components/common/ui/Calendar'

// 独立的选择器面板组件
import CoffeeBeanSelectorPanel from './panels/CoffeeBeanSelectorPanel'
import EquipmentMethodSelectorPanel from './panels/EquipmentMethodSelectorPanel'
import RatingSelectorPanel from './panels/RatingSelectorPanel'

interface FullScreenNoteEditorProps {
    isOpen: boolean
    initialData?: Partial<BrewingNoteData> & { coffeeBean?: CoffeeBean | null }
    onSave: (data: BrewingNoteData) => void
    onClose: () => void
}

type ActivePanel = 'bean' | 'equipment' | 'rating' | null

const FullScreenNoteEditor: React.FC<FullScreenNoteEditorProps> = ({
    isOpen,
    initialData,
    onSave,
    onClose
}) => {
    // 咖啡豆数据
    const { beans: coffeeBeans } = useCoffeeBeanData()
    
    // 基础表单数据
    const [description, setDescription] = useState(initialData?.notes || '')
    const [image, setImage] = useState<string>((initialData?.image as string | undefined) || '')
    
    // 选择的数据
    const [selectedCoffeeBean, setSelectedCoffeeBean] = useState<CoffeeBean | null>(
        initialData?.coffeeBean || null
    )
    const [selectedEquipment, setSelectedEquipment] = useState(initialData?.equipment || '')
    const [selectedMethod, setSelectedMethod] = useState(initialData?.method || '')
    const [rating, setRating] = useState(initialData?.rating || 0)
    const [tasteRatings, setTasteRatings] = useState<Record<string, number>>(initialData?.taste || {})
    const [brewDate, setBrewDate] = useState<Date>(initialData?.timestamp ? new Date(initialData.timestamp) : new Date())

    // 自定义器具列表（用于获取器具名称）
    const [customEquipments, setCustomEquipments] = useState<CustomEquipment[]>([])
    
    // 风味维度列表（用于显示风味评分）
    const [flavorDimensions, setFlavorDimensions] = useState<FlavorDimension[]>([])

    // UI状态
    const [activePanel, setActivePanel] = useState<ActivePanel>(null)
    const [isRandomPickerOpen, setIsRandomPickerOpen] = useState(false)
    const [showExitConfirm, setShowExitConfirm] = useState(false)
    const [showDatePicker, setShowDatePicker] = useState(false)
    const datePickerRef = useRef<HTMLDivElement>(null)
    const dateButtonRef = useRef<HTMLButtonElement>(null)

    // 监听 initialData 变化，更新表单状态
    useEffect(() => {
        if (!isOpen) return

        // 更新所有表单字段
        setDescription(initialData?.notes || '')
        setImage((initialData?.image as string | undefined) || '')
        setSelectedCoffeeBean(initialData?.coffeeBean || null)
        setSelectedEquipment(initialData?.equipment || '')
        setSelectedMethod(initialData?.method || '')
        setRating(initialData?.rating || 0)
        setTasteRatings(initialData?.taste || {})
        setBrewDate(initialData?.timestamp ? new Date(initialData.timestamp) : new Date())
    }, [isOpen, initialData])

    // 加载自定义器具列表和风味维度
    useEffect(() => {
        if (isOpen) {
            loadCustomEquipments()
                .then(equipments => setCustomEquipments(equipments))
                .catch(error => console.error('加载自定义器具失败:', error))
            
            CustomFlavorDimensionsManager.getFlavorDimensions()
                .then(dimensions => setFlavorDimensions(dimensions))
                .catch(error => console.error('加载风味维度失败:', error))
        }
    }, [isOpen])

    // 加载草稿数据（仅在新建笔记且没有传入初始数据时）
    useEffect(() => {
        if (!isOpen || initialData?.id) return // 如果是编辑模式，不加载草稿
        
        // 如果 initialData 中已经有咖啡豆数据，不加载草稿（优先使用传入的数据）
        if (initialData?.coffeeBean) return

        try {
            const draftStr = localStorage.getItem('brewingNoteDraft')
            console.log('📋 加载草稿:', draftStr ? '找到草稿' : '无草稿')
            
            if (draftStr) {
                const draft = JSON.parse(draftStr)
                console.log('📋 草稿内容:', draft)
                
                // 检查草稿是否真的有内容（排除默认值）
                const hasRealContent = !!(
                    draft.description?.trim() ||
                    draft.image ||
                    draft.selectedCoffeeBean ||
                    draft.selectedEquipment ||
                    draft.selectedMethod ||
                    (draft.rating && draft.rating > 0) ||
                    (draft.tasteRatings && Object.keys(draft.tasteRatings).some(key => draft.tasteRatings[key] > 0))
                )
                
                console.log('📋 草稿有效性:', hasRealContent)
                
                // 只有在草稿有真实内容时才恢复
                if (hasRealContent) {
                    console.log('✅ 恢复草稿数据')
                    if (draft.description) setDescription(draft.description)
                    if (draft.image) setImage(draft.image)
                    if (draft.selectedCoffeeBean) setSelectedCoffeeBean(draft.selectedCoffeeBean)
                    if (draft.selectedEquipment) setSelectedEquipment(draft.selectedEquipment)
                    if (draft.selectedMethod) setSelectedMethod(draft.selectedMethod)
                    if (draft.rating !== undefined && draft.rating > 0) setRating(draft.rating)
                    if (draft.tasteRatings) setTasteRatings(draft.tasteRatings)
                    if (draft.brewDate) setBrewDate(new Date(draft.brewDate))
                } else {
                    // 如果草稿没有真实内容，清除它
                    console.log('🗑️ 清除无效草稿')
                    localStorage.removeItem('brewingNoteDraft')
                }
            }
        } catch (error) {
            console.error('加载草稿失败:', error)
        }
    }, [isOpen, initialData])

    // 自动保存草稿（仅在新建笔记时）
    useEffect(() => {
        if (!isOpen || initialData?.id) return // 如果是编辑模式，不自动保存草稿

        // 检查是否有内容需要保存
        const hasContent = !!(
            description.trim() ||
            image ||
            selectedCoffeeBean ||
            selectedEquipment ||
            selectedMethod ||
            rating > 0 ||
            Object.keys(tasteRatings).length > 0
        )

        if (!hasContent) {
            // 如果没有内容，清除草稿
            localStorage.removeItem('brewingNoteDraft')
            return
        }

        // 延迟保存，避免频繁写入
        const timer = setTimeout(() => {
            try {
                const draftData = {
                    description,
                    image,
                    selectedCoffeeBean,
                    selectedEquipment,
                    selectedMethod,
                    rating,
                    tasteRatings,
                    brewDate: brewDate.getTime(),
                    savedAt: Date.now()
                }
                
                localStorage.setItem('brewingNoteDraft', JSON.stringify(draftData))
            } catch (error) {
                console.error('自动保存草稿失败:', error)
            }
        }, 1000) // 1秒后保存

        return () => clearTimeout(timer)
    }, [isOpen, initialData, description, image, selectedCoffeeBean, selectedEquipment, selectedMethod, rating, tasteRatings, brewDate])

    // 获取器具名称用于显示
    const equipmentName = selectedEquipment 
        ? getEquipmentNameById(selectedEquipment, customEquipments) || selectedEquipment
        : ''

    // 格式化日期显示
    const formatDateDisplay = (date: Date): string => {
        const month = date.getMonth() + 1
        const day = date.getDate()
        return `${month}月${day}日`
    }

    // 检查表单是否有内容
    const hasFormContent = useCallback(() => {
        const tasteRatingsWithValues = Object.entries(tasteRatings).filter(([_, value]) => value > 0)
        
        const hasContent = !!(
            description.trim() ||
            image ||
            selectedCoffeeBean ||
            selectedEquipment ||
            selectedMethod ||
            rating > 0 ||
            tasteRatingsWithValues.length > 0
        )
        
        console.log('📝 表单内容检查:', {
            hasContent,
            description: description.trim(),
            image: !!image,
            selectedCoffeeBean: !!selectedCoffeeBean,
            selectedEquipment: !!selectedEquipment,
            selectedMethod: !!selectedMethod,
            rating,
            tasteRatings,
            tasteRatingsCount: Object.keys(tasteRatings).length,
            tasteRatingsWithValuesCount: tasteRatingsWithValues.length
        })
        
        return hasContent
    }, [description, image, selectedCoffeeBean, selectedEquipment, selectedMethod, rating, tasteRatings])

    // 处理关闭（显示确认对话框或直接关闭）
    const handleClose = useCallback(() => {
        const hasContent = hasFormContent()
        console.log('🚪 尝试关闭:', {
            isEditMode: !!initialData?.id,
            hasContent,
            willShowConfirm: !initialData?.id && hasContent
        })
        
        // 如果是编辑模式或表单为空，直接关闭
        if (initialData?.id || !hasContent) {
            onClose()
        } else {
            // 显示退出确认
            setShowExitConfirm(true)
        }
    }, [initialData, hasFormContent, onClose])

    // 保存草稿并退出
    const handleSaveDraft = useCallback(async () => {
        try {
            // 保存草稿到 localStorage
            const draftData = {
                description,
                image,
                selectedCoffeeBean,
                selectedEquipment,
                selectedMethod,
                rating,
                tasteRatings,
                brewDate: brewDate.getTime(),
                savedAt: Date.now()
            }
            
            localStorage.setItem('brewingNoteDraft', JSON.stringify(draftData))
            
            setShowExitConfirm(false)
            onClose()
        } catch (error) {
            console.error('保存草稿失败:', error)
            setShowExitConfirm(false)
            onClose()
        }
    }, [description, image, selectedCoffeeBean, selectedEquipment, selectedMethod, rating, tasteRatings, brewDate, onClose])

    // 清空并退出
    const handleClearAndExit = useCallback(() => {
        // 清空草稿
        localStorage.removeItem('brewingNoteDraft')
        
        setDescription('')
        setImage('')
        setSelectedCoffeeBean(null)
        setSelectedEquipment('')
        setSelectedMethod('')
        setRating(0)
        setTasteRatings({})
        setBrewDate(new Date())
        setShowExitConfirm(false)
        onClose()
    }, [onClose])

    // 处理随机选择咖啡豆
    const handleRandomBeanSelect = useCallback((bean: CoffeeBean) => {
        setSelectedCoffeeBean(bean)
        setIsRandomPickerOpen(false)
        setActivePanel(null)
    }, [])

    // 处理图片选择
    const handleImageSelect = useCallback(async (source: 'camera' | 'gallery') => {
        try {
            // 获取图片（已经是base64格式）
            const result = await captureImage({ source });

            // 直接压缩base64图片
            const compressedBase64 = await compressBase64Image(result.dataUrl, {
                maxSizeMB: 0.1,
                maxWidthOrHeight: 1200,
                initialQuality: 0.8
            });

            // 更新图片
            setImage(compressedBase64);
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.error('打开相机/相册失败:', error);
            }
        }
    }, []);

    // 处理保存
    const handleSave = useCallback(() => {
        const noteData: BrewingNoteData = {
            id: initialData?.id || Date.now().toString(),
            timestamp: brewDate.getTime(),
            coffeeBeanInfo: {
                name: selectedCoffeeBean?.name || '',
                roastLevel: selectedCoffeeBean?.roastLevel || '中度烘焙',
                roastDate: selectedCoffeeBean?.roastDate || ''
            },
            notes: description,
            equipment: selectedEquipment,
            method: selectedMethod,
            params: initialData?.params || {
                coffee: '15g',
                water: '225g',
                ratio: '1:15',
                grindSize: '中细',
                temp: '92°C'
            },
            rating,
            taste: tasteRatings,
            beanId: selectedCoffeeBean?.id,
            image: image || undefined
        }

        onSave(noteData)
        
        // 清除草稿
        localStorage.removeItem('brewingNoteDraft')
        
        // 如果不是编辑模式，保存后重置表单
        if (!initialData?.id) {
            setDescription('')
            setImage('')
            setSelectedCoffeeBean(null)
            setSelectedEquipment('')
            setSelectedMethod('')
            setRating(0)
            setTasteRatings({})
            setBrewDate(new Date())
        }
        
        onClose()
    }, [
        description,
        selectedCoffeeBean,
        selectedEquipment,
        selectedMethod,
        rating,
        tasteRatings,
        brewDate,
        image,
        initialData,
        onSave,
        onClose
    ])

    // 历史栈管理
    useEffect(() => {
        if (!isOpen) return

        window.history.pushState({ modal: 'fullscreen-note-editor' }, '')

        const handlePopState = () => {
            if (showExitConfirm) {
                setShowExitConfirm(false)
                window.history.pushState({ modal: 'fullscreen-note-editor' }, '')
            } else if (activePanel) {
                setActivePanel(null)
                window.history.pushState({ modal: 'fullscreen-note-editor' }, '')
            } else {
                handleClose()
            }
        }

        window.addEventListener('popstate', handlePopState)
        return () => window.removeEventListener('popstate', handlePopState)
    }, [isOpen, activePanel, showExitConfirm, handleClose])

    // 防止背景滚动
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
            document.body.style.position = 'fixed'
            document.body.style.width = '100%'
        }
        return () => {
            document.body.style.overflow = ''
            document.body.style.position = ''
            document.body.style.width = ''
        }
    }, [isOpen])

    // 点击外部关闭退出确认状态
    useEffect(() => {
        if (!showExitConfirm) return

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement
            // 检查点击是否在退出确认按钮区域外
            const isClickInsideExitButtons = target.closest('.exit-confirm-buttons')
            if (!isClickInsideExitButtons) {
                setShowExitConfirm(false)
            }
        }

        // 延迟添加监听器，避免立即触发
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside)
            document.addEventListener('touchstart', handleClickOutside as EventListener)
        }, 100)

        return () => {
            clearTimeout(timer)
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('touchstart', handleClickOutside as EventListener)
        }
    }, [showExitConfirm])

    // 点击外部关闭日期选择器
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node
            // 如果点击的是日期按钮或日期选择器内部，不关闭
            if (
                (dateButtonRef.current && dateButtonRef.current.contains(target)) ||
                (datePickerRef.current && datePickerRef.current.contains(target))
            ) {
                return
            }
            setShowDatePicker(false)
        }

        if (showDatePicker) {
            // 延迟添加监听器，避免立即触发
            const timer = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside)
            }, 100)
            
            return () => {
                clearTimeout(timer)
                document.removeEventListener('mousedown', handleClickOutside)
            }
        }
    }, [showDatePicker])

    // 计算日期选择器的位置，防止超出屏幕
    const getDatePickerPosition = () => {
        if (!dateButtonRef.current) return { bottom: 0, left: 0 }

        const buttonRect = dateButtonRef.current.getBoundingClientRect()
        const pickerWidth = 280
        const pickerHeight = 320 // 日历组件的大致高度
        const padding = 8 // 与按钮的间距

        // 计算垂直位置（默认显示在按钮上方）
        let bottom = window.innerHeight - buttonRect.top + padding
        
        // 如果上方空间不够，考虑显示在下方
        if (buttonRect.top < pickerHeight + padding) {
            // 上方空间不足，尝试显示在下方
            const spaceBelow = window.innerHeight - buttonRect.bottom
            if (spaceBelow > pickerHeight + padding) {
                // 下方空间足够，改为显示在下方
                bottom = window.innerHeight - buttonRect.bottom - pickerHeight - padding
            }
            // 如果上下都不够，保持显示在上方，并让用户滚动
        }

        // 计算水平位置（确保不超出屏幕左右边界）
        let left = buttonRect.left
        
        // 如果右侧超出屏幕
        if (left + pickerWidth > window.innerWidth) {
            left = window.innerWidth - pickerWidth - 16 // 16px 右侧边距
        }
        
        // 如果左侧超出屏幕
        if (left < 16) {
            left = 16 // 16px 左侧边距
        }

        return { bottom, left }
    }

    // 处理日期变化
    const handleDateChange = (newDate: Date) => {
        // 保持原有的时分秒，只修改年月日
        const updatedTimestamp = new Date(brewDate)
        updatedTimestamp.setFullYear(newDate.getFullYear())
        updatedTimestamp.setMonth(newDate.getMonth())
        updatedTimestamp.setDate(newDate.getDate())

        setBrewDate(updatedTimestamp)
        setShowDatePicker(false)
    }

    return (
        <AnimatePresence mode="wait">
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ 
                        duration: 0.2,
                        ease: [0.25, 0.46, 0.45, 0.94]
                    }}
                    style={{
                        willChange: "opacity, transform"
                    }}
                    className="fixed inset-0 z-50 bg-neutral-50 dark:bg-neutral-900 flex flex-col overflow-hidden"
                >
                    {/* 顶部导航栏 */}
                    <div className="flex items-center justify-between px-6 pt-safe-top h-14 shrink-0">
                        {/* 左侧按钮区域 - 使用变形动画 */}
                        <motion.div
                            className="flex items-center justify-center overflow-hidden relative h-8 exit-confirm-buttons"
                            initial={false}
                            animate={{
                                width: showExitConfirm ? "auto" : "2rem",
                                borderRadius: "1rem",
                            }}
                            transition={{
                                duration: 0.3,
                                ease: [0.4, 0, 0.2, 1],
                            }}
                        >
                            {/* 关闭按钮 - 展开时淡出 */}
                            <motion.button
                                type="button"
                                onClick={handleClose}
                                className="absolute inset-0 flex items-center justify-center w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                                initial={false}
                                animate={{
                                    opacity: showExitConfirm ? 0 : 1,
                                }}
                                transition={{
                                    duration: 0.15,
                                    ease: "easeOut",
                                }}
                                style={{
                                    pointerEvents: showExitConfirm ? 'none' : 'auto',
                                }}
                            >
                                <X size={16} className="text-neutral-600 dark:text-neutral-400" />
                            </motion.button>

                            {/* 展开的选项按钮 - 收起时淡出 */}
                            <motion.div
                                className="flex items-center gap-0.5 px-1 h-full bg-neutral-100 dark:bg-neutral-800"
                                initial={false}
                                animate={{
                                    opacity: showExitConfirm ? 1 : 0,
                                }}
                                transition={{
                                    duration: 0.2,
                                    delay: showExitConfirm ? 0.1 : 0,
                                    ease: "easeOut",
                                }}
                                style={{
                                    pointerEvents: showExitConfirm ? 'auto' : 'none',
                                }}
                            >
                                <motion.button
                                    type="button"
                                    onClick={handleClearAndExit}
                                    className="px-3 h-full text-xs font-medium whitespace-nowrap rounded-lg text-red-600 dark:text-red-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 transition-colors"
                                    initial={false}
                                    animate={{
                                        opacity: showExitConfirm ? 1 : 0,
                                    }}
                                    transition={{
                                        duration: 0.2,
                                        delay: showExitConfirm ? 0.12 : 0,
                                        ease: "easeOut",
                                    }}
                                >
                                    清空退出
                                </motion.button>
                                <motion.button
                                    type="button"
                                    onClick={handleSaveDraft}
                                    className="px-3 h-full text-xs font-medium whitespace-nowrap rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 transition-colors"
                                    initial={false}
                                    animate={{
                                        opacity: showExitConfirm ? 1 : 0,
                                    }}
                                    transition={{
                                        duration: 0.2,
                                        delay: showExitConfirm ? 0.15 : 0,
                                        ease: "easeOut",
                                    }}
                                >
                                    保存草稿
                                </motion.button>
                            </motion.div>
                        </motion.div>

                        <AnimatePresence mode="wait">
                            {!showExitConfirm && (
                                <motion.div
                                    key="title"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex-1 text-center"
                                >
                                    <span className="text-sm font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                                        添加笔记
                                    </span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <button
                            type="button"
                            onClick={handleSave}
                            className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex items-center justify-center flex-shrink-0"
                        >
                            <ArrowUp size={16} className="text-neutral-600 dark:text-neutral-400" />
                        </button>
                    </div>

                    {/* 主内容区域 - 全屏输入 */}
                    <div className="flex-1 overflow-y-auto px-6 pt-6 pb-24">
                        {/* 咖啡豆信息展示区域 */}
                        {selectedCoffeeBean ? (
                            <div className="mb-6">
                                <div className="flex gap-3">
                                    {/* 咖啡豆图片 */}
                                    {selectedCoffeeBean.image && (
                                        <div className="w-14 h-14 relative shrink-0 rounded border border-neutral-200/50 dark:border-neutral-800/50 bg-neutral-100 dark:bg-neutral-800/20 overflow-hidden">
                                            <Image 
                                                src={selectedCoffeeBean.image} 
                                                alt={selectedCoffeeBean.name}
                                                className="object-cover"
                                                fill
                                                sizes="56px"
                                            />
                                        </div>
                                    )}
                                    
                                    {/* 咖啡豆信息 */}
                                    <div className="flex-1 min-w-0 flex flex-col gap-y-2 justify-center">
                                        <div className="flex flex-col justify-center gap-y-1">
                                            <button
                                                type="button"
                                                onClick={() => setActivePanel('bean')}
                                                className="text-xs font-medium text-neutral-800 dark:text-neutral-100 leading-tight line-clamp-2 text-left hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                                            >
                                                {selectedCoffeeBean.name}
                                            </button>
                                            {selectedCoffeeBean.flavor && selectedCoffeeBean.flavor.length > 0 && (
                                                <div className="text-xs font-medium tracking-wide leading-relaxed text-neutral-600 dark:text-neutral-400">
                                                    {selectedCoffeeBean.flavor.join(' · ')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* 分割线 */}
                                <div className="mt-6 h-px bg-neutral-200 dark:bg-neutral-800"></div>
                            </div>
                        ) : (
                            <div className="mb-6">
                                {/* 预留咖啡豆区域高度，保持一致性 */}
                                <div className="h-14"></div>
                                
                                {/* 分割线 */}
                                <div className="mt-6 h-px bg-neutral-200 dark:bg-neutral-800"></div>
                            </div>
                        )}

                        {/* 笔记图片 */}
                        <div className="flex items-center gap-2 w-full mb-6">
                            {image ? (
                                /* 有图片时：只显示图片 */
                                <div className="w-14 h-14 rounded bg-neutral-200/40 dark:bg-neutral-800/60 overflow-hidden relative flex-shrink-0">
                                    <Image
                                        src={image || ''}
                                        alt="笔记图片"
                                        className="object-cover"
                                        fill
                                        sizes="56px"
                                    />
                                    {/* 删除按钮 */}
                                    <button
                                        type="button"
                                        onClick={() => setImage('')}
                                        className="absolute top-1 right-1 w-5 h-5 bg-neutral-800/80 dark:bg-neutral-200/80 text-white dark:text-neutral-800 rounded-full flex items-center justify-center hover:bg-red-500 dark:hover:bg-red-500 dark:hover:text-white transition-colors"
                                    >
                                        <X className="h-2.5 w-2.5" />
                                    </button>
                                </div>
                            ) : (
                                /* 无图片时：显示两个占位框 */
                                <>
                                    {/* 拍照框 */}
                                    <button
                                        type="button"
                                        onClick={() => handleImageSelect('camera')}
                                        className="w-14 h-14 rounded bg-neutral-200/40 dark:bg-neutral-800/60 flex items-center justify-center hover:bg-neutral-200/60 dark:hover:bg-neutral-800/80 transition-colors flex-shrink-0"
                                        title="拍照"
                                    >
                                        <Camera className="w-5 h-5 text-neutral-300 dark:text-neutral-600" />
                                    </button>

                                    {/* 相册框 */}
                                    <button
                                        type="button"
                                        onClick={() => handleImageSelect('gallery')}
                                        className="w-14 h-14 rounded bg-neutral-200/40 dark:bg-neutral-800/60 flex items-center justify-center hover:bg-neutral-200/60 dark:hover:bg-neutral-800/80 transition-colors flex-shrink-0"
                                        title="相册"
                                    >
                                        <ImageIcon className="w-5 h-5 text-neutral-300 dark:text-neutral-600" />
                                    </button>
                                </>
                            )}
                        </div>

                        {/* 描述输入 */}
                        <AutoResizeTextarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="记录你的冲煮心得..."
                            className="w-full text-base font-medium text-neutral-600 dark:text-neutral-400 placeholder:text-neutral-300 dark:placeholder:text-neutral-700 bg-transparent border-0 outline-none resize-none"
                            minRows={10}
                            maxRows={30}
                        />
                    </div>

                    {/* 底部工具栏 - 固定在底部 */}
                    <div className="shrink-0 bg-neutral-50/95 dark:bg-neutral-900/95 backdrop-blur-sm pb-safe-bottom">
                        {/* 工具栏按钮 - 可横向滚动 */}
                        <div className="overflow-x-auto h-14" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                            <style jsx>{`
                                div::-webkit-scrollbar {
                                    display: none;
                                }
                            `}</style>
                            <div className="flex items-center gap-1.5 px-6 h-14 min-w-max">
                                {/* 按优先级顺序排列：已选择的在前，未选择的在后 */}
                                {(() => {
                                    // 定义按钮配置，按优先级排序
                                    const buttons = [
                                        {
                                            key: 'bean',
                                            isSelected: !!selectedCoffeeBean,
                                            priority: 1,
                                            element: (
                                                <button
                                                    key="bean"
                                                    type="button"
                                                    onClick={() => setActivePanel('bean')}
                                                    className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full transition-colors max-w-[160px] ${
                                                        selectedCoffeeBean
                                                            ? 'bg-neutral-200/40 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                                                            : 'bg-neutral-100 dark:bg-neutral-800/40 text-neutral-500 dark:text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800/60'
                                                    }`}
                                                >
                                                    <span className="truncate">
                                                        {selectedCoffeeBean ? selectedCoffeeBean.name : '咖啡豆'}
                                                    </span>
                                                </button>
                                            )
                                        },
                                        {
                                            key: 'equipment',
                                            isSelected: !!selectedEquipment,
                                            priority: 2,
                                            element: (
                                                <button
                                                    key="equipment"
                                                    type="button"
                                                    onClick={() => setActivePanel('equipment')}
                                                    className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full transition-colors max-w-[160px] ${
                                                        selectedEquipment
                                                            ? 'bg-neutral-200/40 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                                                            : 'bg-neutral-100 dark:bg-neutral-800/40 text-neutral-500 dark:text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800/60'
                                                    }`}
                                                >
                                                    <span className="truncate">
                                                        {selectedEquipment 
                                                            ? (
                                                                <>
                                                                    {equipmentName}
                                                                    {selectedMethod && (
                                                                        <>
                                                                            <span className="mx-1">·</span>
                                                                            {selectedMethod}
                                                                        </>
                                                                    )}
                                                                </>
                                                            )
                                                            : '方案'
                                                        }
                                                    </span>
                                                </button>
                                            )
                                        },
                                        {
                                            key: 'rating',
                                            isSelected: rating > 0,
                                            priority: 3,
                                            element: (
                                                <button
                                                    key="rating"
                                                    type="button"
                                                    onClick={() => setActivePanel('rating')}
                                                    className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full transition-colors max-w-[200px] ${
                                                        rating > 0
                                                            ? 'bg-neutral-200/40 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                                                            : 'bg-neutral-100 dark:bg-neutral-800/40 text-neutral-500 dark:text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800/60'
                                                    }`}
                                                >
                                                    <span className="truncate block">
                                                        {rating > 0 ? (() => {
                                                            const flavorText = Object.keys(tasteRatings).length > 0
                                                                ? ' · ' + flavorDimensions
                                                                    .filter(dim => tasteRatings[dim.id] > 0)
                                                                    .map(dim => `${dim.label}${tasteRatings[dim.id]}`)
                                                                    .join(' ')
                                                                : '';
                                                            return rating.toFixed(1) + flavorText;
                                                        })() : '评分'}
                                                    </span>
                                                </button>
                                            )
                                        },
                                        {
                                            key: 'date',
                                            isSelected: true, // 日期始终显示为已选择状态
                                            priority: 4,
                                            element: (
                                                <div key="date">
                                                    <button
                                                        ref={dateButtonRef}
                                                        type="button"
                                                        onClick={() => setShowDatePicker(!showDatePicker)}
                                                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full transition-colors bg-neutral-200/40 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                                                    >
                                                        <span className="truncate">
                                                            {formatDateDisplay(brewDate)}
                                                        </span>
                                                    </button>
                                                </div>
                                            )
                                        }
                                    ];

                                    // 分组：已选择的和未选择的
                                    const selected = buttons.filter(btn => btn.isSelected).sort((a, b) => a.priority - b.priority);
                                    const unselected = buttons.filter(btn => !btn.isSelected).sort((a, b) => a.priority - b.priority);

                                    // 合并：已选择的在前，未选择的在后
                                    return [...selected, ...unselected].map(btn => btn.element);
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* 底部弹出面板 */}
                    <AnimatePresence>
                        {activePanel === 'bean' && (
                            <CoffeeBeanSelectorPanel
                                selectedBean={selectedCoffeeBean}
                                onSelect={(bean: CoffeeBean | null) => {
                                    setSelectedCoffeeBean(bean)
                                }}
                                onClose={() => setActivePanel(null)}
                                onRandomPick={() => setIsRandomPickerOpen(true)}
                            />
                        )}

                        {activePanel === 'equipment' && (
                            <EquipmentMethodSelectorPanel
                                selectedEquipment={selectedEquipment}
                                selectedMethod={selectedMethod}
                                onSelect={(equipment: string, method: string, _params?: Method['params']) => {
                                    setSelectedEquipment(equipment)
                                    setSelectedMethod(method)
                                    setActivePanel(null)
                                }}
                                onClose={() => setActivePanel(null)}
                            />
                        )}

                        {activePanel === 'rating' && (
                            <RatingSelectorPanel
                                rating={rating}
                                tasteRatings={tasteRatings}
                                onRatingChange={setRating}
                                onTasteRatingsChange={setTasteRatings}
                                onClose={() => setActivePanel(null)}
                            />
                        )}
                    </AnimatePresence>

                    {/* 日期选择器 - 固定定位避免被裁剪 */}
                    <AnimatePresence>
                        {showDatePicker && dateButtonRef.current && (() => {
                            const position = getDatePickerPosition()
                            return (
                                <motion.div 
                                    ref={datePickerRef}
                                    initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                                    exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                                    transition={{ 
                                        duration: 0.2,
                                        ease: [0.25, 0.46, 0.45, 0.94]
                                    }}
                                    style={{ 
                                        width: '280px',
                                        bottom: `${position.bottom}px`,
                                        left: `${position.left}px`,
                                        maxHeight: 'calc(100vh - 100px)',
                                        willChange: 'opacity, transform, filter'
                                    }}
                                    className="fixed z-[60] bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-800 overflow-auto" 
                                >
                                    <Calendar
                                        selected={brewDate}
                                        onSelect={handleDateChange}
                                        locale="zh-CN"
                                        initialFocus
                                    />
                                </motion.div>
                            )
                        })()}
                    </AnimatePresence>

                    {/* 随机选择器 */}
                    <CoffeeBeanRandomPicker
                        beans={coffeeBeans}
                        isOpen={isRandomPickerOpen}
                        onClose={() => setIsRandomPickerOpen(false)}
                        onSelect={handleRandomBeanSelect}
                        isLongPress={false}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default FullScreenNoteEditor

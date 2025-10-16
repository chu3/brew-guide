'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { availableGrinders } from '@/lib/core/config'
import { getCategorizedGrindSizes, getMyGrinders } from '@/lib/utils/grindUtils'
import { SettingsOptions, CustomGrinder } from './Settings'
import hapticsUtils from '@/lib/ui/haptics'
import { ChevronLeft, Plus } from 'lucide-react'
import { showToast } from '@/components/common/feedback/LightToast'
import { GrinderManager } from '@/lib/managers/grinderManager'


interface GrinderSettingsProps {
    settings: SettingsOptions;
    onClose: () => void;
    handleChange: <K extends keyof SettingsOptions>(key: K, value: SettingsOptions[K]) => void;
}

const GrinderSettings: React.FC<GrinderSettingsProps> = ({
    settings,
    onClose,
    handleChange
}) => {
    // 历史栈管理
    const onCloseRef = React.useRef(onClose)
    onCloseRef.current = onClose

    useEffect(() => {
        window.history.pushState({ modal: 'grinder-settings' }, '')

        const handlePopState = () => onCloseRef.current()
        window.addEventListener('popstate', handlePopState)

        return () => {
            window.removeEventListener('popstate', handlePopState)
            // 组件卸载时清理动画帧
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current)
            }
        }
    }, []) // 空依赖数组，确保只在挂载时执行一次

    // 关闭处理
    const handleClose = () => {
        if (window.history.state?.modal === 'grinder-settings') {
            window.history.back()
        } else {
            onClose()
        }
    }

    // 控制动画状态
    const [shouldRender, setShouldRender] = useState(false)
    const [isVisible, setIsVisible] = useState(false)

    // 处理显示/隐藏动画
    useEffect(() => {
        setShouldRender(true)
        // 短暂延迟确保 DOM 渲染，然后触发滑入动画
        const timer = setTimeout(() => setIsVisible(true), 10)
        return () => clearTimeout(timer)
    }, [])

    // 状态管理
    const [isCreatingCustom, setIsCreatingCustom] = useState(false)
    const [isAddingGrinder, setIsAddingGrinder] = useState(false) // 是否正在添加磨豆机
    const [editingCustomId, setEditingCustomId] = useState<string | null>(null)
    const [previousGrinderType, setPreviousGrinderType] = useState<string>('generic')
    const [expandedGrinderId, setExpandedGrinderId] = useState<string | null>(null) // 展开的磨豆机ID
    
    // 侧滑删除相关状态
    const [swipedGrinderId, setSwipedGrinderId] = useState<string | null>(null)
    const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
    const [touchOffset, setTouchOffset] = useState(0)
    const rafIdRef = React.useRef<number | null>(null) // 用于存储 requestAnimationFrame ID
    
    const [customGrinderForm, setCustomGrinderForm] = useState({
        name: '',
        unit: '', // 添加研磨度单位字段
        grindSizes: {
            极细: '',
            特细: '',
            细: '',
            中细: '',
            中细偏粗: '',
            中粗: '',
            粗: '',
            特粗: '',
            意式: '',
            摩卡壶: '',
            手冲: '',
            法压壶: '',
            冷萃: ''
        }
    })

    // 常见研磨度单位预设
    const commonUnits = ['格', '圈', '档', '刻度', 'mm', '级']

    // 从研磨度数据中提取单位的辅助函数
    const extractUnitFromGrindSizes = (grindSizes: Record<string, string>): string => {
        // 查找第一个非空的研磨度值
        for (const value of Object.values(grindSizes)) {
            if (value && value.trim()) {
                // 使用正则表达式提取单位（非数字、非连字符、非空格的字符）
                const match = value.match(/[^\d\s-]+/);
                if (match) {
                    return match[0];
                }
            }
        }
        return '';
    }

    // 从研磨度值中提取数值部分的辅助函数
    const extractNumberFromGrindSize = (value: string): string => {
        if (!value || !value.trim()) return '';
        // 提取数字、连字符、小数点和空格
        const match = value.match(/[\d\s.-]+/);
        return match ? match[0].trim() : '';
    }

    // 更新单位（不自动应用到输入值，只更新单位状态）
    const updateUnit = (unit: string) => {
        setCustomGrinderForm(prev => ({
            ...prev,
            unit
        }));
    }

    // 获取所有磨豆机（包括自定义的和添加选项）- 使用 useMemo 缓存
    const allGrinders = useMemo(() => {
        const customGrinders = settings.customGrinders || []
        const addCustomOption = {
            id: 'add_custom',
            name: '添加自定义磨豆机',
            grindSizes: {}
        }
        return [...availableGrinders, ...customGrinders, addCustomOption]
    }, [settings.customGrinders])

    // 获取可添加的磨豆机（排除已添加的）
    const availableToAdd = useMemo(() => {
        const myGrinderIds = settings.myGrinders || ['generic']
        return allGrinders.filter(g =>
            g.id !== 'add_custom' && !myGrinderIds.includes(g.id)
        )
    }, [allGrinders, settings.myGrinders])

    // 添加磨豆机到我的列表
    const addGrinderToMyList = async (grinderId: string) => {
        try {
            await GrinderManager.addToMyGrinders(grinderId)
            if (settings.hapticFeedback) {
                hapticsUtils.light()
            }
        } catch (error) {
            console.error('添加磨豆机失败:', error)
            showToast({
                type: 'error',
                title: '添加失败，请重试'
            })
        } finally {
            setIsAddingGrinder(false)
        }
    }

    // 从我的列表移除磨豆机
    const removeGrinderFromMyList = async (grinderId: string) => {
        // 先重置侧滑状态
        resetSwipe()

        try {
            await GrinderManager.removeFromMyGrinders(grinderId)
            if (settings.hapticFeedback) {
                hapticsUtils.light()
            }
        } catch (error: unknown) {
            console.error('删除磨豆机失败:', error)
            showToast({
                type: 'warning',
                title: error instanceof Error ? error.message : '删除失败，请重试'
            })
        }
    }

    // 侧滑删除相关函数
    const handleTouchStart = (e: React.TouchEvent, grinderId: string) => {
        setTouchStart({
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        })
        setSwipedGrinderId(grinderId)
    }

    const handleTouchMove = (e: React.TouchEvent, grinderId: string) => {
        if (!touchStart || grinderId !== swipedGrinderId) return

        // 取消之前的动画帧
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current)
        }

        // 使用 requestAnimationFrame 优化性能
        rafIdRef.current = requestAnimationFrame(() => {
            const currentX = e.touches[0].clientX
            const currentY = e.touches[0].clientY
            const deltaX = touchStart.x - currentX
            const deltaY = Math.abs(touchStart.y - currentY)

            // 如果垂直滑动距离大于水平滑动，认为是滚动操作，不处理
            if (deltaY > Math.abs(deltaX)) {
                return
            }

            // 只允许向左滑动，且最大滑动距离为 80px
            if (deltaX > 0) {
                setTouchOffset(Math.min(deltaX, 80))
            } else {
                setTouchOffset(0)
            }
        })
    }

    const handleTouchEnd = () => {
        // 清理动画帧
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current)
            rafIdRef.current = null
        }

        // 如果滑动超过 40px，则保持显示删除按钮，否则回弹
        if (touchOffset > 40) {
            setTouchOffset(80)
            if (settings.hapticFeedback) {
                hapticsUtils.light()
            }
        } else {
            setTouchOffset(0)
            setSwipedGrinderId(null)
        }
        setTouchStart(null)
    }

    // 重置侧滑状态
    const resetSwipe = () => {
        // 清理动画帧
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current)
            rafIdRef.current = null
        }
        
        setTouchOffset(0)
        setSwipedGrinderId(null)
        setTouchStart(null)
    }

    // 开始创建自定义磨豆机
    const startCreatingCustomGrinder = () => {
        // 保存当前选中的磨豆机型号
        setPreviousGrinderType(settings.grindType)
        setIsCreatingCustom(true)
        setEditingCustomId(null)
        setCustomGrinderForm({
            name: '',
            unit: '',
            grindSizes: {
                极细: '',
                特细: '',
                细: '',
                中细: '',
                中细偏粗: '',
                中粗: '',
                粗: '',
                特粗: '',
                意式: '',
                摩卡壶: '',
                手冲: '',
                法压壶: '',
                冷萃: ''
            }
        })
    }

    // 开始编辑自定义磨豆机
    const startEditingCustomGrinder = (grinder: CustomGrinder) => {
        // 保存当前选中的磨豆机型号
        setPreviousGrinderType(settings.grindType)
        setIsCreatingCustom(true)
        setEditingCustomId(grinder.id)

        const extractedUnit = extractUnitFromGrindSizes(grinder.grindSizes);

        setCustomGrinderForm({
            name: grinder.name,
            unit: extractedUnit, // 从现有数据中提取单位
            grindSizes: {
                // 提取数值部分，去掉单位，便于编辑
                极细: extractNumberFromGrindSize(grinder.grindSizes.极细 || ''),
                特细: extractNumberFromGrindSize(grinder.grindSizes.特细 || ''),
                细: extractNumberFromGrindSize(grinder.grindSizes.细 || ''),
                中细: extractNumberFromGrindSize(grinder.grindSizes.中细 || ''),
                中细偏粗: extractNumberFromGrindSize(grinder.grindSizes.中细偏粗 || ''),
                中粗: extractNumberFromGrindSize(grinder.grindSizes.中粗 || ''),
                粗: extractNumberFromGrindSize(grinder.grindSizes.粗 || ''),
                特粗: extractNumberFromGrindSize(grinder.grindSizes.特粗 || ''),
                意式: extractNumberFromGrindSize(grinder.grindSizes.意式 || ''),
                摩卡壶: extractNumberFromGrindSize(grinder.grindSizes.摩卡壶 || ''),
                手冲: extractNumberFromGrindSize(grinder.grindSizes.手冲 || ''),
                法压壶: extractNumberFromGrindSize(grinder.grindSizes.法压壶 || ''),
                冷萃: extractNumberFromGrindSize(grinder.grindSizes.冷萃 || '')
            }
        })
        // 切换到编辑模式
        handleChange('grindType', 'add_custom')
    }

    // 保存自定义磨豆机
    const saveCustomGrinder = async () => {
        if (!customGrinderForm.name.trim()) {
            showToast({
                type: 'warning',
                title: '请输入磨豆机名称'
            })
            return
        }

        // 组合数值和单位生成最终的研磨度数据
        const finalGrindSizes: Record<string, string> = {};
        Object.keys(customGrinderForm.grindSizes).forEach(key => {
            const value = customGrinderForm.grindSizes[key as keyof typeof customGrinderForm.grindSizes];
            if (value && value.trim()) {
                // 如果有单位，则组合数值和单位；否则保持原值
                finalGrindSizes[key] = customGrinderForm.unit.trim()
                    ? `${value.trim()}${customGrinderForm.unit}`
                    : value.trim();
            } else {
                finalGrindSizes[key] = '';
            }
        });

        try {
            if (editingCustomId) {
                // 编辑现有磨豆机
                await GrinderManager.updateCustomGrinder(editingCustomId, {
                    name: customGrinderForm.name,
                    grindSizes: finalGrindSizes
                })
            } else {
                // 创建新磨豆机
                await GrinderManager.addCustomGrinder({
                    name: customGrinderForm.name,
                    grindSizes: finalGrindSizes
                })
            }

            if (settings.hapticFeedback) {
                hapticsUtils.light()
            }

            // 重置表单
            setIsCreatingCustom(false)
            setEditingCustomId(null)
        } catch (error) {
            console.error('保存自定义磨豆机失败:', error)
            showToast({
                type: 'error',
                title: '保存失败，请重试'
            })
        }
    }

    // 删除自定义磨豆机
    const deleteCustomGrinder = async (grinderId: string) => {
        if (!confirm('确定要删除这个自定义磨豆机吗？')) return

        try {
            await GrinderManager.deleteCustomGrinder(grinderId)
            if (settings.hapticFeedback) {
                hapticsUtils.light()
            }
        } catch (error) {
            console.error('删除自定义磨豆机失败:', error)
            showToast({
                type: 'error',
                title: '删除失败，请重试'
            })
        }
    }

    // 取消编辑
    const cancelEditing = () => {
        setIsCreatingCustom(false)
        setEditingCustomId(null)
        // 回到之前选中的磨豆机
        handleChange('grindType', previousGrinderType)
    }

    // 导出自定义磨豆机
    const exportCustomGrinder = (grinder: CustomGrinder) => {
        const exportData = {
            name: grinder.name,
            grindSizes: grinder.grindSizes
        }
        const jsonString = JSON.stringify(exportData, null, 2)
        navigator.clipboard.writeText(jsonString).then(() => {
            showToast({
                type: 'success',
                title: '磨豆机配置已复制到剪贴板'
            })
        }).catch(() => {
            // 降级方案：显示文本供用户手动复制
            const textarea = document.createElement('textarea')
            textarea.value = jsonString
            textarea.style.position = 'fixed'
            textarea.style.left = '-999999px'
            textarea.style.top = '-999999px'
            document.body.appendChild(textarea)
            textarea.focus()
            textarea.select()
            try {
                document.execCommand('copy')
                showToast({
                    type: 'success',
                    title: '磨豆机配置已复制到剪贴板'
                })
            } catch (_err) {
                showToast({
                    type: 'error',
                    title: '复制失败，请重试',
                    duration: 3000
                })
            }
            document.body.removeChild(textarea)
        })
    }

    // 导入自定义磨豆机
    const importCustomGrinder = async () => {
        const jsonString = prompt('请粘贴磨豆机配置的 JSON 数据：')
        if (!jsonString) return

        try {
            const importData = JSON.parse(jsonString)

            // 验证数据格式
            if (!importData.name || !importData.grindSizes) {
                throw new Error('数据格式不正确')
            }

            // 使用 Manager 添加磨豆机
            await GrinderManager.addCustomGrinder({
                name: importData.name,
                grindSizes: {
                    极细: importData.grindSizes.极细 || '',
                    特细: importData.grindSizes.特细 || '',
                    细: importData.grindSizes.细 || '',
                    中细: importData.grindSizes.中细 || '',
                    中细偏粗: importData.grindSizes.中细偏粗 || '',
                    中粗: importData.grindSizes.中粗 || '',
                    粗: importData.grindSizes.粗 || '',
                    特粗: importData.grindSizes.特粗 || '',
                    意式: importData.grindSizes.意式 || '',
                    摩卡壶: importData.grindSizes.摩卡壶 || '',
                    手冲: importData.grindSizes.手冲 || '',
                    法压壶: importData.grindSizes.法压壶 || '',
                    冷萃: importData.grindSizes.冷萃 || ''
                }
            })

            showToast({
                type: 'success',
                title: '磨豆机配置导入成功'
            })
        } catch (_error) {
            showToast({
                type: 'error',
                title: '导入失败：JSON 格式不正确',
                duration: 3000
            })
        }
    }

    // 渲染磨豆机参考信息（用于列表项内）
    const renderGrinderReferenceInline = (grinderId: string): React.ReactElement | null => {
        const selectedGrinder = allGrinders.find(g => g.id === grinderId);

        if (!selectedGrinder || grinderId === 'generic' || !selectedGrinder.grindSizes || Object.keys(selectedGrinder.grindSizes).length === 0) {
            return null;
        }

        const { basicGrindSizes, applicationGrindSizes } = getCategorizedGrindSizes(grinderId, settings.customGrinders);
        const isExpanded = expandedGrinderId === grinderId;

        return (
            <div
                className={`overflow-hidden mx-3 transition-[max-height] duration-300 ease-in-out ${isExpanded ? 'max-h-[800px]' : 'max-h-0'
                    }`}
            >
                <div className={`pb-3 space-y-3 transition-opacity duration-300 ease-in-out ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
                    {/* 基础研磨度部分 */}
                    {Object.keys(basicGrindSizes).length > 0 ? (
                        <div>
                            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                                基础研磨度:
                            </p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                {Object.entries(basicGrindSizes).map(([key, value]) => (
                                    <div key={key} className="flex justify-between text-xs text-neutral-700 dark:text-neutral-300">
                                        <span className="font-medium">{key}</span>
                                        <span>{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {/* 特定应用研磨度部分 */}
                    {Object.keys(applicationGrindSizes).length > 0 ? (
                        <div>
                            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                                特定应用研磨度:
                            </p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                {Object.entries(applicationGrindSizes).map(([key, value]) => (
                                    <div key={key} className="flex justify-between text-xs text-neutral-700 dark:text-neutral-300">
                                        <span className="font-medium">{key}</span>
                                        <span>{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {/* 自定义磨豆机操作按钮 */}
                    {('isCustom' in selectedGrinder && selectedGrinder.isCustom) ? (
                        <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700">
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                                操作
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        startEditingCustomGrinder(selectedGrinder as CustomGrinder);
                                    }}
                                    className="px-2 py-1 text-xs font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                                >
                                    编辑
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const myGrindersList = settings.myGrinders || ['generic'];
                                        const isLastGrinder = myGrindersList.length === 1;
                                        
                                        if (isLastGrinder) {
                                            if (settings.hapticFeedback) {
                                                hapticsUtils.light();
                                            }
                                            showToast({
                                                type: 'warning',
                                                title: '至少需要保留一个磨豆机'
                                            });
                                            return;
                                        }
                                        deleteCustomGrinder(selectedGrinder.id);
                                    }}
                                    className="px-2 py-1 text-xs font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                                >
                                    删除
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        exportCustomGrinder(selectedGrinder as CustomGrinder);
                                    }}
                                    className="px-2 py-1 text-xs font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                                >
                                    导出
                                </button>
                            </div>
                        </div>
                    ) : null}

                    {/* 数据来源信息 */}
                    <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700">
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                            数据来源：网络收集和用户调研，仅供参考
                        </p>
                        <a
                            href="https://wj.qq.com/s2/19815833/44ae/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                        >
                            → 参与研磨度调研问卷
                        </a>
                    </div>
                </div>
            </div>
        );
    };

    if (!shouldRender) return null

    return (
        <div
            className={`
                fixed inset-0 z-50 flex flex-col bg-neutral-50 dark:bg-neutral-900 mx-auto
                transition-transform duration-[350ms] ease-[cubic-bezier(0.36,0.66,0.04,1)]
                ${isVisible ? 'translate-x-0' : 'translate-x-full'}
            `}
        >
            {/* 头部导航栏 */}
            <div className="relative flex items-center justify-center py-4 pt-safe-top">
                <button
                    onClick={handleClose}
                    className="absolute left-4 flex items-center justify-center w-10 h-10 rounded-full text-neutral-700 dark:text-neutral-300"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-md font-medium text-neutral-800 dark:text-neutral-200">
                    磨豆机设置
                </h2>
            </div>

            {/* 滚动内容区域 */}
            <div className="relative flex-1 overflow-y-auto pb-safe-bottom divide-y divide-neutral-200 dark:divide-neutral-800">
                {/* 顶部渐变阴影 */}
                <div className="sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none first:border-b-0"></div>

                {/* 设置内容 */}
                <div className="px-6 py-4 -mt-4" onClick={resetSwipe}>
                    {/* 我的磨豆机列表 */}
                    {!isCreatingCustom && !isAddingGrinder && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                    磨豆机列表 ({(settings.myGrinders || ['generic']).length})
                                </h3>
                                <button
                                    onClick={() => setIsAddingGrinder(true)}
                                    className="flex items-center gap-1 text-sm font-medium text-neutral-800 dark:text-neutral-200"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    添加磨豆机
                                </button>
                            </div>

                            {/* 磨豆机列表 */}
                            <div className="space-y-2">
                                {(() => {
                                    const myGrindersList = settings.myGrinders || ['generic'];
                                    const grinders = getMyGrinders(myGrindersList, settings.customGrinders);
                                    
                                    return grinders.map((grinder) => {
                                    const isLastGrinder = myGrindersList.length === 1;
                                    
                                    return (
                                        <div
                                            key={grinder.id}
                                            className="relative bg-neutral-100 dark:bg-neutral-800 overflow-hidden"
                                        >
                                            {/* 删除按钮背景层 */}
                                            <div className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center">
                                                <button
                                                    onClick={async () => {
                                                        if (isLastGrinder) {
                                                            if (settings.hapticFeedback) {
                                                                hapticsUtils.light();
                                                            }
                                                            showToast({
                                                                type: 'warning',
                                                                title: '至少需要保留一个磨豆机'
                                                            });
                                                            return;
                                                        }
                                                        await removeGrinderFromMyList(grinder.id);
                                                    }}
                                                    className="text-white text-sm font-medium"
                                                >
                                                    删除
                                                </button>
                                            </div>
                                            
                                            {/* 可滑动的内容层 */}
                                            <div
                                                className="relative bg-neutral-100 dark:bg-neutral-800 transition-transform duration-200 ease-out"
                                                style={{
                                                    transform: swipedGrinderId === grinder.id ? `translateX(-${touchOffset}px)` : 'translateX(0)'
                                                }}
                                                onTouchStart={(e) => {
                                                    e.stopPropagation();
                                                    handleTouchStart(e, grinder.id);
                                                }}
                                                onTouchMove={(e) => {
                                                    e.stopPropagation();
                                                    handleTouchMove(e, grinder.id);
                                                }}
                                                onTouchEnd={(e) => {
                                                    e.stopPropagation();
                                                    handleTouchEnd();
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                            <div className="flex items-center justify-between p-3">
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                                        {grinder.name}
                                                    </p>
                                                </div>
                                                {/* 查看研磨度按钮 */}
                                                {grinder.id !== 'generic' && grinder.grindSizes && Object.keys(grinder.grindSizes).length > 0 && (
                                                    <button
                                                        onClick={() => {
                                                            resetSwipe();
                                                            setExpandedGrinderId(expandedGrinderId === grinder.id ? null : grinder.id);
                                                            if (settings.hapticFeedback) {
                                                                hapticsUtils.light();
                                                            }
                                                        }}
                                                        className="text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
                                                    >
                                                        {expandedGrinderId === grinder.id ? '收起' : '查看'}
                                                    </button>
                                                )}
                                            </div>
                                            {/* 研磨度参考信息 */}
                                            {grinder.id !== 'generic' && renderGrinderReferenceInline(grinder.id)}
                                        </div>
                                    </div>
                                    );
                                    });
                                })()}
                            </div>
                        </div>
                    )}

                    {/* 添加磨豆机界面 */}
                    {isAddingGrinder && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                    选择要添加的磨豆机
                                </h3>
                                <button
                                    onClick={() => setIsAddingGrinder(false)}
                                    className="flex items-center gap-1 text-sm font-medium text-neutral-800 dark:text-neutral-200"
                                >
                                    取消
                                </button>
                            </div>

                            {availableToAdd.length > 0 ? (
                                <div className="space-y-2">
                                    {availableToAdd.map((grinder) => (
                                        <button
                                            key={grinder.id}
                                            onClick={() => addGrinderToMyList(grinder.id)}
                                            className="w-full flex items-center justify-between p-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors group"
                                        >
                                            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                                {grinder.name}
                                            </p>
                                            <Plus className="h-4 w-4 text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors" />
                                        </button>
                                    ))}
                                    {/* 创建自定义磨豆机按钮 */}
                                    <button
                                        onClick={() => {
                                            setIsAddingGrinder(false);
                                            startCreatingCustomGrinder();
                                        }}
                                        className="w-full py-2.5 text-sm font-medium text-neutral-600 dark:text-neutral-400 border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
                                    >
                                        + 创建自定义磨豆机
                                    </button>
                                </div>

                            ) : (
                                <div className="text-center py-8 text-sm text-neutral-500 dark:text-neutral-400">
                                    所有可用的磨豆机都已添加
                                </div>
                            )}


                        </div>
                    )}

                    {/* 创建/编辑自定义磨豆机界面 */}
                    {isCreatingCustom && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                    {editingCustomId ? '编辑自定义磨豆机' : '创建自定义磨豆机'}
                                </h3>
                                <button
                                    onClick={cancelEditing}
                                    className="text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                                >
                                    取消
                                </button>
                            </div>

                            {/* 磨豆机名称输入 */}
                            <div className="mb-4">
                                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2 block">
                                    磨豆机名称:
                                </label>
                                <input
                                    type="text"
                                    value={customGrinderForm.name}
                                    onChange={(e) => setCustomGrinderForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="请输入磨豆机名称"
                                    className="w-full px-3 py-2 text-sm bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                                />
                            </div>

                            {/* 研磨度单位选择 */}
                            <div className="mb-4">
                                <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2 block">
                                    研磨度单位:
                                </label>
                                <div className="flex gap-2 mb-2">
                                    {/* 常用单位快速选择 */}
                                    {commonUnits.map((unit) => (
                                        <button
                                            key={unit}
                                            onClick={() => updateUnit(unit)}
                                            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${customGrinderForm.unit === unit
                                                ? 'bg-neutral-700 dark:bg-neutral-600 text-white'
                                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}
                                        >
                                            {unit}
                                        </button>
                                    ))}
                                </div>
                                {/* 自定义单位输入 */}
                                <input
                                    type="text"
                                    value={customGrinderForm.unit}
                                    onChange={(e) => updateUnit(e.target.value)}
                                    placeholder="或输入自定义单位"
                                    className="w-full px-3 py-2 text-sm bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                                />
                                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                    选择单位后，在下方输入框中只需输入数值，单位会显示在输入框后方
                                </p>
                            </div>

                            {/* 基础研磨度部分 */}
                            <div className="mb-3">
                                <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                                    基础研磨度:
                                </p>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                    {['极细', '特细', '细', '中细', '中细偏粗', '中粗', '粗', '特粗'].map((key) => (
                                        <div key={key} className="flex justify-between items-center text-sm text-neutral-700 dark:text-neutral-300">
                                            <span className="font-medium">{key}</span>
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="text"
                                                    value={customGrinderForm.grindSizes[key as keyof typeof customGrinderForm.grindSizes]}
                                                    onChange={(e) => setCustomGrinderForm(prev => ({
                                                        ...prev,
                                                        grindSizes: {
                                                            ...prev.grindSizes,
                                                            [key]: e.target.value
                                                        }
                                                    }))}
                                                    placeholder="如: 1-2"
                                                    className="w-16 px-2 py-1 text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700 rounded text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                                                />
                                                {customGrinderForm.unit && (
                                                    <span className="text-xs text-neutral-500 dark:text-neutral-400 min-w-0">
                                                        {customGrinderForm.unit}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 特定应用研磨度部分 */}
                            <div className="mb-3">
                                <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                                    特定应用研磨度:
                                </p>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                    {['意式', '摩卡壶', '手冲', '法压壶', '冷萃'].map((key) => (
                                        <div key={key} className="flex justify-between items-center text-sm text-neutral-700 dark:text-neutral-300">
                                            <span className="font-medium">{key}</span>
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="text"
                                                    value={customGrinderForm.grindSizes[key as keyof typeof customGrinderForm.grindSizes]}
                                                    onChange={(e) => setCustomGrinderForm(prev => ({
                                                        ...prev,
                                                        grindSizes: {
                                                            ...prev.grindSizes,
                                                            [key]: e.target.value
                                                        }
                                                    }))}
                                                    placeholder="如: 2-4"
                                                    className="w-16 px-2 py-1 text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700 rounded text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                                                />
                                                {customGrinderForm.unit && (
                                                    <span className="text-xs text-neutral-500 dark:text-neutral-400 min-w-0">
                                                        {customGrinderForm.unit}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 操作按钮 */}
                            <div className="flex gap-2">
                                <button
                                    onClick={saveCustomGrinder}
                                    className="flex-1 py-2 text-sm font-medium bg-neutral-700 dark:bg-neutral-600 text-white rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-500 transition-colors"
                                >
                                    保存
                                </button>
                                <button
                                    onClick={importCustomGrinder}
                                    className="px-4 py-2 text-sm font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                                >
                                    导入
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 显示选中磨豆机的参考研磨度 */}
                </div>
            </div>
        </div>
    );
};

export default GrinderSettings;
